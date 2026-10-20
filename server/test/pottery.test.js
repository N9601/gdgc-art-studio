import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { inDays, loginStudio, newCustomer, startTestServer } from './helpers.js';

let server;
before(async () => { server = await startTestServer(); });
after(async () => { await server?.stop(); });

const valid = () => ({ itemId: 'i-02', glazeId: 'g-04', quantity: 4, neededBy: inDays(21), notes: 'For a wedding' });

describe('custom pottery requests', () => {
  it('creates a request with item and glaze names', async () => {
    const customer = await newCustomer(server.app);
    const { request } = (await customer.post('/api/pottery').send(valid()).expect(201)).body;
    assert.equal(request.status, 'requested');
    assert.equal(request.item.name, 'Surahi (water jug)');
    assert.equal(request.glaze.name, 'Indigo Blue');
  });

  it('checks quantity, needed-by date, item and glaze', async () => {
    const customer = await newCustomer(server.app);
    const send = (changes) => customer.post('/api/pottery').send({ ...valid(), ...changes });
    assert.equal((await send({ quantity: 0 })).status, 400);
    assert.equal((await send({ quantity: 13 })).status, 400);
    assert.equal((await send({ neededBy: inDays(13) })).status, 400);
    assert.equal((await send({ neededBy: inDays(14) })).status, 201);
    assert.equal((await send({ itemId: 'i-99' })).status, 400);
    assert.equal((await send({ glazeId: 'nope' })).status, 400);
  });

  it('allows edit and cancel only while the request is still requested', async () => {
    const customer = await newCustomer(server.app);
    const studio = await loginStudio(server.app);
    const { request } = (await customer.post('/api/pottery').send(valid()).expect(201)).body;

    const edited = (await customer.put(`/api/pottery/${request.id}`).send({ ...valid(), quantity: 6 }).expect(200)).body.request;
    assert.equal(edited.quantity, 6);

    assert.equal((await studio.post(`/api/pottery/${request.id}/accept`).expect(200)).body.request.status, 'accepted');
    await customer.put(`/api/pottery/${request.id}`).send(valid()).expect(409);
    await customer.post(`/api/pottery/${request.id}/cancel`).expect(409);
    await studio.post(`/api/pottery/${request.id}/decline`).expect(409);
  });

  it('lets the customer cancel and the studio decline', async () => {
    const customer = await newCustomer(server.app);
    const studio = await loginStudio(server.app);
    const first = (await customer.post('/api/pottery').send(valid()).expect(201)).body.request;
    const second = (await customer.post('/api/pottery').send(valid()).expect(201)).body.request;

    assert.equal((await customer.post(`/api/pottery/${first.id}/cancel`).expect(200)).body.request.status, 'cancelled');
    await studio.post(`/api/pottery/${first.id}/accept`).expect(409);
    assert.equal((await studio.post(`/api/pottery/${second.id}/decline`).expect(200)).body.request.status, 'declined');
  });
});
