# Basketball Booking App

This app is moving from a prototype Express/MySQL setup toward a safer PostgreSQL-backed architecture.

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace every Stripe placeholder with real test-mode values.
3. Start PostgreSQL:

   `docker compose up -d postgres`

4. Start the API:

   `npm start`

5. Start the Next.js frontend in a second terminal:

   `npm run dev:web`

The database schema is loaded from `db/schema.sql` when the local PostgreSQL volume is first created.

The backend runs on `http://localhost:3000`. The Next.js frontend runs on `http://localhost:3001` and proxies API calls to the backend through `BACKEND_URL`.

## Current backend boundaries

- `server.js` starts the HTTP process only.
- `src/http/app.js` owns Express middleware and routes.
- `src/services/bookingService.js` owns booking business rules.
- `src/validation/schemas.js` owns request validation.
- `src/db/pool.js` owns PostgreSQL connections.
- `src/config/env.js` owns environment configuration.

## Safety rules now enforced

- Secrets must come from environment variables.
- Booking inputs are validated before database or Stripe work.
- Checkout creates a pending booking hold before redirecting to Stripe.
- PostgreSQL enforces one active booking per date/time slot.
- Stripe webhook confirmation is idempotent for already-confirmed bookings.
- Admin endpoints can require `x-admin-token` through `ADMIN_API_TOKEN`.

## Next migration steps

1. Convert backend modules to TypeScript.
2. Replace raw SQL migrations with Prisma or Drizzle migrations.
3. Add real admin authentication before exposing the dashboard publicly.
4. Split development, staging, and production environments with separate PostgreSQL databases and Stripe keys.
5. Retire the legacy static HTML/JS files after the Next.js frontend is fully deployed.
