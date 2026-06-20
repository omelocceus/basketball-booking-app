# Deploying to Render

This project is prepared to deploy to Render as a Web Service with a managed Postgres database. These notes walk you through the exact steps, environment variables, and commands to get the app running safely.

## Quick checklist
1. Create a Render account and connect your GitHub account: https://render.com
2. Create a new Web Service on Render and point it to this repository and the `getting-ready-to-deploy` branch.
   - Build command: `npm ci`
   - Start command: `npm start` (or use the included Procfile)
   - Environment: Node (choose 18+)
3. Provision a managed PostgreSQL database on Render (or use Supabase/Neon) and copy the `DATABASE_URL`.
4. In your Render Web Service → Environment, add the environment variables listed below (use values from `.env.example` as a template).
5. Run `schema.sql` against the Postgres database (Render DB Console or `psql`).
6. Deploy the service and wait for the build to finish.
7. Register a Stripe webhook pointing to `https://<your-render-url>/webhook` and copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in Render.
8. Smoke test the API endpoints.

---

## Required environment variables
Use `.env.example` for reference. In Render, set the following for a production deployment:

- NODE_ENV=production
- DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<db>
- DATABASE_SSL=true
- APP_URL=https://<your-render-url>.onrender.com
- CLIENT_ORIGINS=https://<your-frontend-host>
- STRIPE_SECRET_KEY=sk_live_xxx_or_sk_test_xxx
- STRIPE_WEBHOOK_SECRET=whsec_xxx
- STRIPE_PRICE_ONCOURT=price_xxx
- STRIPE_PRICE_SAND=price_xxx
- STRIPE_PRICE_WEIGHT=price_xxx
- ADMIN_PASSWORD=<strong-password>
- ADMIN_SESSION_SECRET=<long-random-string>
- ADMIN_SESSION_TTL_HOURS=8
- ADMIN_API_TOKEN=optional-api-token-for-non-browser-admin-clients
- ALLOW_MANUAL_BOOKINGS=false
- PENDING_HOLD_MINUTES=15

Notes:
- Keep all secrets out of source control. Use Render's Environment tab to store values.
- If you are using Render-managed Postgres, leave `DATABASE_SSL=true`.

---

## Running the schema
After creating the Postgres database, run the SQL in `schema.sql` (already added to the branch).

From your machine (if you have `psql`):

```bash
psql "${DATABASE_URL}" -f schema.sql
```

Or use Render DB Console and paste the contents of `schema.sql` and execute.

---

## Stripe setup
1. In Stripe Dashboard → Developers → Webhooks → Add endpoint.
   - Endpoint URL: `https://<your-render-url>/webhook`
   - Events: `checkout.session.completed` (and others if you need them)
2. Stripe will give you a signing secret (starts with `whsec_`). Set that value as `STRIPE_WEBHOOK_SECRET` in Render.

Local testing tip:
- Use `stripe listen --forward-to localhost:3000/webhook` to forward events to your local machine during development.

---

## Smoke tests
Replace `<render-url>` with the Render service URL.

- Health: `curl https://<render-url>/health`
- Available times: `curl "https://<render-url>/api/available-times?date=2026-07-01"`
- Bookings (admin): GET `/api/bookings` (requires admin auth)
- Create a manual booking (if `ALLOW_MANUAL_BOOKINGS=true`):
  ```bash
  curl -X POST https://<render-url>/api/book -H 'Content-Type: application/json' -d '{"name":"Test","email":"t@example.com","date":"2026-07-01","time":"10:00"}'
  ```

---

## Notes & best practices
- Do not commit secrets. Use Render environment variables.
- The app will crash on startup if required production env vars are missing — this is intentional and helps catch misconfiguration early.
- Consider adding a migration tool (node-pg-migrate or Knex) when you modify schema in the future.
- Monitor logs in Render after deployment; they are very helpful for debugging runtime errors.

---

If you want, I can now open a PR with these changes and walk you interactively through creating the Render Web Service and provisioning Postgres. Reply "open PR and guide me" or "just open PR" or "I will deploy myself".
