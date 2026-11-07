import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, disrupt, comparePacking, demoObservation, recordVerification, readyOrder, collectOrder, prepareOrder, finishPreparation } from '../server/domain.mjs';
import { sampleState as initialState } from './fixtures.mjs';
import { simulate, compareScenario } from '../server/simulation.mjs';

test('recovery covers a missing worker without violating worker/station capacity', () => {
  const state = disrupt(snapshot(initialState()), { absentWorker: 'leo' });
  const fixed = simulate(state, 'fixed'); const adaptive = simulate(state, 'adaptive');
  assert.ok(adaptive.metrics.completed > fixed.metrics.completed);
  assert.equal(adaptive.metrics.total, 10);
  for (const task of adaptive.schedule) {
    const worker = state.staff.find(w => w.id === task.workerId);
    assert.ok(worker.available && worker.skills.includes(task.station));
    assert.notEqual(task.workerId, 'leo');
    for (const other of adaptive.schedule.filter(t => t.id !== task.id && (t.station === task.station || t.workerId === task.workerId))) assert.ok(task.end <= other.start || other.end <= task.start, 'resources cannot overlap');
    for (const dependency of task.dependencies) assert.ok(adaptive.schedule.find(t => t.id === dependency).end <= task.start);
  }
});
test('shortages and equipment outages stay explicitly unresolved', () => {
  const state = snapshot(initialState());
  const run = compareScenario(state, { shortage: 'chicken', equipmentDown: 'fryer' });
  assert.ok(run.recovery.metrics.blocked > 0);
  assert.ok(run.recovery.orders.some(o => /unavailable|needed/.test(o.reason)));
  assert.ok(Object.values(run.recovery.remainingStock).every(q => q >= 0));
  assert.equal(run.recovery.metrics.completed + run.recovery.metrics.blocked, state.orders.length);
  assert.equal(run.recovery.schedule.some(t => t.station === 'fryer'), false);
  assert.equal(state.inventory.chicken, 7, 'preview cannot alter the original snapshot');
});
test('scenario replay is deterministic; repeated rushes have unique IDs', () => {
  const state = snapshot(initialState()); const changes = { absentWorker: 'mina', rush: true };
  assert.deepEqual(compareScenario(state, changes), compareScenario(state, changes));
  const twice = disrupt(disrupt(state, { rush: true }), { rush: true });
  assert.equal(new Set(twice.orders.map(o => o.id)).size, twice.orders.length);
});
test('reservation is once-only and blocked preparation never consumes stock', () => {
  const state = initialState(); const prior = state.inventory.patties;
  prepareOrder(state, 'N103'); assert.equal(state.orders.find(o => o.id === 'N103').status, 'preparing');
  assert.equal(state.inventory.patties, prior - 2);
  assert.throws(() => prepareOrder(state, 'N103'));
  finishPreparation(state, 'N103'); assert.equal(state.inventory.patties, prior - 2);
  state.inventory.chicken = 0;
  const old = structuredClone(state.inventory);
  assert.throws(() => prepareOrder(state, 'N104'));
  assert.deepEqual(state.inventory, old);
});
test('packing distinguishes complete, missing, extras and uncertainty', () => {
  const order = initialState().orders[0];
  assert.equal(comparePacking(order, demoObservation(order, 'complete')).status, 'green');
  assert.equal(comparePacking(order, demoObservation(order, 'missing')).status, 'red');
  assert.equal(comparePacking(order, demoObservation(order, 'obscured')).status, 'amber');
  const extra = demoObservation(order, 'complete'); extra.items.push({ sku: 'wrap', count: 1, certainty: 'clear' });
  assert.equal(comparePacking(order, extra).status, 'red');
  const unknown = demoObservation(order, 'complete'); unknown.items.push({ sku: 'unknown', count: 1, certainty: 'uncertain' });
  assert.equal(comparePacking(order, unknown).status, 'amber');
  const bad = demoObservation(order, 'complete'); bad.items[0].count = -1;
  assert.throws(() => comparePacking(order, bad));
});
test('fresh matching evidence and a single-use matching reference are required', () => {
  const state = initialState(); const order = state.orders[0];
  const red = recordVerification(state, order.id, demoObservation(order, 'missing'), 'demo');
  assert.throws(() => readyOrder(state, order.id, red.id));
  const green = recordVerification(state, order.id, demoObservation(order, 'complete'), 'demo');
  assert.throws(() => readyOrder(state, order.id, 'old-evidence'));
  readyOrder(state, order.id, green.id);
  const code = order.pickupCode;
  assert.throws(() => collectOrder(state, order.id, 'WRONG'));
  collectOrder(state, order.id, code);
  assert.equal(order.status, 'collected');
  assert.throws(() => collectOrder(state, order.id, code));
});
test('stale packing evidence cannot mark ready', () => {
  const state = initialState(); const order = state.orders[0];
  const green = recordVerification(state, order.id, demoObservation(order, 'complete'), 'manual');
  green.at = new Date(Date.now() - 301000).toISOString();
  assert.throws(() => readyOrder(state, order.id, green.id));
});
