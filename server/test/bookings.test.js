import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { inDays, loginStudio, newCustomer, startTestServer } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server?.stop(); });

const address = '4-1-12, Bachupally, Hyderabad';

describe('wall painting bookings', () => {
  it('prices the booking at wall size × the seed rate', async () => {
    const customer = await newCustomer(server.app);
    const { booking } = (await customer.post('/api/bookings')
      .send({ date: inDays(10), wallSqft: 120, address }).expect(201)).body;
    assert.equal(booking.status, 'requested');
    assert.equal(booking.ratePerSqft, 150);
    assert.equal(booking.price, 120 * 150);
  });

  it('accepts dates 7 to 90 days away and wall sizes 10 to 500 sq ft only', async () => {
    const customer = await newCustomer(server.app);
    const book = (date, wallSqft = 50) => customer.post('/api/bookings').send({ date, wallSqft, address });
    assert.equal((await book(inDays(6))).status, 400);
    assert.equal((await book(inDays(91))).status, 400);
    assert.equal((await book('2026-02-30')).status, 400);
    assert.equal((await book(inDays(7))).status, 201);
    assert.equal((await book(inDays(90))).status, 201);
    assert.equal((await book(inDays(30), 9)).status, 400);
    assert.equal((await book(inDays(30), 501)).status, 400);
    assert.equal((await book(inDays(30), 12.5)).status, 400);
  });

  it('books each date only once, even under simultaneous requests', async () => {
    const customers = await Promise.all(Array.from({ length: 6 }, () => newCustomer(server.app)));
    const results = await Promise.all(customers.map((c) =>
      c.post('/api/bookings').send({ date: inDays(40), wallSqft: 30, address })));
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409, 409]);
    assert.match(results.find((r) => r.status === 409).body.error, /just been booked/);
    const taken = (await customers[0].get('/api/bookings/taken-dates').expect(200)).body.dates;
    assert.ok(taken.includes(inDays(40)));
  });

  it('lets the studio confirm or decline, and a declined date becomes free again', async () => {
    const alice = await newCustomer(server.app);
    const bob = await newCustomer(server.app);
    const studio = await loginStudio(server.app);
    const a = (await alice.post('/api/bookings').send({ date: inDays(50), wallSqft: 20, address }).expect(201)).body.booking;
    const b = (await alice.post('/api/bookings').send({ date: inDays(51), wallSqft: 20, address }).expect(201)).body.booking;

    assert.equal((await studio.post(`/api/bookings/${a.id}/confirm`).expect(200)).body.booking.status, 'confirmed');
    await studio.post(`/api/bookings/${a.id}/decline`).expect(409);
    assert.equal((await studio.post(`/api/bookings/${b.id}/decline`).expect(200)).body.booking.status, 'declined');

    await bob.post('/api/bookings').send({ date: inDays(50), wallSqft: 20, address }).expect(409);
    await bob.post('/api/bookings').send({ date: inDays(51), wallSqft: 20, address }).expect(201);
  });

  it('lets a customer cancel until 3 days before the date', async () => {
    const customer = await newCustomer(server.app);
    const ok = (await customer.post('/api/bookings').send({ date: inDays(60), wallSqft: 20, address }).expect(201)).body.booking;
    assert.equal(ok.canCancel, true);
    assert.equal((await customer.post(`/api/bookings/${ok.id}/cancel`).expect(200)).body.booking.status, 'cancelled');
    await customer.post(`/api/bookings/${ok.id}/cancel`).expect(409);

    // A booking only 2 days away can't be created through the API any more, so insert it directly.
    const { rows } = await server.pool.query(
      `INSERT INTO bookings (customer_id, date, wall_sqft, address, rate_per_sqft, price, status)
       VALUES ($1, $2, 20, $3, 150, 3000, 'confirmed') RETURNING id`,
      [customer.user.id, inDays(2), address],
    );
    const late = await customer.post(`/api/bookings/${rows[0].id}/cancel`);
    assert.equal(late.status, 409);
    assert.match(late.body.error, /3 days before/);
  });
});
