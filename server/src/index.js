import { createApp } from './app.js';
import { createPool, describeDatabaseError } from './db.js';

const pool = createPool();

// Check the database before taking requests, so a wrong DATABASE_URL shows up here with a
// clear message instead of as "Something went wrong" on every page.
try {
  await pool.query('SELECT 1 FROM users LIMIT 1');
} catch (err) {
  console.error(`\n${describeDatabaseError(err)}\n`);
  process.exit(1);
}

const app = createApp(pool);
// API_PORT (not the generic PORT) so a PORT set by another tool can't move the API by accident.
const port = Number(process.env.API_PORT) || 4000;

app.listen(port, () => {
  console.log(`Art studio API running on http://localhost:${port}`);
});
