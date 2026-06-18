const dotenv = require("dotenv");

dotenv.config();

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function requiredNamesFor(env) {
  if (env.NODE_ENV === "test") return [];

  const names = [
    "DATABASE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "APP_URL",
    "STRIPE_PRICE_ONCOURT",
    "STRIPE_PRICE_SAND",
    "STRIPE_PRICE_WEIGHT"
  ];

  if (env.NODE_ENV === "production") {
    names.push("ADMIN_PASSWORD", "ADMIN_SESSION_SECRET");
  }

  return names;
}

function buildConfig(env = process.env) {
  const missing = requiredNamesFor(env).filter((name) => !env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  const appUrl = env.APP_URL || "http://localhost:3000";

  return {
    nodeEnv: env.NODE_ENV || "development",
    port: Number(env.PORT || 3000),
    appUrl,
    clientOrigins: parseCsv(env.CLIENT_ORIGINS || appUrl),
    databaseUrl: env.DATABASE_URL,
    databaseSsl:
      parseBoolean(env.DATABASE_SSL) ||
      (env.NODE_ENV === "production" && env.DATABASE_SSL !== "false"),
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    stripePrices: {
      oncourt: env.STRIPE_PRICE_ONCOURT,
      sand: env.STRIPE_PRICE_SAND,
      weight: env.STRIPE_PRICE_WEIGHT
    },
    adminApiToken: env.ADMIN_API_TOKEN,
    adminPassword: env.ADMIN_PASSWORD,
    adminSessionSecret: env.ADMIN_SESSION_SECRET,
    adminSessionTtlHours: Number(env.ADMIN_SESSION_TTL_HOURS || 8),
    allowManualBookings: parseBoolean(env.ALLOW_MANUAL_BOOKINGS),
    pendingHoldMinutes: Number(env.PENDING_HOLD_MINUTES || 15)
  };
}

module.exports = {
  buildConfig,
  config: buildConfig()
};
