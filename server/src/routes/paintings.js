import { Router } from 'express';
import { requireLogin, studioOnly } from '../auth.js';
import { conflict, notFound } from '../errors.js';
import { assertValid, cleanText, isIntBetween, parseId } from '../validate.js';

const toPainting = (row) => ({
  id: row.id,
  title: row.title,
  artist: row.artist,
  description: row.description,
  price: row.price,
  imageUrl: row.image_url,
  status: row.status,
});

// Checks the add/edit form. Image uploads are out of scope, so the studio gives an image URL.
function readPainting(body = {}) {
  const title = cleanText(body.title, { max: 200 });
  const artist = cleanText(body.artist, { max: 120 });
  const description = cleanText(body.description ?? '', { min: 0, max: 2000 });
  const imageUrl = cleanText(body.imageUrl ?? '', { min: 0, max: 500 });
  assertValid({
    title: title ? null : 'Enter a title (up to 200 characters).',
    artist: artist ? null : 'Enter the artist’s name.',
    description: description !== null ? null : 'Keep the description under 2000 characters.',
    price: isIntBetween(body.price, 1, 10_000_000) ? null : 'Enter a price in whole rupees (1 to 1,00,00,000).',
    imageUrl: imageUrl !== null ? null : 'Keep the image URL under 500 characters.',
  });
  return { title, artist, description, price: body.price, imageUrl: imageUrl || null };
}

export default function paintingRoutes(pool) {
  const router = Router();

  // Both roles can browse.
  router.get('/', requireLogin, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM paintings ORDER BY id');
    res.json({ paintings: rows.map(toPainting) });
  });

  router.get('/:id', requireLogin, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM paintings WHERE id = $1', [parseId(req.params.id)]);
    if (!rows[0]) throw notFound('Painting not found.');
    res.json({ painting: toPainting(rows[0]) });
  });

  router.post('/', studioOnly, async (req, res) => {
    const p = readPainting(req.body);
    const { rows } = await pool.query(
      `INSERT INTO paintings (title, artist, description, price, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [p.title, p.artist, p.description, p.price, p.imageUrl],
    );
    res.status(201).json({ painting: toPainting(rows[0]) });
  });

  // Editing is allowed only while the painting is available. The status check is part of the
  // UPDATE itself, so a purchase that lands at the same moment can't slip in between.
  router.put('/:id', studioOnly, async (req, res) => {
    const id = parseId(req.params.id);
    const p = readPainting(req.body);
    const { rows } = await pool.query(
      `UPDATE paintings
          SET title = $2, artist = $3, description = $4, price = $5, image_url = $6, updated_at = now()
        WHERE id = $1 AND status = 'available'
        RETURNING *`,
      [id, p.title, p.artist, p.description, p.price, p.imageUrl],
    );
    if (rows[0]) return res.json({ painting: toPainting(rows[0]) });

    const exists = await pool.query('SELECT 1 FROM paintings WHERE id = $1', [id]);
    if (!exists.rows[0]) throw notFound('Painting not found.');
    throw conflict('This painting has been sold, so it can no longer be edited.');
  });

  return router;
}
