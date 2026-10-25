import pg from 'pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects,
// so a booking date can never shift by a day because of time zones.
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
  }
  const pool = new pg.Pool({ connectionString, max: 10 });
  // If the database drops an idle connection (hosted databases do this), log it; the pool opens a
  // new one on the next query. Without a listener, Node treats the event as fatal and the API exits.
  pool.on('error', (err) => console.error('Database connection lost:', err.message));
  return pool;
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

// Turns a failed startup check into a plain message that says what to do next.
export function describeDatabaseError(err, connectionString = process.env.DATABASE_URL ?? '') {
  if (connectionString.includes('[YOUR-PASSWORD]')) {
    return 'server/.env still has the [YOUR-PASSWORD] placeholder. Put your database password there, '
      + 'or run `npm run dev:local` to use a local database with no setup.';
  }
  if (err.code === '42P01') {
    return 'The database has no tables yet. Run `npm run seed` once to create them and load the seed data.';
  }
  if (['ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNREFUSED'].includes(err.code)) {
    return `Could not reach the database host (${err.code}). Check DATABASE_URL in server/.env. `
      + 'On Supabase without IPv6, use the Session pooler connection string instead.';
  }
  return `Could not use the database in DATABASE_URL: ${err.message}`;
}
