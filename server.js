const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const Stripe = require("stripe");


const app = express();
app.use(cors());


// setting up connection to database

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Pb27553528!",
  database: "booking_app"
});

const stripe = Stripe("sk_test_51TZik4Fz0soklAZ0rZHOWagmRzyYk7LCNVQ5lwCru7yJwE79z1f0DcY09YXPmCovhQU7x2tREHtLO8zZdAke6sPv00XG893pD9");

// actual connetion to database
db.connect((err) => {
  if (err) {
    console.log(" DB connection failed:", err.message);
    return;
  }
  console.log("Connected to MySQL!");
});


// see available times 

app.get("/api/available-times", (req, res) => {
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: "Date is required" });

  const dayName = new Date(date + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'long' });

  const sql = `
    SELECT s.time_slot
    FROM schedule s
    WHERE s.day_of_week = ?
    AND s.time_slot NOT IN (
      SELECT time_slot FROM bookings WHERE date = ?
    )
  `;

  db.query(sql, [dayName, date], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// booking portion 

app.post("/api/book", (req, res) => {
  const { name, email, date, time } = req.body;

  // Validation
  if (!name || !email || !date || !time) {
    return res.status(400).json({
      error: "All fields are required"
    });
  }

  // Check if already booked
  const checkSql = `
    SELECT * FROM bookings
    WHERE date = ? AND time_slot = ?
  `;

  db.query(checkSql, [date, time], (err, results) => {

    if (err) {
      return res.status(500).json({
        error: err.message
      });
    }

    // Slot already booked
    if (results.length > 0) {
      return res.status(400).json({
        error: "This time slot is already booked."
      });
    }

    // Insert booking
    const insertSql = `
      INSERT INTO bookings (name, email, date, time_slot)
      VALUES (?, ?, ?, ?)
    `;

    db.query(insertSql,
      [name, email, date, time],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          success: true,
          message: "Booking successful!"
        });
      }
    );
  });
});
// GET method for Trainer to see bookings

app.get("/api/bookings", (req, res) => {

  const sql = `
    SELECT * FROM bookings
    ORDER BY date ASC
  `;

  db.query(sql, (err, results) => {

    if (err) {
      return res.status(500).json({
        error: err.message
      });
    }

    res.json(results);
  });
});
// POST route for sercure booking 

app.post("/create-checkout-session", async (req, res) => {

  try {

    const {
      name,
      email,
      phone,
      date,
      time,
      trainingType
    } = req.body;

    // Stripe Price IDs
    const prices = {

      oncourt: "price_1TZjPFFz0soklAZ0Ch1sYUKF",

      sand: "price_1Ta1XtFz0soklAZ0A7zkNr4T",

      weight: "price_1Ta1gdFz0soklAZ0rJOBrxuy"

    };

    const selectedPrice = prices[trainingType];

    if (!selectedPrice) {

      return res.status(400).json({
        error: "Invalid training type"
      });

    }

    const session =
      await stripe.checkout.sessions.create({

        payment_method_types: ['card'],

        mode: 'payment',

        customer_email: email,

        line_items: [
          {
            price: selectedPrice,
            quantity: 1
          }
        ],

        // Save temporary booking data
        metadata: {
          name,
          email,
          phone,
          date,
          time,
          trainingType
        },

        success_url:
          'http://localhost:3000/success.html',

        cancel_url:
          'http://localhost:3000/cancel.html'

      });

    res.json({
      url: session.url
    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: err.message
    });

  }

});

app.post('/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {

    const sig = req.headers['stripe-signature'];

    let event;

    try {

      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        'whsec_b03a0349a60be9631c7255eb0fd797def1a69557ccdd106928e6c18fb3c47774'
      );

    } catch (err) {

      console.log(err.message);

      return res.sendStatus(400);

    }

    // Payment successful
    if (event.type === 'checkout.session.completed') {

      const session = event.data.object;

      const {
        name,
        email,
        phone,
        date,
        time,
        trainingType
      } = session.metadata;

      // CHECK IF SLOT ALREADY EXISTS
      const checkSql = `
        SELECT * FROM bookings
        WHERE date = ? AND time_slot = ?
      `;

      db.query(
        checkSql,
        [date, time],
        (err, results) => {

          if (err) {
            console.log(err);
            return;
          }

          // SLOT ALREADY BOOKED
          if (results.length > 0) {

            console.log("Slot already booked");

            return;

          }

          // SAVE BOOKING ONLY AFTER PAYMENT
          const insertSql = `
            INSERT INTO bookings
            (
              name,
              email,
              phone,
              date,
              time_slot,
              training_type
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `;

          db.query(
            insertSql,
            [
              name,
              email,
              phone,
              date,
              time,
              trainingType
            ],
            (err) => {

              if (err) {

                console.log(err);

              } else {

                console.log("Booking saved!");

              }

            }
          );

        }
      );

    }

    res.sendStatus(200);

  }
);

app.use(express.json());

app.listen(3000, () => console.log("Server running on port 3000"));