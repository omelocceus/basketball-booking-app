const assert = require("node:assert/strict");
const test = require("node:test");

const { createBookingService } = require("../src/services/bookingService");

function serviceWithClient(client) {
  return createBookingService({
    db: {
      async withTransaction(work) {
        return work(client);
      },
      async query() {
        return { rowCount: 0, rows: [] };
      }
    },
    stripe: {},
    config: {
      pendingHoldMinutes: 15,
      stripePrices: {
        oncourt: "price_oncourt",
        sand: "price_sand",
        weight: "price_weight"
      },
      appUrl: "http://localhost:3000"
    }
  });
}

test("manual booking maps database slot conflicts to 409 errors", async () => {
  const uniqueViolation = new Error("duplicate key value violates unique constraint");
  uniqueViolation.code = "23505";

  const service = serviceWithClient({
    async query(sql) {
      if (sql.includes("INSERT INTO bookings")) {
        throw uniqueViolation;
      }

      return { rowCount: 0, rows: [] };
    }
  });

  await assert.rejects(
    () =>
      service.createManualBooking({
        name: "Jordan Trainer",
        email: "jordan@example.com",
        date: "2026-06-15",
        time: "09:00",
        trainingType: "oncourt"
      }),
    (err) => err.statusCode === 409 && err.code === "SLOT_TAKEN"
  );
});

test("checkout creates a pending hold before creating Stripe session", async () => {
  const calls = [];
  const service = createBookingService({
    db: {
      async withTransaction(work) {
        return work({
          async query(sql) {
            calls.push(sql);

            if (sql.includes("INSERT INTO bookings")) {
              return { rows: [{ id: 42 }], rowCount: 1 };
            }

            return { rows: [], rowCount: 0 };
          }
        });
      },
      async query(sql) {
        calls.push(sql);
        return { rows: [], rowCount: 1 };
      }
    },
    stripe: {
      checkout: {
        sessions: {
          async create(options) {
            calls.push("stripe");
            assert.equal(options.metadata.bookingId, "42");
            return {
              id: "cs_test_42",
              url: "https://checkout.stripe.test/session"
            };
          }
        }
      }
    },
    config: {
      pendingHoldMinutes: 15,
      stripePrices: {
        oncourt: "price_oncourt",
        sand: "price_sand",
        weight: "price_weight"
      },
      appUrl: "http://localhost:3000"
    }
  });

  const result = await service.createCheckoutSession({
    name: "Jordan Trainer",
    email: "jordan@example.com",
    phone: "555-555-5555",
    date: "2026-06-15",
    time: "09:00",
    trainingType: "oncourt"
  });

  const insertIndex = calls.findIndex((call) => call.includes("INSERT INTO bookings"));
  const stripeIndex = calls.findIndex((call) => call === "stripe");

  assert.equal(result.url, "https://checkout.stripe.test/session");
  assert.ok(insertIndex > -1);
  assert.ok(stripeIndex > insertIndex);
});
