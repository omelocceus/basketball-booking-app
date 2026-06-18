# Changes Explained

This branch keeps the frontend as plain HTML, CSS, and JavaScript, but makes the backend safer and easier to deploy.

## What changed at a glance

- `server.js` is now only the process starter.
- `src/http/app.js` owns Express routes, middleware, security headers, Stripe webhooks, and admin login.
- `src/config/env.js` owns environment variables and fails fast when required production values are missing.
- `src/db/pool.js` owns PostgreSQL connection pooling and transactions.
- `src/validation/schemas.js` owns request validation.
- `src/services/bookingService.js` owns booking, checkout, availability, cancellation, and Stripe confirmation rules.
- `db/schema.sql` creates PostgreSQL tables, seed schedule slots, and the no-double-booking index.
- `bookings.html`, `bookings.css`, and `bookings.js` remain the customer booking page.
- `admin.html`, `admin.css`, and `admin.js` remain the admin dashboard, now with password login and logout.
- `.env.example` lists the environment variables you need locally and in production.
- `docker-compose.yml` starts local PostgreSQL.
- `test/*.test.js` verifies important backend behavior.

## Why the backend was split up

The old backend mixed database setup, API routes, Stripe, validation, and booking logic in one file. That works for a prototype, but it gets hard to debug and risky to deploy.

The new backend separates jobs:

- Routes decide what endpoint was called.
- Validation checks whether input is safe and shaped correctly.
- Services decide business rules.
- Database code handles connections and transactions.
- Config reads secrets from environment variables.

This makes the app easier to test, easier to deploy, and safer to change.

## `src/config/env.js`

This file loads `.env` with `dotenv.config()`.

Important blocks:

- `parseBoolean()` converts text like `"true"` or `"1"` into real booleans.
- `parseCsv()` converts comma-separated origins into an array for CORS.
- `requiredNamesFor()` lists variables the app must have before it starts.
- `buildConfig()` creates one config object used by the rest of the app.

Why it helps:

- Secrets are not hardcoded.
- Production fails early if important values are missing.
- The rest of the app reads `config.databaseUrl` or `config.stripePrices` instead of touching `process.env` everywhere.

## `src/db/pool.js`

This file creates a PostgreSQL connection pool using `pg`.

Important blocks:

- `createPool()` builds the pool from `DATABASE_URL`.
- `getPool()` lazily creates one shared pool.
- `query()` runs a normal SQL query.
- `withTransaction()` runs `BEGIN`, executes your work, then `COMMIT`s or `ROLLBACK`s.
- `closePool()` shuts down database connections during graceful server shutdown or tests.

Why it helps:

- Pooling avoids opening a new database connection for every request.
- Transactions let several database operations succeed or fail together.
- Rollback prevents half-saved booking state.

## `src/validation/schemas.js`

This file uses Zod to validate request data.

Important blocks:

- `isoDate` accepts only real `YYYY-MM-DD` dates.
- `timeSlot` requires a non-empty time string.
- `customer` validates name, email, and phone.
- `trainingType` allows only `oncourt`, `sand`, or `weight`.
- `checkoutSchema` validates checkout requests.
- `availableTimesQuerySchema` validates `/api/available-times`.
- `bookingIdParamsSchema` validates booking IDs for admin cancellation.
- `parseOrThrow()` returns clean data or throws a `400` validation error.

Why it helps:

- Bad input is rejected before it reaches Stripe or PostgreSQL.
- Validation rules live in one place instead of being repeated in routes.

## `src/services/bookingService.js`

This file owns booking business rules.

Important blocks:

- `expirePendingBookings()` marks abandoned checkout holds as expired.
- `listAvailableTimes()` returns schedule slots that do not already have pending or confirmed bookings.
- `listBookings()` returns active admin-visible bookings.
- `createPendingBooking()` creates a temporary hold before redirecting to Stripe.
- `createCheckoutSession()` creates a Stripe Checkout session using the held booking ID.
- `confirmCheckoutSession()` confirms the booking after Stripe sends a verified webhook.
- `createManualBooking()` exists only if `ALLOW_MANUAL_BOOKINGS=true`.
- `cancelBooking()` marks a booking as cancelled instead of deleting history.

Why it helps:

- The race-condition fix lives here and in PostgreSQL.
- The app holds a slot before checkout, then confirms only after payment.
- Unique constraint errors become friendly `409 SLOT_TAKEN` responses.

## `db/schema.sql`

This file defines the PostgreSQL database.

Important blocks:

- `schedule` stores what times are generally available for each weekday.
- `bookings` stores customer booking data, status, Stripe session, amount, and timestamps.
- `CHECK` constraints restrict training types and statuses.
- `bookings_one_active_slot` prevents two pending or confirmed bookings for the same date and time.
- The `INSERT INTO schedule` block seeds weekday time slots.

Why it helps:

- PostgreSQL protects the most important rule: one active booking per time slot.
- Even if two users click at the same time, the database blocks double booking.

## `src/http/app.js`

This file creates the Express app.

Important blocks:

