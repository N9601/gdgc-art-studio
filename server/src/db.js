import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects,
// so a booking date can never shift by a day because of time zones.
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  return new pg.Pool({ connectionString, max: 10 });
}

// Runs fn(client) inside BEGIN ... COMMIT. If fn throws, everything it did is rolled back.
export async function transaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Postgres error code for "duplicate value in a unique index".
export const UNIQUE_VIOLATION = '23505';
