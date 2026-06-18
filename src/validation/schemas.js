const { z } = require("zod");

const BOOKING_TIME_ZONE = "America/New_York";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && value === date.toISOString().slice(0, 10);
  }, "Date must be a real calendar date");

function todayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

// Backend validation repeats the Eastern Time browser rule so API callers cannot book past dates.
const bookableDate = isoDate.refine(
  (value) => value >= todayIsoDate(),
  "Date must be today or in the future"
);

const timeSlot = z
  .string()
  .trim()
  .min(1, "Time is required")
  .max(30, "Time slot is too long");

const customer = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[0-9+().\-\s]+$/, "Phone number contains invalid characters")
};

const trainingType = z.enum(["oncourt", "sand", "weight"]);

const checkoutSchema = z.object({
  ...customer,
  date: bookableDate,
  time: timeSlot,
  trainingType
});

const manualBookingSchema = z.object({
  name: customer.name,
  email: customer.email,
  date: bookableDate,
  time: timeSlot,
  trainingType: trainingType.default("oncourt")
});

const availableTimesQuerySchema = z.object({
  date: bookableDate
});

const bookingIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

function parseOrThrow(schema, value) {
  const result = schema.safeParse(value);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");

    const error = new Error(message);
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    throw error;
  }

  return result.data;
}

module.exports = {
  checkoutSchema,
  manualBookingSchema,
  availableTimesQuerySchema,
  bookingIdParamsSchema,
  parseOrThrow
};
