import { CATALOG, INGREDIENTS, fail, event, requirements } from './domain.mjs';

const TARGETS = { buns: 12, patties: 12, chicken: 7, tortillas: 10, potatoes: 18, drinks: 16 };
const PRICES = { burger: 850, wrap: 800, fries: 300, sprite: 200 };
const COSTS = { buns: 60, patties: 200, chicken: 180, tortillas: 50, potatoes: 60, drinks: 75 };
export function ensureOperations(state) {
  state.operations ||= {};
  const ops = state.operations;
  for (const key of ['analyses', 'pricing', 'ingredientCosts']) ops[key] ||= {};
  ops.pricing = { ...PRICES, ...ops.pricing };
  ops.ingredientCosts = { ...COSTS, ...ops.ingredientCosts };
  for (const key of ['restockRequests', 'restocks', 'receipts', 'waste']) ops[key] ||= [];
  return ops;
}
function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}
function ingredient(id) { if (!Object.hasOwn(INGREDIENTS, id)) fail('Choose a known ingredient.'); return id; }
function token(value) { if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(value)) fail('A unique action reference is required.'); return value; }
export function operationsEvidence(state) {
  const ops = ensureOperations(state), committed = {};
  for (const order of state.orders.filter(o => o.status === 'queued')) for (const [id, n] of Object.entries(requirements(order))) committed[id] = (committed[id] || 0) + n;
  const forecast = ops.analyses.inventory?.basedOnVersion === state.version ? ops.analyses.inventory.data.forecasts : [];
  const inventory = Object.entries(INGREDIENTS).map(([id, name]) => {
    const onHand = state.inventory[id], demand = committed[id] || 0, available = onHand - demand;
    const prediction = forecast?.find(f => f.ingredient === id)?.unitsNext30Min || 0;
    const shortage = Math.max(0, prediction + demand - onHand), alert = available <= 3 || shortage > 0;
    return { id, name, onHand, committed: demand, available, reorderPoint: 3, target: TARGETS[id], suggestedQuantity: Math.max(0, TARGETS[id] + demand - onHand, shortage), alert, reason: available <= 0 ? 'No uncommitted stock remains.' : available <= 3 ? 'Uncommitted stock is at or below the reorder point.' : shortage ? 'AI estimate exceeds stock after current tickets.' : 'Stock above reorder point.' };
  });
  const orders = state.orders.filter(o => !['cancelled', 'collected', 'delivered'].includes(o.status)).map(o => {
    const blockingReasons = [];
    if (o.status === 'queued') for (const [id, n] of Object.entries(requirements(o))) if (state.inventory[id] < n) blockingReasons.push(`${INGREDIENTS[id]}: ${n} needed, ${state.inventory[id]} on hand.`);
    for (const station of new Set(Object.keys(o.items).map(sku => CATALOG[sku].station).filter(Boolean))) {
      if (!state.stations.some(s => s.id === station && s.available)) blockingReasons.push(`${station} equipment unavailable.`);
      if (!state.staff.some(w => w.available && w.skills.includes(station))) blockingReasons.push(`No qualified available worker for ${station}.`);
    }
    return { id: o.id, status: o.status, items: o.items, due: o.due, createdAt: o.createdAt || null, delivery: o.delivery ? { name: o.delivery.name, courierArrivesAt: o.delivery.courierArrivesAt || null, travelSeconds: o.delivery.travelSeconds } : null, canStart: o.status === 'queued' && !blockingReasons.length, blockingReasons };
  });
  const completed = state.orders.filter(o => ['collected', 'delivered'].includes(o.status));
  let simulatedRevenueCents = 0, estimatedFoodCostCents = 0;
  for (const order of completed) {
    for (const [sku, n] of Object.entries(order.items)) simulatedRevenueCents += ops.pricing[sku] * n;
    for (const [id, n] of Object.entries(requirements(order))) estimatedFoodCostCents += ops.ingredientCosts[id] * n;
  }
  const currencies = {};
  for (const receipt of ops.receipts) { currencies[receipt.currency] ||= { currency: receipt.currency, totalCents: 0, count: 0 }; currencies[receipt.currency].totalCents += receipt.totalCents; currencies[receipt.currency].count++; }
  const finance = { currency: 'USD', completedOrders: completed.length, simulatedRevenueCents, estimatedFoodCostCents, contributionCents: simulatedRevenueCents - estimatedFoodCostCents, loggedWasteCents: ops.waste.reduce((n, w) => n + w.costCents, 0), receiptsByCurrency: Object.values(currencies), assumptions: 'Simulated menu prices in USD; estimated ingredient costs use demo defaults, updated only from reviewed USD receipt lines. Contribution excludes labor, delivery fees, tax, rent, and other overhead. Receipt totals are separate expenses and are not subtracted twice. These are demo estimates, not actual sales or profit.' };
  return { inventory, orders, catalog: CATALOG, staff: state.staff, stations: state.stations, finance, history: { startedAt: state.createdAt, totalOrders: state.orders.filter(o => o.status !== 'cancelled').length, submittedAt: new Date().toISOString(), note: 'Sparse demo history; use explicit low-confidence assumptions for the next 30 minutes. Inventory is on-hand after ingredients already reserved for cooking. Queued demand is separately committed. Do not count current commitments again in unitsNext30Min; forecast additional future demand only.' } };
}
export function requestRestock(state, input, source = 'Staff request') {
  const ops = ensureOperations(state), id = ingredient(input.ingredient), quantity = integer(input.quantity, 1, 1000, 'Restock quantity');
  const pending = ops.restockRequests.find(r => r.ingredient === id && r.status === 'pending');
  if (pending) { pending.quantity = Math.max(pending.quantity, quantity); return pending; }
  if (ops.restockRequests.filter(r => r.status === 'pending').length >= 20) fail('Resolve an open restock request first.', 409);
  const request = { id: crypto.randomUUID(), ingredient: id, quantity, source, status: 'pending', createdAt: new Date().toISOString() };
  ops.restockRequests.unshift(request); ops.restockRequests = ops.restockRequests.slice(0, 60);
  event(state, `Owner alert: restock ${quantity} ${INGREDIENTS[id]} (${source}).`, 'warning');
  return request;
}
export function receiveRestock(state, input) {
  const ops = ensureOperations(state), id = ingredient(input.ingredient), quantity = integer(input.quantity, 1, 1000, 'Received quantity'), key = token(input.idempotencyKey);
  if (ops.restocks.some(r => r.idempotencyKey === key)) fail('This restock has already been recorded.', 409);
  const request = input.requestId ? ops.restockRequests.find(r => r.id === input.requestId) : null;
  if (input.requestId && (!request || request.status !== 'pending' || request.ingredient !== id)) fail('This restock request is no longer open.', 409);
  if (state.inventory[id] + quantity > 1000) fail('Total stock cannot exceed 1,000 units.');
  state.inventory[id] += quantity;
  if (request) { request.receivedQuantity = (request.receivedQuantity || 0) + quantity; request.quantity = Math.max(0, request.quantity - quantity); if (!request.quantity) { request.status = 'received'; request.receivedAt = new Date().toISOString(); } }
  ops.restocks.unshift({ id: crypto.randomUUID(), ingredient: id, quantity, idempotencyKey: key, requestId: request?.id || null, at: new Date().toISOString() }); ops.restocks = ops.restocks.slice(0, 100);
  state.appliedPlan = null;
  event(state, `Received ${quantity} ${INGREDIENTS[id]}. Stock is now ${state.inventory[id]}.`, 'success');
}
export function recordWaste(state, input) {
  const ops = ensureOperations(state), id = ingredient(input.ingredient), quantity = integer(input.quantity, 1, 1000, 'Waste quantity'), key = token(input.idempotencyKey);
  if (ops.waste.some(w => w.idempotencyKey === key)) fail('This waste has already been recorded.', 409);
  if (quantity > state.inventory[id]) fail('Waste cannot exceed stock on hand.', 409);
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 240) : '';
  if (!reason) fail('Enter the reason for the waste.');
  state.inventory[id] -= quantity;
  ops.waste.unshift({ id: crypto.randomUUID(), ingredient: id, quantity, reason, costCents: ops.ingredientCosts[id] * quantity, idempotencyKey: key, at: new Date().toISOString() }); ops.waste = ops.waste.slice(0, 100);
  state.appliedPlan = null; event(state, `Logged waste: ${quantity} ${INGREDIENTS[id]} (${reason}).`, 'warning');
}
export function saveReviewedReceipt(state, input) {
  const ops = ensureOperations(state), draft = ops.analyses.receipt;
  if (!draft || draft.id !== input.draftId) fail('Analyze the receipt again before saving.', 409);
  if (ops.receipts.some(r => r.draftId === input.draftId)) fail('This receipt draft has already been saved.', 409);
  const merchant = typeof input.merchant === 'string' ? input.merchant.trim().slice(0, 160) : '';
  if (!merchant) fail('Enter the receipt merchant.');
  if (typeof input.currency !== 'string' || !/^[A-Z]{3}$/.test(input.currency)) fail('Use a three-letter uppercase currency code.');
  const totalCents = integer(input.totalCents, 0, 100000000, 'Receipt total in minor units');
  if (!Array.isArray(input.lines) || input.lines.length > 30) fail('Review up to 30 receipt lines.');
  const lines = input.lines.map(line => {
    if (line.ingredient) ingredient(line.ingredient);
    const description = typeof line.description === 'string' ? line.description.trim().slice(0, 240) : '';
    if (!description) fail('Every receipt line needs a description.');
    return { description, ingredient: line.ingredient || '', quantity: integer(line.quantity, 0, 1000, 'Line quantity'), totalCents: integer(line.totalCents, 0, 100000000, 'Line total') };
  });
  if (lines.reduce((n, line) => n + line.totalCents, 0) > totalCents) fail('Line totals exceed the receipt total. Review the extraction.');
  if (input.date && (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date)) fail('Receipt date must be YYYY-MM-DD or blank.');
  const receipt = { id: crypto.randomUUID(), draftId: input.draftId, merchant, date: input.date || '', currency: input.currency, totalCents, lines, reviewedAt: new Date().toISOString() };
  ops.receipts.unshift(receipt); ops.receipts = ops.receipts.slice(0, 50);
  if (receipt.currency === 'USD') for (const line of lines) if (line.ingredient && line.quantity > 0) ops.ingredientCosts[line.ingredient] = Math.round(line.totalCents / line.quantity);
  event(state, `Reviewed receipt saved: ${merchant}. Ingredient stock was not changed.`);
  return receipt;
}
