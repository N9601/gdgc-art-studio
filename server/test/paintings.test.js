import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { loginStudio, newCustomer, startTestServer } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server?.stop(); });

describe('buying paintings', () => {
  it('lists the 12 seed paintings with their status', async () => {
    const customer = await newCustomer(server.app);
    const { paintings } = (await customer.get('/api/paintings').expect(200)).body;
    assert.equal(paintings.length, 12);
    assert.equal(paintings.filter((p) => p.status === 'sold').length, 2);
  });

  it('sells a painting only once', async () => {
    const alice = await newCustomer(server.app);
    const bob = await newCustomer(server.app);
    const order = (await alice.post('/api/orders').send({ paintingId: 2 }).expect(201)).body.order;
    assert.equal(order.status, 'placed');
    assert.equal(order.price, 1800);
    assert.equal((await bob.get('/api/paintings/2')).body.painting.status, 'sold');

    const again = await bob.post('/api/orders').send({ paintingId: 2 });
    assert.equal(again.status, 409);
    assert.match(again.body.error, /just been sold/);
    await bob.post('/api/orders').send({ paintingId: 4 }).expect(409); // sold in the seed data
    await bob.post('/api/orders').send({ paintingId: 999 }).expect(404);
  });

  it('lets exactly one of many simultaneous buyers win', async () => {
    const buyers = await Promise.all(Array.from({ length: 8 }, () => newCustomer(server.app)));
    const results = await Promise.all(buyers.map((b) => b.post('/api/orders').send({ paintingId: 3 })));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409]);
    const { rows } = await server.pool.query("SELECT count(*)::int AS n FROM orders WHERE painting_id = 3 AND status = 'placed'");
    assert.equal(rows[0].n, 1);
  });

  it('puts a painting back on sale when the order is cancelled', async () => {
    const alice = await newCustomer(server.app);
    const bob = await newCustomer(server.app);
    const order = (await alice.post('/api/orders').send({ paintingId: 5 }).expect(201)).body.order;
    const cancelled = (await alice.post(`/api/orders/${order.id}/cancel`).expect(200)).body.order;
    assert.equal(cancelled.status, 'cancelled');
    assert.equal((await alice.get('/api/paintings/5')).body.painting.status, 'available');
    await alice.post(`/api/orders/${order.id}/cancel`).expect(409);
    await bob.post('/api/orders').send({ paintingId: 5 }).expect(201);
  });
});

describe('studio managing paintings', () => {
  const newPainting = { title: 'Test Canvas', artist: 'A. Painter', description: 'Oil.', price: 3000, imageUrl: '' };

  it('adds and edits a painting while it is available', async () => {
    const studio = await loginStudio(server.app);
    const created = (await studio.post('/api/paintings').send(newPainting).expect(201)).body.painting;
    assert.equal(created.status, 'available');
    const edited = (await studio.put(`/api/paintings/${created.id}`).send({ ...newPainting, price: 3500 }).expect(200)).body.painting;
    assert.equal(edited.price, 3500);
  });

  it('refuses to edit a sold painting, and rejects bad input', async () => {
    const studio = await loginStudio(server.app);
    const res = await studio.put('/api/paintings/9').send(newPainting); // sold in the seed data
    assert.equal(res.status, 409);
    await studio.put('/api/paintings/9999').send(newPainting).expect(404);
    const bad = await studio.post('/api/paintings').send({ ...newPainting, title: ' ', price: -5 });
    assert.equal(bad.status, 400);
    assert.deepEqual(Object.keys(bad.body.fields).sort(), ['price', 'title']);
  });
});
