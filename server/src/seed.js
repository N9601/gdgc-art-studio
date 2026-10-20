// Creates the tables and loads seed/seed.json. Safe to run again: it never duplicates rows
// and never undoes purchases (paintings are only inserted into an empty table).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { createPool, transaction } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function readSeedFile() {
  return JSON.parse(fs.readFileSync(path.join(here, '..', 'seed', 'seed.json'), 'utf8'));
}

// Dummy customer accounts (not part of the brief's seed data) for trying the app quickly.
export function readDemoUsers() {
  return JSON.parse(fs.readFileSync(path.join(here, '..', 'seed', 'demo-users.json'), 'utf8')).customers;
}

export async function migrate(pool) {
  await pool.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
}

export async function seed(pool, data = readSeedFile()) {
  await migrate(pool);
  const studioHash = await bcrypt.hash(data.studioAccount.password, 10);
  const demoCustomers = await Promise.all(readDemoUsers().map(async (c) => ({ ...c, hash: await bcrypt.hash(c.password, 10) })));

  await transaction(pool, async (db) => {
    const upsertSetting = 'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2';
    await db.query(upsertSetting, ['currency', data.currency]);
    await db.query(upsertSetting, ['mural_rate_per_sqft', String(data.mural.ratePerSqFt)]);

    for (const item of data.potteryItems) {
      await db.query('INSERT INTO pottery_items (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2', [item.id, item.name]);
    }
    for (const glaze of data.glazes) {
      await db.query('INSERT INTO glazes (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2', [glaze.id, glaze.name]);
    }

    // The one studio (admin) account. There is no studio sign-up.
    await db.query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ('Studio', $1, $2, 'studio')
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [data.studioAccount.email.toLowerCase(), studioHash],
    );

    for (const c of demoCustomers) {
      await db.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'customer')
         ON CONFLICT ((lower(email))) DO NOTHING`,
        [c.name, c.email.toLowerCase(), c.hash],
      );
    }

    const { rows } = await db.query('SELECT count(*)::int AS n FROM paintings');
    if (rows[0].n === 0) {
      for (const p of data.paintings) {
        await db.query(
          `INSERT INTO paintings (title, artist, description, price, image_url, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.title, p.artist, p.description, p.price, `/${p.imageUrl}`, p.status],
        );
      }
    }
  });
}

// `npm run seed` runs this file directly.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool();
  try {
    await seed(pool);
    console.log('Database ready: tables created and seed data loaded.');
  } finally {
    await pool.end();
  }
}
