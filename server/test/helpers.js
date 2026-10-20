// Test helpers: each test file gets its own throwaway Postgres (a real server, started by the
// embedded-postgres package), loaded with the seed data. Nothing touches your real database.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { addDays, todayIST } from '../src/dates.js';
import { createPool } from '../src/db.js';
import { readSeedFile, seed } from '../src/seed.js';

export async function startTestServer() {
  const port = 55000 + Math.floor(Math.random() * 5000);
  const postgres = new EmbeddedPostgres({
    databaseDir: fs.mkdtempSync(path.join(os.tmpdir(), 'art-studio-pg-')),
    port,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    // Test data is thrown away, so skip disk syncing (3x faster start). io_method=sync avoids
    // Postgres 18's background I/O workers, which outlive a forced stop on Windows.
    initdbFlags: ['--no-sync'],
    postgresFlags: ['-c', 'fsync=off', '-c', 'io_method=sync'],
    onLog: () => {},
    onError: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('art_studio_test');

  const pool = createPool(`postgresql://postgres:postgres@localhost:${port}/art_studio_test`);
  await seed(pool);
  return {
    app: createApp(pool),
    pool,
    stop: async () => {
      await pool.end();
      await postgres.stop();
    },
  };
}

let counter = 0;

// A freshly signed-up customer. The returned supertest agent keeps the session cookie.
export async function newCustomer(app) {
  const agent = request.agent(app);
  counter += 1;
  const res = await agent
    .post('/api/auth/signup')
    .send({ name: `Customer ${counter}`, email: `customer${counter}-${Date.now()}@test.dev`, password: 'password123' })
    .expect(201);
  agent.user = res.body.user;
  return agent;
}

export async function loginStudio(app) {
  const agent = request.agent(app);
  const { email, password } = readSeedFile().studioAccount;
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

// 'YYYY-MM-DD' that is n days from today (studio time).
export const inDays = (n) => addDays(todayIST(), n);

export { request };
