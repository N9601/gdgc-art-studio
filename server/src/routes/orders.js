import { Router } from 'express';
import { customerOnly, requireLogin } from '../auth.js';
import { transaction } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { parseId } from '../validate.js';

const SELECT_ORDERS = `
  SELECT o.id, o.status, o.price, o.created_at, o.cancelled_at,
         p.id AS painting_id, p.title, p.artist, p.image_url,
         u.id AS customer_id, u.name AS customer_name, u.email AS customer_email
    FROM orders o
    JOIN paintings p ON p.id = o.painting_id
    JOIN users u ON u.id = o.customer_id`;

const toOrder = (row) => ({
  id: row.id,
  status: row.status,
  price: row.price,
  createdAt: row.created_at,
  cancelledAt: row.cancelled_at,
  painting: { id: row.painting_id, title: row.title, artist: row.artist, imageUrl: row.image_url },
  customer: { id: row.customer_id, name: row.customer_name, email: row.customer_email },
});

export default function orderRoutes(pool) {
  const router = Router();

  // Buying = one transaction that flips the painting to 'sold' and creates the order.
  // The UPDATE only matches while status is still 'available', and Postgres locks the row,
  // so if two customers click "Buy" at the same moment exactly one UPDATE succeeds.
  router.post('/', customerOnly, async (req, res) => {
    const paintingId = req.body?.paintingId;
    if (!Number.isInteger(paintingId)) throw badRequest('Choose a painting to buy.');

    const order = await transaction(pool, async (db) => {
      const sold = await db.query(
        `UPDATE paintings SET status = 'sold', updated_at = now()
          WHERE id = $1 AND status = 'available'
          RETURNING id, price`,
        [paintingId],
      );
      if (!sold.rows[0]) {
        const exists = await db.query('SELECT 1 FROM paintings WHERE id = $1', [paintingId]);
        if (!exists.rows[0]) throw notFound('Painting not found.');
        throw conflict('Sorry, this painting has just been sold. Please pick another one.');
      }
      const { rows } = await db.query(
        'INSERT INTO orders (painting_id, customer_id, price) VALUES ($1, $2, $3) RETURNING id',
        [paintingId, req.user.id, sold.rows[0].price],
      );
      return rows[0];
    });

    const { rows } = await pool.query(`${SELECT_ORDERS} WHERE o.id = $1`, [order.id]);
    res.status(201).json({ order: toOrder(rows[0]) });
  });

  // Customers see only their own orders; the studio sees all of them.
  router.get('/', requireLogin, async (req, res) => {
    const mine = req.user.role === 'customer';
    const { rows } = await pool.query(
      `${SELECT_ORDERS} ${mine ? 'WHERE o.customer_id = $1' : ''} ORDER BY o.created_at DESC`,
      mine ? [req.user.id] : [],
    );
    res.json({ orders: rows.map(toOrder) });
  });

  // A customer asking for someone else's order gets 404, as if it didn't exist.
  router.get('/:id', requireLogin, async (req, res) => {
    const mine = req.user.role === 'customer';
    const { rows } = await pool.query(
      `${SELECT_ORDERS} WHERE o.id = $1 ${mine ? 'AND o.customer_id = $2' : ''}`,
      mine ? [parseId(req.params.id), req.user.id] : [parseId(req.params.id)],
    );
    if (!rows[0]) throw notFound('Order not found.');
    res.json({ order: toOrder(rows[0]) });
  });

  // Cancelling puts the painting back on sale, in the same transaction.
  router.post('/:id/cancel', customerOnly, async (req, res) => {
    const id = parseId(req.params.id);
    await transaction(pool, async (db) => {
      const cancelled = await db.query(
        `UPDATE orders SET status = 'cancelled', cancelled_at = now()
          WHERE id = $1 AND customer_id = $2 AND status = 'placed'
          RETURNING painting_id`,
        [id, req.user.id],
      );
      if (!cancelled.rows[0]) {
        const own = await db.query('SELECT 1 FROM orders WHERE id = $1 AND customer_id = $2', [id, req.user.id]);
        if (!own.rows[0]) throw notFound('Order not found.');
        throw conflict('This order is already cancelled.');
      }
      await db.query(
        "UPDATE paintings SET status = 'available', updated_at = now() WHERE id = $1",
        [cancelled.rows[0].painting_id],
      );
    });

    const { rows } = await pool.query(`${SELECT_ORDERS} WHERE o.id = $1`, [id]);
    res.json({ order: toOrder(rows[0]) });
  });

  return router;
}
