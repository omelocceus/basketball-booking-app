const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");
const Stripe = require("stripe");

const { config: defaultConfig } = require("../config/env");
const db = require("../db/pool");
const { createBookingService } = require("../services/bookingService");

function originAllowed(config, origin) {
  if (!origin) return true;
  return config.clientOrigins.includes(origin);
}

function requireAdminAuth(config) {
  return (req, res, next) => {
    if (!config.adminApiToken) {
      if (config.nodeEnv === "production") {
        return res.status(503).json({ error: "Admin API token is not configured." });
      }

      return next();
    }

    const token = req.get("x-admin-token");

    if (!token) {
      return res.status(401).json({ error: "Admin token is required." });
    }

    if (token !== config.adminApiToken) {
      return res.status(403).json({ error: "Admin token is invalid." });
    }

    return next();
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
      "/success.html",
      "/cancel.html"
    ],
    (req, res) => {
      sendRootFile(res, req.path.slice(1));
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
