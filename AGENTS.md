# AGENTS.md

## Cursor Cloud specific instructions

### What this repo contains
This is `basketball-booking-app` — a basketball training session booking app. **Only the static frontend is committed**:
- Customer booking page: `bookings.html` + `bookings.js` + `bookings.css`
- Admin dashboard: `admin.html` + `admin.js` + `admin.css`

There is **no build step** — the frontend is plain HTML/CSS/JS.

### Important: the backend is not in the repo
- `server.js` is listed in `.gitignore` and does **not** exist in version control. It has never been committed.
- Therefore `npm start` (which runs `node server.js`, see `package.json`) **will fail** out of the box — there is no `server.js` to run.
- The dependencies in `package.json` (`express`, `mysql2`, `stripe`, `cors`) are backend deps for that local-only `server.js`.

### Running the frontend (dev)
Dependencies install with `npm install`. To view the committed frontend, serve the static files (the frontend JS hardcodes `http://localhost:3000` for its API calls):

```
python3 -m http.server 3000
```

Then open `http://localhost:3000/bookings.html` and `http://localhost:3000/admin.html`. Client-side behavior (form validation, training-type selection, dashboard layout) works without a backend. The logo image (`all aroudn development picture.PNG`) is not committed, so it will not render.

### Full end-to-end requires extra pieces (NOT in repo)
Booking submission, available-time loading, admin listing, and Stripe checkout all call `http://localhost:3000` and require a backend that must be supplied separately:
- A `server.js` Express backend implementing: `GET /api/available-times?date=`, `POST /create-checkout-session`, `GET /api/bookings`, `DELETE /api/bookings/:id`
- A **MySQL** database (driver `mysql2`) with a bookings schema (no schema/SQL file is committed)
- A **Stripe** API key (test mode) for the checkout flow

### Tests / lint
- No tests exist. `npm test` is a placeholder that prints an error and exits 1.
- No linter is configured.
