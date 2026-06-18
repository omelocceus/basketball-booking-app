# Basketball Booking App

This app is moving from a prototype Express/MySQL setup toward a safer PostgreSQL-backed architecture.

For a beginner-friendly walkthrough of what changed and why, read `docs/changes-explained.md`.

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace every Stripe placeholder with real test-mode values.
3. Start PostgreSQL:

   `docker compose up -d postgres`

4. Start the API:

   `npm start`

The database schema is loaded from `db/schema.sql` when the local PostgreSQL volume is first created.

The backend and vanilla HTML/CSS/JS frontend run together on `http://localhost:3000`.

To refresh the schedule in an already-created local database, run:

`docker compose exec -T postgres psql -U booking_app -d booking_app < db/seed-schedule.sql`

## Current backend boundaries

- `server.js` starts the HTTP process only.
- `src/http/app.js` owns Express middleware and routes.
- `src/services/bookingService.js` owns booking business rules.
- `src/validation/schemas.js` owns request validation.
- `src/db/pool.js` owns PostgreSQL connections.
- `src/config/env.js` owns environment configuration.
- `db/seed-schedule.sql` refreshes the weekly availability schedule for existing databases.
- `bookings.html`, `bookings.css`, and `bookings.js` own the customer booking UI.
- `admin.html`, `admin.css`, and `admin.js` own the admin dashboard UI.

## Safety rules now enforced

- Secrets must come from environment variables.
- Booking inputs are validated before database or Stripe work.
- Checkout creates a pending booking hold before redirecting to Stripe.
- PostgreSQL enforces one active booking per date/time slot.
- Stripe webhook confirmation is idempotent for already-confirmed bookings.
- Admin endpoints use a signed `HttpOnly` cookie after `/admin.html` login.
- `ADMIN_API_TOKEN` is optional for non-browser admin API clients.

## Frontend approach

The app currently ships with plain HTML, CSS, and JavaScript so deployment stays easy to understand:

- HTML files define page structure.
- CSS files define the visual design.
- JavaScript files own page state, API calls, and rendering.
- Browser code calls same-origin API paths like `/api/available-times`, so deployment does not depend on hardcoded local URLs.
- Booking dates and user-facing time labels are presented in Eastern Time.

This keeps the frontend simple while the backend carries the production-critical pieces: validation, PostgreSQL consistency, Stripe payment flow, and security middleware.

## Admin login

Set these values in `.env` before using `/admin.html`:

- `ADMIN_PASSWORD`: the password you type into the admin login form.
- `ADMIN_SESSION_SECRET`: a long random value used to sign the admin session cookie.
- `ADMIN_SESSION_TTL_HOURS`: how long the admin login lasts.

Generate a strong session secret with:

`openssl rand -hex 32`

The admin password is never stored in browser local storage. After login, the backend sets an `HttpOnly` cookie that browser JavaScript cannot read.

## Next migration steps

1. Add real admin authentication before exposing the dashboard publicly.
2. Split development, staging, and production environments with separate PostgreSQL databases and Stripe keys.
3. Add deployment configuration for the chosen host.
4. Replace raw SQL migrations with Prisma or Drizzle migrations.
5. Revisit Next.js/React/TypeScript after the vanilla deployment is stable.
