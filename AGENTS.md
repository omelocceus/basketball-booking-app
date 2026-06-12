# AGENTS.md

## Cursor Cloud specific instructions

### What this app is
`basketball-booking-app` — a basketball training session booking app made of three parts:
- **Static frontend** (no build step): `bookings.html`/`bookings.js`/`bookings.css` (customer booking) and `admin.html`/`admin.js`/`admin.css` (admin dashboard). The frontend JS hardcodes the API base `http://localhost:3000`.
- **Express backend**: `server.js` (listens on port 3000).
- **MySQL database**: `booking_app`.

`node_modules` is committed to this repo. `server.js` was previously gitignored; it is now tracked.

### Backend config (hardcoded in `server.js`)
- MySQL: host `localhost`, user `root`, password `Pb27553528!`, database `booking_app`.
- Stripe: a test-mode secret key and price IDs are hardcoded in `server.js`.

### Database setup (required before the backend works)
Start MySQL and create the schema (MySQL 8 is installed in the VM image):
```
sudo service mysql start
```
The backend expects database `booking_app` with two tables:
- `schedule(id, day_of_week VARCHAR, time_slot VARCHAR)` — available slots per weekday (e.g. `day_of_week='Friday'`).
- `bookings(id, name, email, phone, date DATE, time_slot VARCHAR, training_type VARCHAR)`.
`GET /api/available-times?date=` returns `schedule` rows for that date's weekday minus slots already in `bookings`. If the DB/tables/seed data are missing on a fresh VM, recreate them (root password is `Pb27553528!`) and seed `schedule` rows, otherwise the booking page shows no slots.

### Running the app (dev)
The backend does **not** serve the static HTML — run two processes:
```
node server.js                 # API on http://localhost:3000
python3 -m http.server 8080    # serves the static frontend
```
Then open `http://localhost:8080/bookings.html` and `http://localhost:8080/admin.html`. CORS is enabled, so the 8080 pages can call the 3000 API.

### Known caveats (pre-existing, not env issues)
- In `server.js`, `express.json()` is registered **after** the routes, so POST endpoints (`/api/book`, `/create-checkout-session`) receive `undefined` `req.body` and error out. The read endpoints (`GET /api/available-times`, `GET /api/bookings`) work fine.
- `admin.js` calls `DELETE /api/bookings/:id`, but `server.js` has no DELETE route, so the "Cancel" button won't delete.
- Real booking creation flows through Stripe Checkout + the `/webhook` handler, which needs valid Stripe keys/prices.
- Admin date-filter / "Today" stat compare against the raw datetime string returned by MySQL, so they won't match a `YYYY-MM-DD` value.

### Tests / lint
- No tests exist (`npm test` is a placeholder that exits 1). No linter is configured.
