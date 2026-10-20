import { Router } from 'express';
import { customerOnly, requireLogin, studioOnly } from '../auth.js';
import { daysFromToday, isDateString } from '../dates.js';
import { conflict, notFound } from '../errors.js';
import { assertValid, cleanText, isIntBetween, parseId } from '../validate.js';

const MIN_DAYS_AHEAD = 14;

const SELECT_REQUESTS = `
  SELECT r.*, i.name AS item_name, g.name AS glaze_name,
         u.name AS customer_name, u.email AS customer_email
    FROM pottery_requests r
    JOIN pottery_items i ON i.id = r.item_id
    JOIN glazes g ON g.id = r.glaze_id
    JOIN users u ON u.id = r.customer_id`;

const toRequest = (row) => ({
  id: row.id,
  item: { id: row.item_id, name: row.item_name },
  glaze: { id: row.glaze_id, name: row.glaze_name },
  quantity: row.quantity,
  neededBy: row.needed_by,
  notes: row.notes,
  status: row.status,
  createdAt: row.created_at,
  customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email },
});

// Checks the request form (used for both creating and editing).
async function readRequest(pool, body = {}) {
  const { itemId, glazeId, quantity, neededBy } = body;
  const notes = cleanText(body.notes ?? '', { min: 0, max: 500 });
  const [item, glaze] = await Promise.all([
    pool.query('SELECT 1 FROM pottery_items WHERE id = $1', [String(itemId ?? '')]),
    pool.query('SELECT 1 FROM glazes WHERE id = $1', [String(glazeId ?? '')]),
  ]);
  assertValid({
    itemId: item.rows[0] ? null : 'Choose an item.',
    glazeId: glaze.rows[0] ? null : 'Choose a glaze.',
    quantity: isIntBetween(quantity, 1, 12) ? null : 'Quantity must be a whole number from 1 to 12.',
    neededBy: isDateString(neededBy) && daysFromToday(neededBy) >= MIN_DAYS_AHEAD
      ? null : `The needed-by date must be at least ${MIN_DAYS_AHEAD} days from today.`,
    notes: notes !== null ? null : 'Keep notes under 500 characters.',
  });
  return { itemId: String(itemId), glazeId: String(glazeId), quantity, neededBy, notes };
}

export default function potteryRoutes(pool) {
  const router = Router();

  router.post('/', customerOnly, async (req, res) => {
    const r = await readRequest(pool, req.body);
    const { rows } = await pool.query(
      `INSERT INTO pottery_requests (customer_id, item_id, glaze_id, quantity, needed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [req.user.id, r.itemId, r.glazeId, r.quantity, r.neededBy, r.notes],
    );
    const created = await pool.query(`${SELECT_REQUESTS} WHERE r.id = $1`, [rows[0].id]);
    res.status(201).json({ request: toRequest(created.rows[0]) });
  });

  router.get('/', requireLogin, async (req, res) => {
    const mine = req.user.role === 'customer';
    const { rows } = await pool.query(
      `${SELECT_REQUESTS} ${mine ? 'WHERE r.customer_id = $1' : ''} ORDER BY r.created_at DESC`,
      mine ? [req.user.id] : [],
    );
    res.json({ requests: rows.map(toRequest) });
  });

  router.get('/:id', requireLogin, async (req, res) => {
    const mine = req.user.role === 'customer';
    const { rows } = await pool.query(
      `${SELECT_REQUESTS} WHERE r.id = $1 ${mine ? 'AND r.customer_id = $2' : ''}`,
      mine ? [parseId(req.params.id), req.user.id] : [parseId(req.params.id)],
    );
    if (!rows[0]) throw notFound('Pottery request not found.');
    res.json({ request: toRequest(rows[0]) });
  });

  // For a customer's own request: 404 if it isn't theirs, 409 if it is no longer 'requested'.
  async function explainNoChange(id, customerId, action) {
    const { rows } = await pool.query(
      'SELECT status FROM pottery_requests WHERE id = $1 AND customer_id = $2', [id, customerId],
    );
    if (!rows[0]) throw notFound('Pottery request not found.');
    throw conflict(`You can only ${action} a request while it is still requested. This one is ${rows[0].status}.`);
  }

  // Edit and cancel only work while the request is still 'requested' (checked inside the UPDATE).
  router.put('/:id', customerOnly, async (req, res) => {
    const id = parseId(req.params.id);
    const r = await readRequest(pool, req.body);
    const { rows } = await pool.query(
      `UPDATE pottery_requests
          SET item_id = $3, glaze_id = $4, quantity = $5, needed_by = $6, notes = $7, updated_at = now()
        WHERE id = $1 AND customer_id = $2 AND status = 'requested'
        RETURNING id`,
      [id, req.user.id, r.itemId, r.glazeId, r.quantity, r.neededBy, r.notes],
    );
    if (!rows[0]) await explainNoChange(id, req.user.id, 'edit');
    const fresh = await pool.query(`${SELECT_REQUESTS} WHERE r.id = $1`, [id]);
    res.json({ request: toRequest(fresh.rows[0]) });
  });

  router.post('/:id/cancel', customerOnly, async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await pool.query(
      `UPDATE pottery_requests SET status = 'cancelled', updated_at = now()
        WHERE id = $1 AND customer_id = $2 AND status = 'requested'
        RETURNING id`,
      [id, req.user.id],
    );
    if (!rows[0]) await explainNoChange(id, req.user.id, 'cancel');
    const fresh = await pool.query(`${SELECT_REQUESTS} WHERE r.id = $1`, [id]);
    res.json({ request: toRequest(fresh.rows[0]) });
  });

  // The studio accepts or declines a request that is still 'requested'.
  for (const [action, status] of [['accept', 'accepted'], ['decline', 'declined']]) {
    router.post(`/:id/${action}`, studioOnly, async (req, res) => {
      const id = parseId(req.params.id);
      const updated = await pool.query(
        `UPDATE pottery_requests SET status = $2, updated_at = now()
          WHERE id = $1 AND status = 'requested' RETURNING id`,
        [id, status],
      );
      if (!updated.rows[0]) {
        const current = await pool.query('SELECT status FROM pottery_requests WHERE id = $1', [id]);
        if (!current.rows[0]) throw notFound('Pottery request not found.');
        throw conflict(`Only requested items can be ${status}. This one is ${current.rows[0].status}.`);
      }
      const fresh = await pool.query(`${SELECT_REQUESTS} WHERE r.id = $1`, [id]);
      res.json({ request: toRequest(fresh.rows[0]) });
    });
  }

  return router;
}
