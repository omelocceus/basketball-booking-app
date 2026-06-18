const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");
const Stripe = require("stripe");

const { config: defaultConfig } = require("../config/env");
const db = require("../db/pool");
const { createBookingService } = require("../services/bookingService");

const ADMIN_SESSION_COOKIE = "admin_session";

function originAllowed(config, origin) {
  if (!origin) return true;
  return config.clientOrigins.includes(origin);
}

// Express does not parse cookies by default, so this reads the raw Cookie header.
function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separatorIndex = cookie.indexOf("=");

      if (separatorIndex === -1) return cookies;

      const name = decodeURIComponent(cookie.slice(0, separatorIndex));
      const value = decodeURIComponent(cookie.slice(separatorIndex + 1));
      cookies[name] = value;
      return cookies;
    }, {});
}

// Sign session payloads so users cannot edit their cookie and become admin.
function signValue(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

// Use a timing-safe comparison for secrets so attackers cannot learn values byte by byte.
function timingSafeEqualString(left, right) {
  const leftBuffer = Buffer.from(left || "");
  const rightBuffer = Buffer.from(right || "");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function adminAuthConfigured(config) {
  return Boolean(config.adminPassword && config.adminSessionSecret);
}

// The cookie stores only a role and expiration; the signature proves the server created it.
function createAdminSessionValue(config, now = Date.now()) {
  const expiresAt = now + config.adminSessionTtlHours * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ role: "admin", expiresAt })).toString("base64url");
  const signature = signValue(payload, config.adminSessionSecret);

  return `${payload}.${signature}`;
}

// Verify the admin cookie signature and expiration before allowing dashboard API access.
function verifyAdminSession(req, config) {
  if (!adminAuthConfigured(config)) {
    return false;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionValue = cookies[ADMIN_SESSION_COOKIE];

  if (!sessionValue) {
    return false;
  }

  const [payload, signature] = sessionValue.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = signValue(payload, config.adminSessionSecret);

  if (!timingSafeEqualString(signature, expectedSignature)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.role === "admin" && Number(session.expiresAt) > Date.now();
  } catch (err) {
    return false;
  }
}

// HttpOnly keeps browser JavaScript from reading the session cookie.
function adminCookieOptions(config) {
  const maxAgeSeconds = config.adminSessionTtlHours * 60 * 60;
  const attributes = [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`
  ];

  if (config.nodeEnv === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function clearAdminCookieOptions(config) {
  const attributes = ["Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];

  if (config.nodeEnv === "production") {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

// Optional fallback for scripts or API tools; browser admin login should use cookies.
function hasValidAdminToken(req, config) {
  const token = req.get("x-admin-token");
  return Boolean(
    config.adminApiToken &&
      token &&
      timingSafeEqualString(token, config.adminApiToken)
  );
}

function requireAdminAuth(config) {
  return (req, res, next) => {
    if (!adminAuthConfigured(config) && !config.adminApiToken) {
      if (config.nodeEnv === "production") {
        return res.status(503).json({ error: "Admin authentication is not configured." });
      }

      return next();
    }

    if (verifyAdminSession(req, config) || hasValidAdminToken(req, config)) {
      return next();
    }

    if (config.adminApiToken && req.get("x-admin-token")) {
      return res.status(403).json({ error: "Admin token is invalid." });
    }

    return res.status(401).json({ error: "Admin login is required." });
  };
}

function sendError(res, err) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

function sendRootFile(res, fileName) {
  res.sendFile(path.join(process.cwd(), fileName));
}

function helmetOptions(config) {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests:
          config.nodeEnv === "production" ? [] : null
      }
    }
  };
}

function createApp(options = {}) {
  const appConfig = options.config || defaultConfig;
  const stripe =
    options.stripe ||
    Stripe(appConfig.stripeSecretKey || "sk_test_missing_for_tests");
  const bookingService =
    options.bookingService ||
    createBookingService({
      db,
      stripe,
      config: appConfig
    });

  const app = express();
  app.disable("x-powered-by");

  app.use(helmet(helmetOptions(appConfig)));

  app.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];

      try {
        const event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          appConfig.stripeWebhookSecret
        );

        if (event.type === "checkout.session.completed") {
          await bookingService.confirmCheckoutSession(event.data.object);
        }

        return res.sendStatus(200);
      } catch (err) {
        console.error(err.message);
        return res.sendStatus(400);
      }
    }
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (originAllowed(appConfig, origin)) {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
      }
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false
    })
  );

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/admin/session", (req, res) => {
    res.json({ authenticated: verifyAdminSession(req, appConfig) });
  });

  app.post("/api/admin/login", (req, res) => {
    if (!adminAuthConfigured(appConfig)) {
      return res.status(503).json({ error: "Admin login is not configured." });
    }

    const password = req.body && req.body.password;

    if (
      typeof password !== "string" ||
      !timingSafeEqualString(password, appConfig.adminPassword)
    ) {
      return res.status(401).json({ error: "Invalid admin password." });
    }

    const sessionValue = createAdminSessionValue(appConfig);
    res.setHeader(
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(sessionValue)}; ${adminCookieOptions(appConfig)}`
    );
    return res.json({ success: true });
  });

  app.post("/api/admin/logout", (req, res) => {
    res.setHeader(
      "Set-Cookie",
      `${ADMIN_SESSION_COOKIE}=; ${clearAdminCookieOptions(appConfig)}`
    );
    return res.json({ success: true });
  });

  app.get("/", (req, res) => {
    sendRootFile(res, "bookings.html");
  });

  app.get(
    [
      "/bookings.html",
      "/bookings.js",
      "/bookings.css",
      "/admin.html",
      "/admin.js",
      "/admin.css",
      "/success",
      "/success.html",
      "/cancel",
      "/cancel.html"
    ],
    (req, res) => {
      const fileName =
        req.path === "/success"
          ? "success.html"
          : req.path === "/cancel"
            ? "cancel.html"
            : req.path.slice(1);

      sendRootFile(res, fileName);
    }
  );

  app.get("/all%20aroudn%20development%20picture.PNG", (req, res) => {
    sendRootFile(res, "all aroudn development picture.PNG");
  });

  app.get("/api/available-times", async (req, res) => {
    try {
      const times = await bookingService.listAvailableTimes(req.query);
      res.json(times);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/api/book", async (req, res) => {
    if (!appConfig.allowManualBookings) {
      return res.status(403).json({
        error: "Manual bookings are disabled. Use checkout instead."
      });
    }

    try {
      const result = await bookingService.createManualBooking(req.body);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get("/api/bookings", requireAdminAuth(appConfig), async (req, res) => {
    try {
      const bookings = await bookingService.listBookings();
      res.json(bookings);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.delete("/api/bookings/:id", requireAdminAuth(appConfig), async (req, res) => {
    try {
      const result = await bookingService.cancelBooking(req.params);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post("/create-checkout-session", async (req, res) => {
    try {
      const result = await bookingService.createCheckoutSession(req.body);
      res.json(result);
    } catch (err) {
      sendError(res, err);
    }
  });

  app.use((err, req, res, next) => {
    if (err.message === "Not allowed by CORS") {
      return res.status(403).json({ error: err.message });
    }

    return next(err);
  });

  return app;
}

module.exports = {
  createApp,
  requireAdminAuth
};
