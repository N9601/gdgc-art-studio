# Design notes

## 1. How do login and the two roles work?

Customers sign up with name, email and password; passwords are hashed with bcrypt. The studio
account is created by the seed script from `seed.json`, and there is no studio sign-up. Logging in
creates a session: the server generates a random 32-byte token, stores only its SHA-256 hash in a
`sessions` table (with a 7-day expiry) and sends the token in an `httpOnly`, `SameSite=Lax`
cookie, so page JavaScript can't read it and other sites can't post with it.

On every `/api` request, a middleware looks the cookie up and sets `req.user` (or `null`). Each
route then declares who may call it with `requireLogin`, `customerOnly` or `studioOnly`:
no user gives **401**, the wrong role gives **403**. For records that belong to a customer
(orders, bookings, pottery requests), customers' queries always include
`AND customer_id = <their id>`, so asking for someone else's record finds nothing and returns
**404**, which also hides whether that record exists. The React app hides buttons by role too,
but that is only for convenience; the server is what enforces the rules.

## 2. Which database did you choose, and why?

PostgreSQL, hosted on Supabase's free tier (any Postgres works, e.g. Neon). The data is
naturally relational (users, paintings, orders, bookings, requests that point at each other), and
the two hardest rules in the brief, "a painting sells once" and "a date is booked once", can be
made **database guarantees** with transactions, row locks and partial unique indexes instead of
only application checks. The same SQL also runs on a local embedded Postgres, which is how
`npm test` and `npm run dev:local` work without any account or setup. Because Supabase also
exposes tables through its auto-generated Data API, every table has row level security switched
on with no policies: that API can't read anything, while the app (the tables' owner) is unaffected.

## 3. How do you stop two people from taking the same painting or date?

**Paintings.** Buying is one transaction:
`UPDATE paintings SET status = 'sold' WHERE id = $1 AND status = 'available' RETURNING ...`,
then `INSERT INTO orders`. Postgres locks the row during the update, so when two customers buy
at the same moment the second update waits, re-checks the condition, finds the painting already
`sold` and matches zero rows. That request rolls back and gets **409 "this painting has just been
sold"**. As a second line of defence, a partial unique index
(`orders(painting_id) WHERE status = 'placed'`) makes two live orders for one painting impossible
even if the code had a bug. Cancelling flips the order and the painting back in one transaction.

**Dates.** A partial unique index `bookings(date) WHERE status IN ('requested', 'confirmed')` lets
the database refuse a second active booking for the same day. Two simultaneous inserts can't both
succeed; the loser gets a unique-violation error (`23505`), which the API turns into **409 "that
date has just been booked"**. Declined and cancelled bookings fall outside the index, so their
date becomes free again.

**Status changes** (confirm/decline, accept/decline, cancel, edit) use the same pattern: the
expected current status is part of the `UPDATE ... WHERE`, so if two people act at once, only the
first wins and the other gets a 409 with a clear message. The tests fire 8 simultaneous purchases
and 6 simultaneous bookings and check that exactly one succeeds.

## 4. What did you finish, what did you leave out, and what would you do next?

**Finished:**
- Every feature and rule in the brief: buying and cancelling paintings, adding and editing them
  while available, wall bookings with the 7–90 day window, 10–500 sq ft, price from the seed rate,
  one booking per date, confirm/decline and cancel until 3 days before, and pottery requests with
  seed items and glazes, quantity 1–12, needed-by at least 14 days away, accept/decline, and edit
  or cancel only while requested.
- The full RBAC table, with 401/403/404 as specified.
- Loading, empty and error states on every data screen, and clear messages when the server
  refuses something.
- A studio Overview page (sales, items waiting for review, upcoming murals) and a dummy customer
  account in the seed data for quick testing.
- A public landing page for visitors who aren't logged in. It shows no prices or availability,
  because those come from the API, and the API refuses requests without a login (401).
- The server checks the database before it starts, and explains a wrong `DATABASE_URL`
  (placeholder password, unreachable host, missing tables) instead of failing on every request.
- 24 API tests, including the concurrency cases.

**Left out:** the brief's out-of-scope list (payments, password reset, email verification, image
uploads, which are replaced by an image URL field, deployment). I also didn't build pagination,
login rate limiting, or deleting paintings, which the brief doesn't ask for.

**Next:**
- Rate-limit login attempts.
- Add browser end-to-end tests (Playwright) on top of the API tests.
- Add pagination and search for a larger catalogue.
- Verify Supabase's TLS certificate with its CA file instead of `sslmode=no-verify`.
- Deploy: Render or Fly for the API with the Supabase database, served over HTTPS with the cookie
  marked `Secure`.

## Other decisions

- **Dates use the studio's calendar (IST).** "7 days away" is counted from today in India, and
  DATE columns are read as plain `YYYY-MM-DD` strings so time zones can't shift a booking by a day.
- **Prices are copied onto orders and bookings** when they are created, so a later change to a
  painting's price or the mural rate doesn't rewrite history.
- **A purchase carries the price the customer saw.** If the studio changed it in the meantime, the
  transaction rolls back and the customer gets a 409 with the new price, so nobody pays a price
  they didn't confirm.
- **Validation lives on the server.** The forms add hints and limits for convenience, but every
  rule is checked again by the API, which returns per-field messages the forms display.
