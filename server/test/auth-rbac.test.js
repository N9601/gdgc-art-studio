import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { readDemoUsers } from '../src/seed.js';
import { inDays, loginStudio, newCustomer, request, startTestServer } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server?.stop(); });

describe('login', () => {
  it('signs up a customer, keeps them logged in, and logs out', async () => {
    const agent = await newCustomer(server.app);
    assert.equal(agent.user.role, 'customer');
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.user.id, agent.user.id);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects a duplicate email and an invalid sign-up', async () => {
    const agent = await newCustomer(server.app);
    const dup = await request(server.app).post('/api/auth/signup')
      .send({ name: 'Copy', email: agent.user.email.toUpperCase(), password: 'password123' });
    assert.equal(dup.status, 409);
    const bad = await request(server.app).post('/api/auth/signup').send({ name: '', email: 'nope', password: 'short' });
    assert.equal(bad.status, 400);
    assert.deepEqual(Object.keys(bad.body.fields).sort(), ['email', 'name', 'password']);
  });

  it('rejects a wrong password and logs the studio in with the seed account', async () => {
    await request(server.app).post('/api/auth/login').send({ email: 'studio@artstudio.in', password: 'wrong' }).expect(401);
    const studio = await loginStudio(server.app);
    const me = await studio.get('/api/auth/me').expect(200);
    assert.equal(me.body.user.role, 'studio');
  });

  it('seeds the dummy customer from demo-users.json', async () => {
    const [demo] = readDemoUsers();
    const res = await request(server.app).post('/api/auth/login').send({ email: demo.email, password: demo.password }).expect(200);
    assert.equal(res.body.user.role, 'customer');
    assert.equal(res.body.user.name, demo.name);
  });
});

describe('role checks', () => {
  it('refuses every protected route with 401 when not logged in', async () => {
    const routes = [
      ['get', '/api/paintings'], ['post', '/api/paintings'], ['put', '/api/paintings/1'],
      ['get', '/api/orders'], ['post', '/api/orders'], ['post', '/api/orders/1/cancel'],
      ['get', '/api/bookings'], ['post', '/api/bookings'], ['post', '/api/bookings/1/confirm'],
      ['get', '/api/pottery'], ['post', '/api/pottery'], ['post', '/api/pottery/1/accept'],
      ['get', '/api/options'],
    ];
    for (const [method, url] of routes) {
      const res = await request(server.app)[method](url).send({});
      assert.equal(res.status, 401, `${method.toUpperCase()} ${url}`);
    }
  });

  it('refuses the wrong role with 403', async () => {
    const customer = await newCustomer(server.app);
    const studio = await loginStudio(server.app);
    const customerForbidden = [
      ['post', '/api/paintings'], ['put', '/api/paintings/1'],
      ['post', '/api/bookings/1/confirm'], ['post', '/api/bookings/1/decline'],
      ['post', '/api/pottery/1/accept'], ['post', '/api/pottery/1/decline'],
    ];
    const studioForbidden = [
      ['post', '/api/orders'], ['post', '/api/orders/1/cancel'],
      ['post', '/api/bookings'], ['post', '/api/bookings/1/cancel'],
      ['post', '/api/pottery'], ['put', '/api/pottery/1'], ['post', '/api/pottery/1/cancel'],
    ];
    for (const [method, url] of customerForbidden) {
      assert.equal((await customer[method](url).send({})).status, 403, `customer ${method.toUpperCase()} ${url}`);
    }
    for (const [method, url] of studioForbidden) {
      assert.equal((await studio[method](url).send({})).status, 403, `studio ${method.toUpperCase()} ${url}`);
    }
  });

  it("gives a customer 404 for someone else's records, and only lists their own", async () => {
    const alice = await newCustomer(server.app);
    const bob = await newCustomer(server.app);
    const studio = await loginStudio(server.app);

    const order = (await alice.post('/api/orders').send({ paintingId: 1 }).expect(201)).body.order;
    const booking = (await alice.post('/api/bookings')
      .send({ date: inDays(20), wallSqft: 40, address: '12 MG Road, Hyderabad' }).expect(201)).body.booking;
    const pottery = (await alice.post('/api/pottery')
      .send({ itemId: 'i-01', glazeId: 'g-01', quantity: 2, neededBy: inDays(30) }).expect(201)).body.request;

    for (const url of [`/api/orders/${order.id}`, `/api/bookings/${booking.id}`, `/api/pottery/${pottery.id}`]) {
      await bob.get(url).expect(404);
      await alice.get(url).expect(200);
      await studio.get(url).expect(200);
    }
    await bob.post(`/api/orders/${order.id}/cancel`).expect(404);
    await bob.post(`/api/bookings/${booking.id}/cancel`).expect(404);
    await bob.post(`/api/pottery/${pottery.id}/cancel`).expect(404);
    await bob.put(`/api/pottery/${pottery.id}`)
      .send({ itemId: 'i-01', glazeId: 'g-01', quantity: 3, neededBy: inDays(30) }).expect(404);

    assert.equal((await bob.get('/api/orders')).body.orders.length, 0);
    assert.equal((await alice.get('/api/orders')).body.orders.length, 1);
    assert.ok((await studio.get('/api/orders')).body.orders.some((o) => o.id === order.id));
  });
});
