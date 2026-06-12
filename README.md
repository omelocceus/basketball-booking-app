# Basketball Booking App

This app is moving from a prototype Express/MySQL setup toward a safer PostgreSQL-backed architecture.

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace every Stripe placeholder with real test-mode values.
3. Start PostgreSQL:

   `docker compose up -d postgres`

4. Start the API:

   `npm start`

The database schema is loaded from `db/schema.sql` when the local PostgreSQL volume is first created.

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

1. Move static HTML/JS into Next.js pages and React components.
2. Convert backend modules to TypeScript.
3. Replace raw SQL migrations with Prisma or Drizzle migrations.
4. Add real admin authentication before exposing the dashboard publicly.
5. Split development, staging, and production environments with separate PostgreSQL databases and Stripe keys.