- `helmetOptions()` configures security headers.
- `/webhook` uses `express.raw()` so Stripe signature verification works.
- CORS only allows configured client origins.
- `express.json({ limit: "1mb" })` limits JSON body size.
- `rateLimit()` slows down repeated requests.
- Static routes serve the vanilla HTML/CSS/JS files.
- Public booking routes call the booking service.
- Admin routes require login.

Admin auth blocks:

- `parseCookies()` reads cookies from the request header.
- `signValue()` signs a session payload with HMAC SHA-256.
- `timingSafeEqualString()` compares secrets without leaking timing information.
- `createAdminSessionValue()` creates a signed payload with role and expiration.
- `verifyAdminSession()` checks cookie signature and expiration.
- `adminCookieOptions()` sets `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- `/api/admin/login` verifies the password and sets the cookie.
- `/api/admin/logout` clears the cookie.
- `requireAdminAuth()` blocks admin APIs unless the cookie or optional API token is valid.

Why it helps:

- The admin password is not stored in browser local storage.
- JavaScript cannot read the `HttpOnly` session cookie.
- Logout removes the cookie.
- The dashboard survives refresh because the browser sends the cookie automatically.

## `bookings.js`

This file keeps the customer booking page in plain JavaScript.

Important blocks:

- `elements` stores references to HTML elements.
- `bookingState` stores the selected time.
- `getBookingForm()` reads and trims the current form values.
- `readJsonResponse()` turns failed API responses into normal JavaScript errors.
- `renderTimeSlots()` creates time buttons safely with DOM APIs.
- `renderTimes()` fetches available times from `/api/available-times`.
- `startCheckout()` validates the form, calls `/create-checkout-session`, and redirects to Stripe.

Why it helps:

- The page no longer depends on hardcoded `localhost` API URLs.
- The JS is broken into small functions instead of one long click handler.
- DOM nodes are created with `createElement()` instead of inserting HTML strings.

## `admin.js`

This file keeps the admin dashboard in plain JavaScript.

Important blocks:

- `elements` stores references to dashboard and login elements.
- `showLogin()` hides the dashboard and shows the login panel.
- `showDashboard()` hides the login panel and shows the dashboard.
- `apiUrl()` builds same-origin API paths such as `/api/admin/login`.
- `isServedByHttp()` checks that the page was opened through the Node server.
- `login()` sends the password to `/api/admin/login`.
- `logout()` calls `/api/admin/logout` and returns to the login panel.
- `checkSession()` asks the backend whether the cookie is still valid.
- `loadBookings()` fetches bookings after login.
- `renderBookings()` creates table rows with DOM APIs.
- `updateStats()` calculates total bookings, today's bookings, and revenue.

Why it helps:

- The admin secret is no longer saved in `localStorage`.
- Refreshing the page checks the server-side cookie session.
- Customer booking data is inserted with `textContent`, reducing XSS risk.

If the browser says "The string did not match the expected pattern", it usually means the page was opened from the wrong place. Open `http://localhost:3000/admin.html`, not the raw `admin.html` file from Finder.

## `admin.html` and `admin.css`

The admin page now has two main states:

- Login panel.
- Dashboard.

The `hidden` attribute controls which one is visible.

Why it helps:

- The same page can show login first, then dashboard after authentication.
- The UI remains plain HTML/CSS/JS and easy to understand before deployment.

## `docker-compose.yml`

This starts a local PostgreSQL database.

Important blocks:

- `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` define local credentials.
- Port `5432:5432` exposes Postgres to your app.
- `./db/schema.sql` is mounted into Docker's startup folder.
- The healthcheck tells Docker whether Postgres is ready.

Why it helps:

- Everyone gets the same local database setup.
- You do not need to manually create the local database tables.

## `.env.example`

This is the safe template for your private `.env`.

Important values:

- `DATABASE_URL` tells the app where PostgreSQL is.
- `STRIPE_SECRET_KEY` lets the backend create Checkout sessions.
- `STRIPE_WEBHOOK_SECRET` verifies Stripe webhook events.
- `STRIPE_PRICE_*` maps training types to Stripe prices.
- `ADMIN_PASSWORD` is what you type on `/admin.html`.
- `ADMIN_SESSION_SECRET` signs the admin login cookie.
- `ADMIN_SESSION_TTL_HOURS` controls how long admin login lasts.

Why it helps:

- The template shows what you need without committing real secrets.

## Tests

The test files verify:

- Health endpoint works.
- CSS is served.
- CSP does not break local frontend assets.
- Validation returns `400`.
- Manual booking is disabled by default.
- Admin login sets an `HttpOnly` cookie.
- Logout clears the cookie.
- Stripe webhook route uses the raw body.
- Duplicate slot conflicts map to friendly errors.

Why it helps:

- You can change the app and quickly check that important behavior still works.

Run:

`npm run check`

Then:

`npm test`

## What was intentionally not done yet

- Real username/password account system.
- Password hashing in a database.
- Admin roles.
- Pagination for large booking lists.
- Deployment-specific config for a chosen host.
- Prisma/Drizzle migrations.
- React/Next.js frontend.

Those can come later after the vanilla deployment is stable.
