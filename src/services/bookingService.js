const {
  checkoutSchema,
  manualBookingSchema,
  availableTimesQuerySchema,
  bookingIdParamsSchema,
  parseOrThrow
} = require("../validation/schemas");

class HttpError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isUniqueViolation(err) {
  return err && err.code === "23505";
}

function dayNameFromIsoDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC"
  }).format(utcDate);
}

function toPublicBooking(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    date: row.date,
    time_slot: row.time_slot,
    training_type: row.training_type,
    status: row.status,
    amount_paid: row.amount_paid,
    stripe_session_id: row.stripe_session_id,
    created_at: row.created_at
  };
}

function createBookingService({ db, stripe, config }) {
  async function expirePendingBookings(client) {
    await client.query(
      `
        UPDATE bookings
        SET status = 'expired', updated_at = NOW()
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at < NOW()
      `
    );
  }

  async function listAvailableTimes(query) {
    const { date } = parseOrThrow(availableTimesQuerySchema, query);
    const dayName = dayNameFromIsoDate(date);

    const result = await db.withTransaction(async (client) => {
      await expirePendingBookings(client);

      return client.query(
        `
          SELECT s.time_slot
          FROM schedule s
          WHERE s.day_of_week = $1
            AND NOT EXISTS (
              SELECT 1
              FROM bookings b
              WHERE b.booking_date = $2::date
                AND b.time_slot = s.time_slot
                AND b.status IN ('pending', 'confirmed')
            )
          ORDER BY s.time_slot ASC
        `,
        [dayName, date]
      );
    });

    return result.rows;
  }

  async function listBookings() {
    const result = await db.query(
      `
        SELECT
          id,
          name,
          email,
          phone,
          booking_date::text AS date,
          time_slot,
          training_type,
          status,
          amount_paid,
          stripe_session_id,
          created_at
        FROM bookings
        WHERE status IN ('pending', 'confirmed')
        ORDER BY booking_date ASC, time_slot ASC
      `
    );

    return result.rows.map(toPublicBooking);
  }

  async function createPendingBooking(input) {
    const booking = parseOrThrow(checkoutSchema, input);

    try {
      return await db.withTransaction(async (client) => {
        await expirePendingBookings(client);

        const result = await client.query(
          `
            INSERT INTO bookings (
              name,
              email,
              phone,
              booking_date,
              time_slot,
              training_type,
              status,
              expires_at
            )
            VALUES ($1, $2, $3, $4::date, $5, $6, 'pending', NOW() + ($7::int * INTERVAL '1 minute'))
            RETURNING id
          `,
          [
            booking.name,
            booking.email,
            booking.phone,
            booking.date,
            booking.time,
            booking.trainingType,
            config.pendingHoldMinutes
          ]
        );

        return {
          id: result.rows[0].id,
          ...booking
        };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, "This time slot is already booked.", "SLOT_TAKEN");
      }

      throw err;
    }
  }

  async function cancelBookingHold(id) {
    await db.query(
      `
        UPDATE bookings
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1 AND status = 'pending'
      `,
      [id]
    );
  }

  async function createCheckoutSession(input) {
    const pendingBooking = await createPendingBooking(input);
    const priceId = config.stripePrices[pendingBooking.trainingType];

    if (!priceId) {
      await cancelBookingHold(pendingBooking.id);
      throw new HttpError(
        500,
        `Stripe price is not configured for ${pendingBooking.trainingType}.`,
        "STRIPE_PRICE_MISSING"
      );
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: pendingBooking.email,
        line_items: [
          {
            price: priceId,
            quantity: 1
          }
        ],
        metadata: {
          bookingId: String(pendingBooking.id),
          name: pendingBooking.name,
          email: pendingBooking.email,
          phone: pendingBooking.phone,
          date: pendingBooking.date,
          time: pendingBooking.time,
          trainingType: pendingBooking.trainingType
        },
        success_url: `${config.appUrl}/success`,
        cancel_url: `${config.appUrl}/cancel`
      });

      await db.query(
        `
          UPDATE bookings
          SET stripe_session_id = $1, updated_at = NOW()
          WHERE id = $2
        `,
        [session.id, pendingBooking.id]
      );

      return { url: session.url };
    } catch (err) {
      await cancelBookingHold(pendingBooking.id);
      throw err;
    }
  }

  async function confirmCheckoutSession(session) {
    const bookingId = Number(session.metadata && session.metadata.bookingId);

    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      throw new HttpError(400, "Stripe session is missing booking metadata.", "BAD_WEBHOOK");
    }

    try {
      return await db.withTransaction(async (client) => {
        await expirePendingBookings(client);

        const selected = await client.query(
          `
            SELECT id, status
            FROM bookings
            WHERE id = $1
            FOR UPDATE
          `,
          [bookingId]
        );

        if (selected.rowCount === 0) {
          throw new HttpError(404, "Booking hold was not found.", "BOOKING_NOT_FOUND");
        }

        if (selected.rows[0].status === "confirmed") {
          return { confirmed: true, alreadyConfirmed: true };
        }

        await client.query(
          `
            UPDATE bookings
            SET
              status = 'confirmed',
              stripe_session_id = $1,
              amount_paid = $2,
              expires_at = NULL,
              updated_at = NOW()
            WHERE id = $3
          `,
          [session.id, session.amount_total || null, bookingId]
        );

        return { confirmed: true, alreadyConfirmed: false };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(
          409,
          "This time slot was taken before payment confirmation completed.",
          "SLOT_TAKEN"
        );
      }

      throw err;
    }
  }

  async function createManualBooking(input) {
    const booking = parseOrThrow(manualBookingSchema, input);

    try {
      const result = await db.withTransaction(async (client) => {
        await expirePendingBookings(client);

        return client.query(
          `
            INSERT INTO bookings (
              name,
              email,
              booking_date,
              time_slot,
              training_type,
              status
            )
            VALUES ($1, $2, $3::date, $4, $5, 'confirmed')
            RETURNING id
          `,
          [
            booking.name,
            booking.email,
            booking.date,
            booking.time,
            booking.trainingType
          ]
        );
      });

      return {
        success: true,
        id: result.rows[0].id,
        message: "Booking successful!"
      };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new HttpError(409, "This time slot is already booked.", "SLOT_TAKEN");
      }

      throw err;
    }
  }

  async function cancelBooking(params) {
    const { id } = parseOrThrow(bookingIdParamsSchema, params);
    const result = await db.query(
      `
        UPDATE bookings
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
          AND status IN ('pending', 'confirmed')
        RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      throw new HttpError(404, "Booking was not found.", "BOOKING_NOT_FOUND");
    }

    return { success: true };
  }

  return {
    listAvailableTimes,
    listBookings,
    createCheckoutSession,
    confirmCheckoutSession,
    createManualBooking,
    cancelBooking
  };
}

module.exports = {
  HttpError,
  createBookingService,
  dayNameFromIsoDate
};
