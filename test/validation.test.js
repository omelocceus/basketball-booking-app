const assert = require("node:assert/strict");
const test = require("node:test");

const {
  checkoutSchema,
  parseOrThrow
} = require("../src/validation/schemas");
const { dayNameFromIsoDate } = require("../src/services/bookingService");

function futureDate(daysFromNow = 7) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

test("checkout validation accepts valid customer booking input", () => {
  const parsed = parseOrThrow(checkoutSchema, {
    name: "Jordan Trainer",
    email: "jordan@example.com",
    phone: "+1 (555) 555-5555",
    date: futureDate(),
    time: "09:00",
    trainingType: "sand"
  });

  assert.equal(parsed.trainingType, "sand");
});

test("checkout validation rejects invalid date and training type", () => {
  assert.throws(
    () =>
      parseOrThrow(checkoutSchema, {
        name: "J",
        email: "not-email",
        phone: "abc",
        date: "2026-02-31",
        time: "",
        trainingType: "unknown"
      }),
    (err) => err.code === "VALIDATION_ERROR"
  );
});

test("checkout validation rejects past dates", () => {
  assert.throws(
    () =>
      parseOrThrow(checkoutSchema, {
        name: "Jordan Trainer",
        email: "jordan@example.com",
        phone: "+1 (555) 555-5555",
        date: "2020-01-01",
        time: "09:00",
        trainingType: "sand"
      }),
    (err) => err.code === "VALIDATION_ERROR"
  );
});

test("day name calculation is stable across local time zones", () => {
  assert.equal(dayNameFromIsoDate("2026-06-15"), "Monday");
});
