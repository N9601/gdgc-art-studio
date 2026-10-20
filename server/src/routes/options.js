import { Router } from 'express';
import { requireLogin } from '../auth.js';
import { todayIST } from '../dates.js';

// Read the mural rate from the settings table (seeded from seed.json).
export async function getMuralRate(db) {
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'mural_rate_per_sqft'");
  return Number(rows[0]?.value ?? 0);
}

// Everything the forms need: pottery items, glazes, the mural rate and the studio's "today".
export default function optionsRoutes(pool) {
  const router = Router();

  router.get('/', requireLogin, async (req, res) => {
    const [items, glazes, currency, muralRatePerSqFt] = await Promise.all([
      pool.query('SELECT id, name FROM pottery_items ORDER BY id'),
      pool.query('SELECT id, name FROM glazes ORDER BY id'),
      pool.query("SELECT value FROM settings WHERE key = 'currency'"),
      getMuralRate(pool),
    ]);
    res.json({
      today: todayIST(),
      currency: currency.rows[0]?.value ?? 'INR',
      muralRatePerSqFt,
      potteryItems: items.rows,
      glazes: glazes.rows,
    });
  });

  return router;
}
