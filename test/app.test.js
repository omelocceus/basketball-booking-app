const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");

const { createApp } = require("../src/http/app");

function baseConfig(overrides = {}) {
  return {
    nodeEnv: "test",
    appUrl: "http://localhost:3000",
    clientOrigins: ["http://localhost:3000"],
    stripeWebhookSecret: "whsec_test",
    stripePrices: {
      oncourt: "price_oncourt",
      sand: "price_sand",
      weight: "price_weight"
    },
    pendingHoldMinutes: 15,
    allowManualBookings: false,
    adminApiToken: undefined,
    ...overrides
  };
}

function fakeStripe(event) {
  return {
    webhooks: {
      constructEvent() {
        return event;
      }
    }
  };
}

test("health check returns ok", async () => {
  const app = createApp({
    config: baseConfig(),
    bookingService: {},
    stripe: fakeStripe()
  });

  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});

test("booking stylesheet is served with CSS content type", async () => {
  const app = createApp({
    config: baseConfig(),
    bookingService: {},
    stripe: fakeStripe()
  });

  const response = await request(app).get("/bookings.css");

  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/css/);
  assert.match(response.text, /linear-gradient/);
});

test("development CSP does not upgrade localhost asset requests", async () => {
  const app = createApp({
    config: baseConfig({ nodeEnv: "development" }),
    bookingService: {},
    stripe: fakeStripe()
  });

  const response = await request(app).get("/");
  const csp = response.headers["content-security-policy"];

  assert.equal(response.status, 200);
  assert.ok(csp);
  assert.ok(!csp.includes("upgrade-insecure-requests"));
});

test("available times validates required date", async () => {
  const app = createApp({
    config: baseConfig(),
    bookingService: {
      async listAvailableTimes() {
        const err = new Error("date: Required");
        err.statusCode = 400;
        err.code = "VALIDATION_ERROR";
        throw err;
      }
    },
    stripe: fakeStripe()
  });

  const response = await request(app).get("/api/available-times");

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "VALIDATION_ERROR");
});

test("checkout route returns the Stripe checkout URL", async () => {
  const app = createApp({
    config: baseConfig(),
    bookingService: {
      async createCheckoutSession(body) {
        assert.equal(body.trainingType, "oncourt");
        return { url: "https://checkout.stripe.test/session" };
      }
    },
    stripe: fakeStripe()
  });

  const response = await request(app)
    .post("/create-checkout-session")
    .send({
      name: "Jordan Trainer",
      email: "jordan@example.com",
      phone: "555-555-5555",
      date: "2026-06-15",
      time: "09:00",
      trainingType: "oncourt"
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.url, "https://checkout.stripe.test/session");
});

test("manual booking endpoint is disabled by default", async () => {
  const app = createApp({
    config: baseConfig(),
    bookingService: {},
    stripe: fakeStripe()
  });

  const response = await request(app).post("/api/book").send({});

  assert.equal(response.status, 403);
});

test("admin routes require token when configured", async () => {
  const app = createApp({
    config: baseConfig({ adminApiToken: "secret-token" }),
    bookingService: {
      async listBookings() {
        return [{ id: 1, name: "Jordan" }];
      }
    },
    stripe: fakeStripe()
  });

  const missingToken = await request(app).get("/api/bookings");
  const wrongToken = await request(app)
    .get("/api/bookings")
    .set("x-admin-token", "wrong");
  const validToken = await request(app)
    .get("/api/bookings")
    .set("x-admin-token", "secret-token");

  assert.equal(missingToken.status, 401);
  assert.equal(wrongToken.status, 403);
  assert.equal(validToken.status, 200);
  assert.equal(validToken.body[0].name, "Jordan");
});

test("webhook confirms checkout sessions using raw body route", async () => {
  let confirmedSessionId;
  const app = createApp({
    config: baseConfig(),
    bookingService: {
      async confirmCheckoutSession(session) {
        confirmedSessionId = session.id;
      }
    },
    stripe: fakeStripe({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: { bookingId: "1" }
        }
      }
    })
  });

  const response = await request(app)
    .post("/webhook")
    .set("stripe-signature", "test-signature")
    .set("content-type", "application/json")
    .send(Buffer.from("{}"));

  assert.equal(response.status, 200);
  assert.equal(confirmedSessionId, "cs_test_123");
});
