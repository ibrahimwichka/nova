import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../server/api.mjs';
import { initialState, fail } from '../server/domain.mjs';
function service() {
  let state = initialState();
  const store = { async load() { return structuredClone(state); }, async save(next, revision) { if (state.revision !== revision) fail('Concurrent update', 409); state = next; } };
  const owner = createApi({ store }); const customer = createApi({ store });
  async function call(api, route, input) {
    const response = await api(new Request(`https://nova.test/api${route}`, input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
    return { status: response.status, body: await response.json() };
  }
  return { owner, customer, call };
}
test('a fresh restaurant and reset both have zero orders; refresh preserves customer orders', async () => {
  const { owner, customer, call } = service();
  assert.deepEqual((await call(customer, '/state')).body.state.orders, []);
  const placed = await call(customer, '/orders', { customer: 'First guest', items: { sprite: 1 } });
  assert.equal(placed.status, 201);
  assert.equal((await call(owner, '/state')).body.state.orders.length, 1);
  const reset = await call(owner, '/reset', {});
  assert.deepEqual(reset.body.state.orders, []);
  assert.equal(reset.body.state.playback, null);
  assert.deepEqual((await call(customer, '/state')).body.state.orders, []);
});
test('two clients share the full order -> preparation -> packing -> pickup flow', async () => {
  const { owner, customer, call } = service();
  const placed = await call(customer, '/orders', { customer: 'Two-device test', items: { burger: 1, fries: 1, sprite: 1 } });
  assert.equal(placed.status, 201); const id = placed.body.orderId;
  assert.ok((await call(owner, '/state')).body.state.orders.find(o => o.id === id));
  assert.equal((await call(owner, `/orders/${id}/prepare`, {})).status, 200);
  assert.equal((await call(customer, '/state')).body.state.orders.find(o => o.id === id).status, 'preparing');
  await call(owner, `/orders/${id}/finish`, {});
  const missing = await call(owner, `/orders/${id}/verify`, { mode: 'demo', fixture: 'missing' });
  assert.equal(missing.body.state.orders.find(o => o.id === id).verification.status, 'red');
  assert.equal((await call(owner, `/orders/${id}/ready`, { verificationId: missing.body.state.orders.find(o => o.id === id).verification.id })).status, 409);
  const checked = await call(owner, `/orders/${id}/verify`, { mode: 'demo', fixture: 'complete' });
  const verificationId = checked.body.state.orders.find(o => o.id === id).verification.id;
  const ready = await call(owner, `/orders/${id}/ready`, { verificationId });
  const code = ready.body.state.orders.find(o => o.id === id).pickupCode;
  assert.equal((await call(customer, `/orders/${id}/collect`, { code: 'WRONG' })).status, 409);
  assert.equal((await call(customer, `/orders/${id}/collect`, { code })).status, 200);
  assert.equal((await call(owner, '/state')).body.state.orders.find(o => o.id === id).status, 'collected');
  assert.equal((await call(customer, `/orders/${id}/collect`, { code })).status, 409);
});
test('preview/replay are isolated, apply rejects stale snapshots, restart preserves drills', async () => {
  const { owner, customer, call } = service();
  const created = await call(owner, '/scenarios', { changes: { absentWorker: 'leo', shortage: 'chicken' }, name: 'Combined disruption' });
  assert.equal(created.status, 201); const id = created.body.scenarioId;
  const before = created.body.state.scenarios[0].comparison;
  assert.equal(created.body.state.staff.find(w => w.id === 'leo').available, true);
  assert.equal(created.body.state.version, 1);
  assert.deepEqual((await call(owner, `/scenarios/${id}/replay`, {})).body.state.scenarios[0].comparison, before);
  await call(customer, '/orders', { customer: 'State changed', items: { sprite: 1 } });
  assert.equal((await call(owner, `/scenarios/${id}/apply`, {})).status, 409);
  const restarted = await call(owner, `/scenarios/${id}/restart`, {});
  assert.equal(restarted.body.state.inventory.chicken, 0);
  assert.equal(restarted.body.state.staff.find(w => w.id === 'leo').available, false);
  const liveVersion = restarted.body.state.version;
  const playback = await call(owner, '/playback', { scenarioId: id, policy: 'adaptive' });
  assert.equal(playback.body.state.version, liveVersion);
  assert.equal(playback.body.state.playback.scenarioId, id);
  const reset = await call(owner, '/reset', {});
  assert.equal(reset.body.state.scenarios.length, 1);
  assert.equal(reset.body.state.inventory.chicken, 7);
  assert.equal(reset.body.state.playback, null);
});
test('invalid inputs and cross-origin changes are rejected; no API key leaks', async () => {
  const { owner, call } = service();
  assert.equal((await call(owner, '/orders', { customer: 'Bad', items: { mystery: 1 } })).status, 400);
  assert.equal((await call(owner, '/resources', { type: 'inventory', id: 'chicken', quantity: -1 })).status, 400);
  const response = await owner(new Request('https://nova.test/api/reset', { method: 'POST', headers: { Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: '{}' }));
  assert.equal(response.status, 403);
  const data = (await call(owner, '/state')).body;
  assert.equal(JSON.stringify(data).includes('OPENROUTER_API_KEY'), false);
});
test('concurrent clients cannot silently overwrite each other', async () => {
  const { owner, customer, call } = service();
  const results = await Promise.all([call(owner, '/resources', { type: 'inventory', id: 'chicken', quantity: 4 }), call(customer, '/resources', { type: 'inventory', id: 'chicken', quantity: 8 })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
