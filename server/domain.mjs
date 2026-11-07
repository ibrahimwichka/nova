const randomUUID = () => crypto.randomUUID();
const pickupToken = () => [...crypto.getRandomValues(new Uint8Array(3))].map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase();

export const CATALOG = {
  burger: { name: 'Burger', short: 'BG', color: '#c88b48', ingredients: { buns: 1, patties: 1 }, station: 'grill', duration: 5 },
  wrap: { name: 'Chicken wrap', short: 'WR', color: '#8b9e57', ingredients: { chicken: 1, tortillas: 1 }, station: 'prep', duration: 4 },
  fries: { name: 'Fries', short: 'FR', color: '#dbad45', ingredients: { potatoes: 1 }, station: 'fryer', duration: 3 },
  sprite: { name: 'Sprite', short: 'SP', color: '#378e69', ingredients: { drinks: 1 }, station: null, duration: 0 },
};
export const INGREDIENTS = { buns: 'Burger buns', patties: 'Burger patties', chicken: 'Chicken portions', tortillas: 'Tortillas', potatoes: 'Fries portions', drinks: 'Sprite cans' };
export const clone = value => structuredClone(value);
export function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
export function event(state, message, kind = 'info') {
  state.events.unshift({ id: randomUUID(), message, kind, at: new Date().toISOString() });
  state.events = state.events.slice(0, 60);
}
export function initialState() {
  return {
    version: 1,
    revision: 1,
    createdAt: new Date().toISOString(),
    staff: [
      { id: 'mina', name: 'Mina', role: 'Hot line', home: 'grill', skills: ['grill', 'prep'], available: true },
      { id: 'leo', name: 'Leo', role: 'Fryer', home: 'fryer', skills: ['fryer', 'packing'], available: true },
      { id: 'sam', name: 'Sam', role: 'Prep & relief', home: 'prep', skills: ['prep', 'grill', 'packing'], available: true },
      { id: 'jules', name: 'Jules', role: 'Packing', home: 'packing', skills: ['packing', 'fryer'], available: true },
    ],
    stations: [
      { id: 'grill', name: 'Grill', label: 'HOT LINE', available: true },
      { id: 'fryer', name: 'Fryer', label: 'HOT LINE', available: true },
      { id: 'prep', name: 'Cold prep', label: 'ASSEMBLY', available: true },
      { id: 'packing', name: 'Packing', label: 'DISPATCH', available: true },
    ],
    inventory: { buns: 12, patties: 12, chicken: 7, tortillas: 10, potatoes: 18, drinks: 16 },
    orders: [
      { id: 'N101', customer: 'Alex M.', source: 'DoorDash · sample', due: 6, arrival: 0, status: 'packing', revision: 1, items: { burger: 1, fries: 2, sprite: 1 }, note: 'Keep the drink beside the bag.' },
      { id: 'N102', customer: 'Taylor K.', source: 'Direct · sample', due: 10, arrival: 0, status: 'packing', revision: 1, items: { wrap: 1, fries: 1, sprite: 1 }, note: 'One separate fries portion.' },
      { id: 'N103', customer: 'Jordan S.', source: 'DoorDash · sample', due: 12, arrival: 0, status: 'queued', revision: 1, items: { burger: 2, fries: 1 }, note: '' },
      { id: 'N104', customer: 'Alex R.', source: 'Direct · sample', due: 15, arrival: 1, status: 'queued', revision: 1, items: { wrap: 2, sprite: 2 }, note: 'Match the reference; two customers are named Alex.' },
      { id: 'N105', customer: 'Casey L.', source: 'DoorDash · sample', due: 18, arrival: 2, status: 'queued', revision: 1, items: { burger: 1, fries: 2, sprite: 1 }, note: '' },
      { id: 'N106', customer: 'Morgan J.', source: 'Direct · sample', due: 22, arrival: 3, status: 'queued', revision: 1, items: { wrap: 1, fries: 1 }, note: '' },
      { id: 'N107', customer: 'Riley W.', source: 'DoorDash · sample', due: 25, arrival: 4, status: 'queued', revision: 1, items: { burger: 2, sprite: 2 }, note: '' },
      { id: 'N108', customer: 'Jamie P.', source: 'Direct · sample', due: 28, arrival: 5, status: 'queued', revision: 1, items: { wrap: 1, fries: 2, sprite: 1 }, note: '' },
      { id: 'N109', customer: 'Chris D.', source: 'DoorDash · sample', due: 31, arrival: 6, status: 'queued', revision: 1, items: { burger: 1, fries: 1 }, note: '' },
      { id: 'N110', customer: 'Drew B.', source: 'Direct · sample', due: 35, arrival: 7, status: 'queued', revision: 1, items: { wrap: 1, sprite: 1 }, note: '' },
    ],
    scenarios: [],
    appliedPlan: null,
    playback: null,
    events: [{ id: randomUUID(), message: 'Demo kitchen opened. All upstream operations are simulated.', kind: 'info', at: new Date().toISOString() }],
  };
}
export function snapshot(state) {
  return clone({ version: state.version, staff: state.staff, stations: state.stations, inventory: state.inventory, orders: state.orders });
}
export function requirements(order) {
  const result = {};
  for (const [sku, qty] of Object.entries(order.items)) {
    if (!CATALOG[sku] || !Number.isInteger(qty) || qty < 1) fail('Order contains an invalid item.');
    for (const [ingredient, units] of Object.entries(CATALOG[sku].ingredients)) result[ingredient] = (result[ingredient] || 0) + qty * units;
  }
  return result;
}
export function validateChanges(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) fail('Scenario changes must be an object.');
  const allowed = ['absentWorker', 'shortage', 'equipmentDown', 'rush'];
  if (Object.keys(changes).some(k => !allowed.includes(k))) fail('Unknown scenario setting.');
  if (changes.absentWorker && !['mina', 'leo', 'sam', 'jules'].includes(changes.absentWorker)) fail('Unknown worker.');
  if (changes.shortage && !Object.hasOwn(INGREDIENTS, changes.shortage)) fail('Unknown ingredient.');
  if (changes.equipmentDown && !['grill', 'fryer', 'prep', 'packing'].includes(changes.equipmentDown)) fail('Unknown station.');
  if (changes.rush !== undefined && typeof changes.rush !== 'boolean') fail('Rush must be true or false.');
  return { absentWorker: changes.absentWorker || '', shortage: changes.shortage || '', equipmentDown: changes.equipmentDown || '', rush: Boolean(changes.rush) };
}
export function disrupt(input, rawChanges) {
  const changes = validateChanges(rawChanges);
  const state = clone(input);
  if (changes.absentWorker) state.staff.find(s => s.id === changes.absentWorker).available = false;
  if (changes.shortage) state.inventory[changes.shortage] = 0;
  if (changes.equipmentDown) state.stations.find(s => s.id === changes.equipmentDown).available = false;
  if (changes.rush) {
    if (state.orders.length > 44) fail('Reset the restaurant before adding another six-order rush.');
    let sequence = 1;
    for (let i = 0; i < 6; i++) {
      while (state.orders.some(o => o.id === `R${sequence}`)) sequence++;
      state.orders.push({ id: `R${sequence++}`, customer: `Rush order ${i + 1}`, source: 'Rush · simulated', due: 14 + i * 2, arrival: 3, status: 'queued', revision: 1, items: i % 2 ? { wrap: 1, fries: 1, sprite: 1 } : { burger: 1, fries: 1 }, note: '' });
    }
  }
  return state;
}
export function validateObservation(value) {
  if (!value || !['clear', 'uncertain'].includes(value.quality) || typeof value.occluded !== 'boolean' || !Array.isArray(value.items) || value.items.length > 24) fail('The vision response could not be validated. Please retry or use a manual check.', 502);
  for (const item of value.items) {
    if (!item || ![...Object.keys(CATALOG), 'unknown'].includes(item.sku) || !Number.isInteger(item.count) || item.count < 0 || item.count > 20 || !['clear', 'uncertain'].includes(item.certainty)) fail('The vision response contains an invalid observation.', 502);
  }
  if (!Array.isArray(value.notes) || value.notes.length > 10 || value.notes.some(n => typeof n !== 'string' || n.length > 500)) fail('The vision notes could not be validated.', 502);
  return value;
}
export function comparePacking(order, rawObservation) {
  const observation = validateObservation(rawObservation);
  const counts = {};
  let uncertain = observation.quality !== 'clear' || observation.occluded;
  for (const item of observation.items) {
    counts[item.sku] = (counts[item.sku] || 0) + item.count;
    if (item.count > 0 && (item.certainty !== 'clear' || item.sku === 'unknown')) uncertain = true;
  }
  const rows = Object.keys(CATALOG).filter(sku => order.items[sku] || counts[sku]).map(sku => ({ sku, name: CATALOG[sku].name, expected: order.items[sku] || 0, observed: counts[sku] || 0 }));
  const mismatch = rows.some(r => r.expected !== r.observed);
  return { status: uncertain ? 'amber' : mismatch ? 'red' : 'green', rows, observation };
}
export function demoObservation(order, mode) {
  if (!['complete', 'missing', 'obscured'].includes(mode)) fail('Unknown demo fixture.');
  const items = Object.entries(order.items).map(([sku, count]) => ({ sku, count, certainty: 'clear' }));
  if (mode === 'missing') { const item = items.find(i => i.sku === 'sprite') || items[0]; item.count = Math.max(0, item.count - 1); }
  return { quality: mode === 'obscured' ? 'uncertain' : 'clear', occluded: mode === 'obscured', items, notes: [mode === 'complete' ? 'Scripted complete-order fixture. No camera inference was performed.' : mode === 'missing' ? 'Scripted missing-item fixture. No camera inference was performed.' : 'Scripted occlusion fixture. Reposition the items and check again.'] };
}
export function recordVerification(state, orderId, observation, mode) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'packing') fail('This order is no longer at packing.', 409);
  const check = { ...comparePacking(order, observation), id: randomUUID(), mode, revision: order.revision, at: new Date().toISOString() };
  order.verification = check;
  event(state, `${order.id}: ${mode === 'vision' ? 'camera' : mode} check ${check.status}.`, check.status === 'red' ? 'warning' : 'info');
  return check;
}
export function readyOrder(state, orderId, verificationId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'packing') fail('Only an order at packing can become ready.', 409);
  const check = order.verification;
  if (!check || check.id !== verificationId || check.status !== 'green' || check.revision !== order.revision || Date.now() - Date.parse(check.at) > 300_000) fail('Run a fresh matching packing check before marking ready.', 409);
  order.status = 'ready';
  order.revision += 1;
  order.pickupCode = pickupToken();
  order.readyAt = new Date().toISOString();
  event(state, `${order.id} ready for pickup (${check.mode} verification).`, 'success');
  return order;
}
export function collectOrder(state, orderId, code) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'ready') fail('This order is not ready or was already collected.', 409);
  if (typeof code !== 'string' || code.trim().toUpperCase() !== order.pickupCode) fail('Pickup reference does not match. Keep this order at the station.', 409);
  if (Date.now() - Date.parse(order.readyAt) > 900_000) fail('Pickup reference expired. Return the order to packing for a fresh check.', 409);
  order.status = 'collected';
  order.revision += 1;
  order.collectedAt = new Date().toISOString();
  delete order.pickupCode;
  event(state, `${order.id} collected with the matching reference.`, 'success');
  return order;
}
export function prepareOrder(state, orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'queued') fail('Only a queued order can be prepared.', 409);
  const needs = requirements(order);
  for (const [id, qty] of Object.entries(needs)) if (state.inventory[id] < qty) fail(`${INGREDIENTS[id]}: ${qty} required, ${state.inventory[id]} available.`, 409);
  for (const sku of Object.keys(order.items)) {
    const station = CATALOG[sku].station;
    if (station && (!state.stations.find(s => s.id === station).available || !state.staff.some(s => s.available && s.skills.includes(station)))) fail(`No available capacity for ${station}. Try a recovery scenario.`, 409);
  }
  for (const [id, qty] of Object.entries(needs)) state.inventory[id] -= qty;
  order.status = 'preparing'; order.revision += 1;
  event(state, `${order.id}: preparation started in the simulation; ingredient stock reserved.`, 'info');
  return order;
}
export function finishPreparation(state, orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order || order.status !== 'preparing') fail('Start preparation before completing it.', 409);
  for (const sku of Object.keys(order.items)) {
    const station = CATALOG[sku].station;
    if (station && (!state.stations.find(s => s.id === station).available || !state.staff.some(s => s.available && s.skills.includes(station)))) fail(`Preparation is blocked at ${station}. Restore capacity before completing this task.`, 409);
  }
  order.status = 'packing'; order.revision++;
  event(state, `${order.id}: simulated preparation completed; sent to packing.`);
  return order;
}
