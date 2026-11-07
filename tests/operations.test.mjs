import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../server/api.mjs';
import { initialState, fail } from '../server/domain.mjs';
import { ensureOperations, operationsEvidence } from '../server/operations.mjs';

function service(aiRunner) {
  let state = initialState();
  const store = { async load() { return structuredClone(state); }, async save(next, revision) { if (state.revision !== revision) fail('Concurrent update', 409); state = next; } };
  const api = createApi({ store, env: { OPENROUTER_API_KEY: 'test-only' }, aiRunner });
  async function call(route, input) {
    const response = await api(new Request(`https://nova.test/api${route}`, input === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
    return { status: response.status, body: await response.json() };
  }
  return { call, get: () => state };
}
test('stock alerts count queued commitments exactly once and resolve after a received restock', async () => {
  const { call } = service();
  await call('/orders', { customer: 'Stock test', items: { burger: 10 } });
  let result = await call('/state');
  let row = result.body.operations.inventory.find(r => r.id === 'buns');
  assert.equal(row.onHand, 12); assert.equal(row.committed, 10); assert.equal(row.available, 2); assert.equal(row.alert, true);
  assert.equal(row.suggestedQuantity, 10);
  await call('/restock-requests', { ingredient: 'buns', quantity: 10 });
  const requested = await call('/restock-requests', { ingredient: 'buns', quantity: 7 });
  assert.equal(requested.body.state.operations.restockRequests.length, 1);
  assert.equal(requested.body.state.inventory.buns, 12);
  const requestId = requested.body.state.operations.restockRequests[0].id;
  result = await call('/restock', { ingredient: 'buns', quantity: 10, requestId, idempotencyKey: 'test-restock-001' });
  assert.equal(result.status, 200); assert.equal(result.body.state.inventory.buns, 22);
  assert.equal(result.body.state.operations.restockRequests[0].status, 'received');
  assert.equal(result.body.operations.inventory.find(r => r.id === 'buns').alert, false);
  assert.equal((await call('/restock', { ingredient: 'buns', quantity: 10, requestId, idempotencyKey: 'test-restock-001' })).status, 409);
  assert.equal((await call('/state')).body.state.inventory.buns, 22);
});
test('restock supports partial receipts and rejects overflow, unknown items, and negative quantities', async () => {
  const { call } = service();
  const requested = await call('/restock-requests', { ingredient: 'drinks', quantity: 10 });
  const requestId = requested.body.state.operations.restockRequests[0].id;
  const partial = await call('/restock', { ingredient: 'drinks', quantity: 3, requestId, idempotencyKey: 'partial-restock-1' });
  assert.equal(partial.body.state.operations.restockRequests[0].quantity, 7);
  assert.equal(partial.body.state.operations.restockRequests[0].status, 'pending');
  for (const input of [{ ingredient: 'drinks', quantity: -1 }, { ingredient: 'unknown', quantity: 2 }, { ingredient: 'drinks', quantity: 1000 }]) assert.equal((await call('/restock', { ...input, idempotencyKey: 'invalid-restock-key' })).status, 400);
});
test('AI preparation can start only a recommended fresh feasible ticket', async () => {
  const { call } = service(async (kind, evidence) => ({ summary: 'Start the first ticket.', priorities: [{ orderId: evidence.orders[0].id, action: 'start', reason: 'Stock and qualified capacity available.' }] }));
  const placed = await call('/orders', { customer: 'Prep test', items: { burger: 1 } });
  const orderId = placed.body.orderId;
  const analyzed = await call('/ai/prep', {}), analysisId = analyzed.body.state.operations.analyses.prep.id;
  assert.equal(analyzed.body.state.orders[0].status, 'queued');
  await call('/resources', { type: 'station', id: 'grill', available: false });
  assert.equal((await call('/ai/prep/start', { orderId, analysisId })).status, 409);
  await call('/resources', { type: 'station', id: 'grill', available: true });
  const fresh = await call('/ai/prep', {});
  assert.equal((await call('/ai/prep/start', { orderId, analysisId: fresh.body.state.operations.analyses.prep.id })).status, 200);
  assert.equal((await call('/state')).body.state.inventory.patties, 11);
});
test('AI inventory review creates an owner request without manufacturing stock', async () => {
  const { call } = service(async () => ({ summary: 'Sparse demo estimate.', forecasts: [{ ingredient: 'chicken', unitsNext30Min: 12, confidence: 'low', reason: 'Demo planning assumption.' }] }));
  const result = await call('/ai/inventory', {});
  assert.equal(result.status, 200); assert.equal(result.body.state.inventory.chicken, 7);
  assert.equal(result.body.state.operations.restockRequests.find(r => r.ingredient === 'chicken').quantity, 5);
  assert.equal(result.body.operations.inventory.find(r => r.id === 'chicken').alert, true);
});
test('AI staffing creates a preview; existing stale protection guards applying it', async () => {
  const { call } = service(async () => ({ summary: 'Leo is absent; preview qualified coverage.', absentWorker: 'leo', equipmentDown: '' }));
  await call('/orders', { customer: 'Staff test', items: { fries: 1 } });
  const result = await call('/ai/staff', { message: 'Leo cannot make the shift.' });
  const scenarioId = result.body.state.operations.analyses.staff.data.scenarioId;
  assert.equal(result.body.state.staff.find(w => w.id === 'leo').available, true);
  const scenario = result.body.state.scenarios.find(s => s.id === scenarioId);
  assert.ok(scenario.comparison.recovery.moves.includes('Jules → Fryer'));
  assert.equal((await call('/scenarios/' + scenarioId + '/apply', {})).status, 200);
  assert.equal((await call('/state')).body.state.staff.find(w => w.id === 'leo').available, false);
});
test('reviewed receipts update matched costs only, keep currencies separate, and never restock', async () => {
  const receipt = { merchant: 'Demo supplier', date: '2026-11-07', currency: 'USD', totalCents: 500, confidence: 'medium', lines: [{ description: '2 patties', ingredient: 'patties', quantity: 2, totalCents: 500 }] };
  const { call } = service(async () => receipt);
  const draft = await call('/ai/receipt', { image: 'test image injected into stub' });
  const input = { ...receipt, draftId: draft.body.state.operations.analyses.receipt.id };
  const saved = await call('/receipts', input);
  assert.equal(saved.status, 201); assert.equal(saved.body.state.operations.ingredientCosts.patties, 250);
  assert.equal(saved.body.state.inventory.patties, 12);
  assert.equal(saved.body.operations.finance.receiptsByCurrency[0].totalCents, 500);
  assert.equal((await call('/receipts', input)).status, 409);
  const foreign = await call('/ai/receipt', { image: 'stub' });
  const foreignSaved = await call('/receipts', { ...receipt, currency: 'EUR', draftId: foreign.body.state.operations.analyses.receipt.id, totalCents: 400, lines: [{ ...receipt.lines[0], totalCents: 400 }] });
  assert.equal(foreignSaved.body.state.operations.ingredientCosts.patties, 250);
  assert.equal(foreignSaved.body.operations.finance.receiptsByCurrency.length, 2);
});
test('logged waste decreases on-hand once and feeds explicit financial evidence', async () => {
  const { call } = service();
  const input = { ingredient: 'chicken', quantity: 2, reason: 'Spoiled in demo', idempotencyKey: 'waste-example-001' };
  const result = await call('/inventory/waste', input);
  assert.equal(result.body.state.inventory.chicken, 5);
  assert.equal(result.body.operations.finance.loggedWasteCents, 360);
  assert.equal(result.body.operations.finance.simulatedRevenueCents, 0);
  assert.equal((await call('/inventory/waste', input)).status, 409);
  assert.equal((await call('/inventory/waste', { ...input, quantity: 20, idempotencyKey: 'waste-example-002' })).status, 409);
  const reset = await call('/reset', {});
  assert.deepEqual(reset.body.state.operations.waste, []);
  assert.deepEqual(reset.body.state.operations.restockRequests, []);
});
test('old stored restaurants gain operations defaults without losing their tickets', () => {
  const state = initialState(); delete state.operations;
  state.orders.push({ id: 'legacy', status: 'queued', due: 18, items: { sprite: 1 } });
  ensureOperations(state);
  assert.equal(operationsEvidence(state).orders[0].id, 'legacy');
  assert.equal(state.operations.pricing.burger, 850);
});
test('a long AI request preserves newer kitchen changes and cannot queue stale replenishment', async () => {
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const waiting = new Promise(resolve => { release = resolve; });
  const { call } = service(async () => { started(); await waiting; return { summary: 'Old snapshot estimate.', forecasts: [{ ingredient: 'chicken', unitsNext30Min: 12, confidence: 'low', reason: 'Old assumption.' }] }; });
  const pending = call('/ai/inventory', {});
  await ready;
  await call('/restock', { ingredient: 'chicken', quantity: 20, idempotencyKey: 'concurrent-restock-001' });
  release();
  const result = await pending;
  assert.equal(result.status, 200);
  assert.equal(result.body.state.inventory.chicken, 27);
  assert.notEqual(result.body.state.operations.analyses.inventory.basedOnVersion, result.body.state.version);
  assert.deepEqual(result.body.state.operations.restockRequests, []);
  assert.equal(result.body.operations.inventory.find(r => r.id === 'chicken').alert, false);
});
