import { Router } from 'express';
import { customerOnly, requireLogin, studioOnly } from '../auth.js';
import { daysFromToday, isDateString, todayIST } from '../dates.js';
import { UNIQUE_VIOLATION } from '../db.js';
import { conflict, notFound } from '../errors.js';
import { assertValid, cleanText, isIntBetween, parseId } from '../validate.js';
import { getMuralRate } from './options.js';

const MIN_DAYS_AHEAD = 7;
const MAX_DAYS_AHEAD = 90;
const CANCEL_DAYS_BEFORE = 3;

const SELECT_BOOKINGS = `
  SELECT b.*, u.name AS customer_name, u.email AS customer_email
    FROM bookings b JOIN users u ON u.id = b.customer_id`;

const toBooking = (row) => ({
  id: row.id,
  date: row.date,
  wallSqft: row.wall_sqft,
  address: row.address,
  ratePerSqft: row.rate_per_sqft,
  price: row.price,
  status: row.status,
  createdAt: row.created_at,
  // tells the UI whether to offer "Cancel"; the server still re-checks on the cancel request
  canCancel: ['requested', 'confirmed'].includes(row.status) && daysFromToday(row.date) >= CANCEL_DAYS_BEFORE,
  customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email },
});

export default function bookingRoutes(pool) {
  const router = Router();

  // Dates that are already taken (requested or confirmed), so the form can warn early.
  // Only dates are returned, never who booked them.
  router.get('/taken-dates', requireLogin, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT date FROM bookings
        WHERE status IN ('requested', 'confirmed') AND date >= $1
        ORDER BY date`,
      [todayIST()],
    );
    res.json({ dates: rows.map((r) => r.date) });
  });

  router.post('/', customerOnly, async (req, res) => {
    const { date, wallSqft } = req.body ?? {};
    const address = cleanText(req.body?.address, { min: 5, max: 300 });
    const ahead = isDateString(date) ? daysFromToday(date) : null;
    assertValid({
      date: ahead === null ? 'Pick a date.'
        : ahead < MIN_DAYS_AHEAD || ahead > MAX_DAYS_AHEAD
          ? `Pick a date ${MIN_DAYS_AHEAD} to ${MAX_DAYS_AHEAD} days from today.` : null,
      wallSqft: isIntBetween(wallSqft, 10, 500) ? null : 'Wall size must be a whole number from 10 to 500 sq ft.',
      address: address ? null : 'Enter the address (5 to 300 characters).',
    });

    const rate = await getMuralRate(pool);
    try {
      const { rows } = await pool.query(
        `INSERT INTO bookings (customer_id, date, wall_sqft, address, rate_per_sqft, price)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [req.user.id, date, wallSqft, address, rate, wallSqft * rate],
      );
      const created = await pool.query(`${SELECT_BOOKINGS} WHERE b.id = $1`, [rows[0].id]);
      res.status(201).json({ booking: toBooking(created.rows[0]) });
    } catch (err) {
      // The unique index on active dates rejects a second booking for the same day,
      // even if two customers submit at exactly the same moment.
      if (err.code === UNIQUE_VIOLATION) {
        throw conflict(`Sorry, ${date} has just been booked by someone else. Please pick another date.`);
      }
      throw err;
    }
  });

  router.get('/', requireLogin, async (req, res) => {
    const mine = req.user.role === 'customer';
    const { rows } = await pool.query(
      `${SELECT_BOOKINGS} ${mine ? 'WHERE b.customer_id = $1' : ''} ORDER BY b.date`,
      mine ? [req.user.id] : [],
    );
    res.json({ bookings: rows.map(toBooking) });
  });

  router.get('/:id', requireLogin, async (req, res) => {
    const mine = req.user.role === 'customer';
    const { rows } = await pool.query(
      `${SELECT_BOOKINGS} WHERE b.id = $1 ${mine ? 'AND b.customer_id = $2' : ''}`,
      mine ? [parseId(req.params.id), req.user.id] : [parseId(req.params.id)],
    );
    if (!rows[0]) throw notFound('Booking not found.');
    res.json({ booking: toBooking(rows[0]) });
  });

  // Customers can cancel their own requested or confirmed booking until 3 days before the date.
  router.post('/:id/cancel', customerOnly, async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id = $1 AND customer_id = $2', [id, req.user.id]);
    const booking = rows[0];
    if (!booking) throw notFound('Booking not found.');
    if (!['requested', 'confirmed'].includes(booking.status)) {
      throw conflict(`This booking is already ${booking.status}.`);
    }
    if (daysFromToday(booking.date) < CANCEL_DAYS_BEFORE) {
      throw conflict(`Bookings can only be cancelled up to ${CANCEL_DAYS_BEFORE} days before the date.`);
    }
    // the status condition makes this safe if the studio declines it at the same moment
    const updated = await pool.query(
      `UPDATE bookings SET status = 'cancelled', updated_at = now()
        WHERE id = $1 AND status IN ('requested', 'confirmed') RETURNING id`,
      [id],
    );
    if (!updated.rows[0]) throw conflict('This booking was changed a moment ago. Please refresh.');
    const fresh = await pool.query(`${SELECT_BOOKINGS} WHERE b.id = $1`, [id]);
    res.json({ booking: toBooking(fresh.rows[0]) });
  });

  // The studio confirms or declines; only a booking that is still 'requested' can change.
  for (const [action, status] of [['confirm', 'confirmed'], ['decline', 'declined']]) {
    router.post(`/:id/${action}`, studioOnly, async (req, res) => {
      const id = parseId(req.params.id);
      const updated = await pool.query(
        `UPDATE bookings SET status = $2, updated_at = now()
          WHERE id = $1 AND status = 'requested' RETURNING id`,
        [id, status],
      );
      if (!updated.rows[0]) {
        const current = await pool.query('SELECT status FROM bookings WHERE id = $1', [id]);
        if (!current.rows[0]) throw notFound('Booking not found.');
        throw conflict(`Only requested bookings can be ${status}. This one is ${current.rows[0].status}.`);
      }
      const fresh = await pool.query(`${SELECT_BOOKINGS} WHERE b.id = $1`, [id]);
      res.json({ booking: toBooking(fresh.rows[0]) });
    });
  }

  return router;
}
