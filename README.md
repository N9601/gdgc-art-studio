<p align="center"><img src="client/public/favicon.svg" width="96" alt="Art Studio logo: a hand-drawn clay pot with a paintbrush"></p>

# Art Studio

A small full-stack website for an art studio. Customers buy one-of-a-kind paintings, book a wall
painting, and request custom pottery; the studio manages paintings and confirms or declines
bookings and requests.

**Stack:** Node.js + Express 5 (API) · React 19 + Vite (client) · PostgreSQL · `node:test` + supertest

Design notes and the answers to the brief's questions are in [DESIGN.md](DESIGN.md).

## Run it

You need **Node.js 22 or newer** (`node -v`). Then, from the project folder:

```bash
npm install
```

### Option A: no database setup (quickest)

```bash
npm run dev:local
```

This starts a local PostgreSQL server (bundled through the `embedded-postgres` package, data kept
in `server/.local-db/`), creates the tables, loads the seed data and starts the app.
Open **http://localhost:5173**. The first start takes about 20 seconds. Stop it with `Ctrl+C`.

### Option B: your own Postgres (Neon, Supabase or any other)

1. Create a free database, for example on [Neon](https://neon.tech), and copy its connection string.
2. Copy `server/.env.example` to `server/.env` and paste the string into `DATABASE_URL`.
3. Create the tables and load the seed data (safe to run again):
   ```bash
   npm run seed
   ```
4. Start the API and the client together:
   ```bash
   npm run dev
   ```
5. Open **http://localhost:5173**.

### Logging in

- **Studio (admin):** `studio@artstudio.in` / `Studio@123`. This is the account from the seed data;
  there is no studio sign-up.
- **Customer:** `customer@artstudio.in` / `Customer@123`, a dummy customer (Asha Rao) created by the seed
  script from `server/seed/demo-users.json`. You can also sign up with *Create a customer account*.

### One server instead of two

```bash
npm run build   # builds the React app into client/dist
npm start       # Express serves the API and the built app on http://localhost:4000
```

## Tests

```bash
npm test
```

The tests start a throwaway PostgreSQL server for each test file (nothing to configure, your own
database is never touched), load the seed data and check the business rules through the real API:

- 401 when logged out, 403 for the wrong role, 404 for another customer's records
- a painting sold only once, even with 8 buyers clicking at the same moment
- each date booked only once under simultaneous requests; declined or cancelled dates free up
- date windows, wall size and quantity limits, the 3-day cancellation rule
- edit and cancel of pottery requests only while `requested`

## Scripts

| Command | What it does |
|---|---|
| `npm run dev:local` | Local Postgres + seed + API + client, all in one |
| `npm run dev` | API on :4000 (restarts on change) and the Vite client on :5173 |
| `npm run seed` | Create tables and load `server/seed/seed.json` into `DATABASE_URL` |
| `npm test` | API tests against a throwaway Postgres |
| `npm run build` / `npm start` | Build the client, then serve everything from Express |

## Environment variables (`server/.env`)

| Variable | Needed | Example |
|---|---|---|
| `DATABASE_URL` | yes, except with `dev:local` and `npm test` | `postgresql://user:pass@host/db?sslmode=require` |
| `API_PORT` | no (default `4000`) | `4000` |

## Project layout

```
server/
  src/
    app.js          Express app: middleware and routes
    auth.js         sessions, req.user, role guards (401 / 403)
    db.js           Postgres pool and the transaction helper
    dates.js        date rules in India Standard Time
    validate.js     small input checks
    errors.js       HttpError and the JSON error handler
    schema.sql      tables, constraints and unique indexes
    seed.js         `npm run seed`
    routes/         auth, options, paintings, orders, bookings, pottery
  scripts/dev-local.js
  seed/seed.json    the seed data from the brief
  public/images/    the seed paintings' pictures
  test/             API tests
client/
  src/
    api.js          fetch wrapper + useApi hook (loading / error / data)
    auth.jsx        who is logged in
    components/ui.jsx   loading, empty, error, notices, form fields
    pages/          Paintings, PaintingForm, Orders, Bookings, Pottery, Login, Signup
```

## API

All responses are JSON. Errors look like `{ "error": "message", "fields": { "date": "…" } }`
with status 400 (invalid input), 401 (not logged in), 403 (wrong role), 404 (not found or not
yours) or 409 (conflict: already sold, date taken, status already changed).

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | anyone | creates a customer and logs in |
| POST | `/api/auth/login` · `/api/auth/logout` | anyone | session cookie |
| GET | `/api/auth/me` | logged in | the current user |
| GET | `/api/options` | logged in | pottery items, glazes, mural rate, studio's today |
| GET | `/api/paintings` · `/api/paintings/:id` | logged in | |
| POST | `/api/paintings` | studio | add a painting |
| PUT | `/api/paintings/:id` | studio | only while available (409 once sold) |
| POST | `/api/orders` | customer | buy `{ paintingId }`; 409 if it was just sold |
| GET | `/api/orders` · `/api/orders/:id` | logged in | customers see only their own |
| POST | `/api/orders/:id/cancel` | customer (owner) | painting becomes available again |
| GET | `/api/bookings/taken-dates` | logged in | dates already requested or confirmed |
| POST | `/api/bookings` | customer | `{ date, wallSqft, address }`; 7–90 days, 10–500 sq ft |
| GET | `/api/bookings` · `/api/bookings/:id` | logged in | customers see only their own |
| POST | `/api/bookings/:id/cancel` | customer (owner) | until 3 days before the date |
| POST | `/api/bookings/:id/confirm` · `/decline` | studio | only while requested |
| POST | `/api/pottery` | customer | `{ itemId, glazeId, quantity, neededBy, notes }` |
| GET | `/api/pottery` · `/api/pottery/:id` | logged in | customers see only their own |
| PUT | `/api/pottery/:id` | customer (owner) | edit, only while requested |
| POST | `/api/pottery/:id/cancel` | customer (owner) | only while requested |
| POST | `/api/pottery/:id/accept` · `/decline` | studio | only while requested |
