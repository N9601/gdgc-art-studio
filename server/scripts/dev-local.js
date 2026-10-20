// `npm run dev:local`: runs the whole app against a local Postgres instead of a cloud one.
// The database files live in server/.local-db/ and survive restarts. No accounts or setup needed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import { createPool } from '../src/db.js';
import { seed } from '../src/seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const dataDir = path.join(here, '..', '.local-db');
const port = 5433;
const url = `postgresql://postgres:postgres@localhost:${port}/art_studio`;

const firstRun = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  port,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  postgresFlags: ['-c', 'io_method=sync'], // no background I/O workers left behind on Windows
  onLog: () => {},
});

if (firstRun) await postgres.initialise();
await postgres.start();
if (firstRun) await postgres.createDatabase('art_studio');

const pool = createPool(url);
await seed(pool);
await pool.end();
console.log(`Local Postgres ready on port ${port}. Starting the app at http://localhost:5173 ...`);

const app = spawn('npm', ['run', 'dev'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: url },
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  app.kill();
  await postgres.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', stop);
