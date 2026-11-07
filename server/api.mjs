import { CATALOG, INGREDIENTS, clone, initialState, snapshot, fail, event, validateChanges, disrupt, demoObservation, recordVerification, readyOrder, collectOrder, prepareOrder, finishPreparation, completeGameStation, makeDelivery, confirmDelivery } from './domain.mjs';
import { availableInventory, stockIssue } from '../shared/stock.mjs';
import { controlPlayback } from '../shared/replay.mjs';
import { HOMES } from '../shared/delivery.mjs';
import { validatePresence } from './presence.mjs';
import { simulate, compareScenario } from './simulation.mjs';
import { inspectImage, explainScenario } from './vision.mjs';
import { ensureOperations, operationsEvidence, requestRestock, receiveRestock, recordWaste, saveReviewedReceipt } from './operations.mjs';
import { runCopilot } from './ai-copilots.mjs';
import { aiModels } from './models.mjs';
const randomUUID = () => crypto.randomUUID();
let visionRunning = false;
const visionTimes = [];
function json(_res, status, value) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }); }
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('Expected a JSON request.', 415);
  if (Number(req.headers['content-length'] || 0) > 7_000_000) fail('This request is too large.', 413);
  const text = await req.web.text();
  if (text.length > 7_000_000) fail('This request is too large.', 413);
  try { return JSON.parse(text || '{}'); } catch { fail('Request contains invalid JSON.'); }
}
function validateItems(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !CATALOG[k])) fail('Choose items from the menu.');
  if (Object.values(raw).some(n => !Number.isSafeInteger(n) || n < 0)) fail('Quantities must be non-negative whole numbers.');
  const items = Object.fromEntries(Object.entries(raw).filter(([, n]) => n > 0));
  if (!Object.keys(items).length) fail('Choose at least one item, or cancel the ticket.');
  return items;
}
export function createApi({ store, presence, env = {}, extraConfig = {}, aiRunner = runCopilot }) {
  return async function handle(request) {
    try {
      const requestUrl = new URL(request.url);
      if (request.method === 'POST' && requestUrl.pathname === '/api/presence') {
        if (request.headers.get('origin') && new URL(request.headers.get('origin')).host !== requestUrl.host || request.headers.get('sec-fetch-site') === 'cross-site') fail('Cross-origin changes are not supported.', 403);
        if (!presence) fail('Shared movement is unavailable.', 503);
        const input = await body({ headers: Object.fromEntries(request.headers), web: request });
        if (input.leave === true) { if (!/^[a-zA-Z0-9-]{8,80}$/.test(input.id || '')) fail('Invalid player.'); await presence.remove(input.id); return json({}, 200, { ok: true }); }
        await presence.put(validatePresence(input));
        return json({}, 200, { ok: true, serverTime: Date.now() });
      }
      let state = await store.load();
      ensureOperations(state);
      async function update(fn, live = true) {
        const next = clone(state);
        const result = fn(next);
        next.revision = (state.revision || 1) + 1;
        next.version = live ? state.version + 1 : state.version;
        await store.save(next, state.revision || 1);
        state = next;
        return result;
      }
      const config = () => ({ visionConfigured: Boolean(env.OPENROUTER_API_KEY), model: aiModels(env).packing, aiModels: aiModels(env), catalog: CATALOG, ingredients: INGREDIENTS, homes: HOMES, lanUrls: [], ...extraConfig });
      const payload = () => ({ state, config: config(), operations: operationsEvidence(state) });
      function getOrder(id) { const order = state.orders.find(o => o.id === id); if (!order) fail('Order not found.', 404); return order; }
async function api(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, payload());
  if (req.method === 'GET' && pathname === '/api/live') return json(res, 200, { ...(Number(requestUrl.searchParams.get('revision')) !== state.revision ? payload() : {}), players: presence ? await presence.list() : [], revision: state.revision, serverTime: Date.now() });
  if (req.method === 'GET' && pathname === '/api/health') return json(res, 200, { ok: true, visionConfigured: config().visionConfigured });
  if (req.method !== 'POST') fail('Route not found.', 404);
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) fail('Cross-origin changes are not supported.', 403);
  if (req.headers['sec-fetch-site'] === 'cross-site') fail('Cross-site changes are not supported.', 403);
  const input = await body(req);
  if (pathname === '/api/restock-requests') {
    await update(next => requestRestock(next, input), false);
    return json(res, 201, payload());
  }
  if (pathname === '/api/restock') {
    await update(next => receiveRestock(next, input));
    return json(res, 200, payload());
  }
  if (pathname === '/api/inventory/waste') {
    await update(next => recordWaste(next, input));
    return json(res, 200, payload());
  }
  if (pathname === '/api/receipts') {
    await update(next => saveReviewedReceipt(next, input));
    return json(res, 201, payload());
  }
  if (pathname === '/api/ai/prep/start') {
    const analysis = state.operations.analyses.prep;
    if (!analysis || analysis.id !== input.analysisId || analysis.basedOnVersion !== state.version) fail('The kitchen changed. Refresh the AI preparation plan before starting an order.', 409);
    if (!analysis.data.priorities.some(p => p.orderId === input.orderId && p.action === 'start')) fail('This order was not recommended to start.', 409);
    await update(next => { prepareOrder(next, input.orderId); next.appliedPlan = null; });
    return json(res, 200, payload());
  }
  const copilotRoute = pathname.match(/^\/api\/ai\/(prep|inventory|staff|finance|receipt)$/);
  if (copilotRoute) {
    const kind = copilotRoute[1], evidence = operationsEvidence(state), base = snapshot(state), basedOnVersion = state.version;
    if (kind === 'prep') evidence.prepSchedule = simulate(base, 'adaptive');
    if (kind === 'staff' && (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2000)) fail('Describe the staffing or equipment disruption in up to 2,000 characters.');
    const model = aiModels(env)[kind];
    const data = await aiRunner(kind, evidence, input, { key: env.OPENROUTER_API_KEY, model, reasoning: ['prep', 'inventory', 'staff', 'finance'].includes(kind) });
    // Keep the result if another player moved the kitchen forward during inference.
    // Its original version remains visible, and stale recommendations cannot act.
    state = await store.load(); ensureOperations(state);
    await update(next => {
      if (kind === 'staff') {
        const changes = validateChanges({ absentWorker: data.absentWorker, equipmentDown: data.equipmentDown });
        const scenario = { id: randomUUID(), name: 'AI disruption: ' + input.message.trim().slice(0, 50), createdAt: new Date().toISOString(), snapshot: base, changes, comparison: compareScenario(base, changes) };
        next.scenarios.unshift(scenario); next.scenarios = next.scenarios.slice(0, 20); data.scenarioId = scenario.id;
      }
      next.operations.analyses[kind] = { id: randomUUID(), generatedAt: new Date().toISOString(), basedOnVersion, model, data };
      if (kind === 'inventory' && basedOnVersion === next.version) {
        for (const row of operationsEvidence(next).inventory.filter(r => r.alert && r.suggestedQuantity > 0)) requestRestock(next, { ingredient: row.id, quantity: Math.min(1000, row.suggestedQuantity) }, 'AI inventory review');
      }
      event(next, `AI ${kind} review completed with ${model}.`);
    }, false);
    return json(res, 200, payload());
  }
  if (pathname === '/api/reset') {
    await update(next => { const library = next.scenarios; const fresh = initialState(); Object.assign(next, fresh); next.scenarios = library; event(next, 'Restaurant reset to zero orders. Saved scenarios are preserved.'); });
    return json(res, 200, payload());
  }
  if (pathname === '/api/resources') {
    await update(next => {
      if (input.type === 'staff') {
        const worker = next.staff.find(w => w.id === input.id); if (!worker || typeof input.available !== 'boolean') fail('Invalid staff update.');
        worker.available = input.available; event(next, `${worker.name} ${worker.available ? 'returned to the shift' : 'is unavailable'}.`, worker.available ? 'info' : 'warning');
      } else if (input.type === 'station') {
        const station = next.stations.find(s => s.id === input.id); if (!station || typeof input.available !== 'boolean') fail('Invalid station update.');
        station.available = input.available; event(next, `${station.name} ${station.available ? 'is operating' : 'is unavailable'}.`, station.available ? 'info' : 'warning');
      } else if (input.type === 'inventory') {
        if (!Object.hasOwn(next.inventory, input.id) || !Number.isInteger(input.quantity) || input.quantity < 0 || input.quantity > 1000) fail('Stock must be a whole number from 0 to 1,000.');
        next.inventory[input.id] = input.quantity; event(next, `${INGREDIENTS[input.id]} updated to ${input.quantity}.`, input.quantity ? 'info' : 'warning');
      } else fail('Unknown resource type.');
      next.appliedPlan = null;
    }); return json(res, 200, payload());
  }
  if (pathname === '/api/orders') {
    const name = typeof input.customer === 'string' ? input.customer.trim().slice(0, 40) : '';
    if (!name) fail('Enter a name for this sample order.');
    const items = validateItems(input.items);
    const shortage = stockIssue(items, availableInventory(state, CATALOG), CATALOG);
    if (shortage) fail(INGREDIENTS[shortage.id] + ': ' + shortage.required + ' needed, ' + shortage.available + ' available after existing tickets.', 409);
    const delivery = input.fulfillment === 'delivery' ? makeDelivery(input.homeId) : null;
    if (input.fulfillment && !['delivery', 'pickup'].includes(input.fulfillment)) fail('Choose pickup or delivery.');
    if (state.orders.length >= 50) fail('This demo has reached 50 orders. Reset the restaurant to start another run.');
    const id = `C${randomUUID().slice(0, 5).toUpperCase()}`;
    await update(next => { next.orders.push({ id, customer: name, source: 'Customer · sample', due: 18, arrival: 0, createdAt: new Date().toISOString(), status: 'queued', revision: 1, items, fulfillment: delivery ? 'delivery' : 'pickup', ...(delivery ? { delivery } : {}), note: 'Placed from the customer view.' }); next.appliedPlan = null; event(next, `${id}: ${name} placed an order.`, 'success'); });
    return json(res, 201, { ...payload(), orderId: id });
  }
  const orderRoute = pathname.match(/^\/api\/orders\/([^/]+)\/(prepare|finish|game-cook|verify|ready|collect|deliver|edit|cancel|recheck)$/);
  if (orderRoute) {
    const [, id, action] = orderRoute;
    const order = getOrder(id);
    if (action === 'edit' || action === 'cancel') {
      if (order.status !== 'queued') fail('Editing closes once the kitchen accepts this ticket.', 409);
      if (action === 'cancel') await update(next => { const o = next.orders.find(o => o.id === id); o.status = 'cancelled'; o.revision++; next.appliedPlan = null; event(next, id + ': customer cancelled the unstarted ticket.'); });
      else {
        const items = validateItems(input.items);
        const shortage = stockIssue(items, availableInventory(state, CATALOG, id), CATALOG);
        if (shortage) fail(INGREDIENTS[shortage.id] + ': only ' + shortage.available + ' available for this edit.', 409);
        await update(next => { const o = next.orders.find(o => o.id === id); o.items = items; o.revision++; next.appliedPlan = null; event(next, id + ': customer updated the items.'); });
      }
    } else if (action === 'verify') {
      if (order.status !== 'packing') fail('Move this order to packing first.', 409);
      const revision = order.revision;
      let observation;
      if (input.mode === 'vision') {
        if (visionRunning) fail('Another camera frame is being analyzed. Try again in a moment.', 429);
        const now = Date.now(); while (visionTimes[0] < now - 60_000) visionTimes.shift();
        if (visionTimes.length >= 10) fail('The demo allows 10 camera checks per minute. Please wait a moment.', 429);
        visionTimes.push(now); visionRunning = true;
        try { observation = await inspectImage(input.image, { key: env.OPENROUTER_API_KEY, model: aiModels(env).packing }); } catch (error) { if (error.name === 'TimeoutError') fail('The vision request timed out. Retry or use a manual check.', 504); throw error; } finally { visionRunning = false; }
      } else if (input.mode === 'demo') observation = demoObservation(order, input.fixture);
      else if (input.mode === 'manual' || input.mode === 'game') observation = input.observation;
      else fail('Choose camera, manual, game, or demo verification.');
      await update(next => { const current = next.orders.find(o => o.id === id); if (current.revision !== revision) fail('The order changed during analysis. Take a new frame.', 409); recordVerification(next, id, observation, input.mode); });
    } else if (action === 'prepare') await update(next => { prepareOrder(next, id); next.appliedPlan = null; });
    else if (action === 'finish') await update(next => { finishPreparation(next, id); next.appliedPlan = null; });
    else if (action === 'game-cook') await update(next => { completeGameStation(next, id, input.station); next.appliedPlan = null; });
    else if (action === 'ready') await update(next => readyOrder(next, id, input.verificationId));
    else if (action === 'collect') await update(next => collectOrder(next, id, input.code));
    else if (action === 'deliver') await update(next => confirmDelivery(next, id));
    else await update(next => { const o = next.orders.find(o => o.id === id); if (o.status !== 'ready' && o.status !== 'packing') fail('Only an active packing or ready order can be rechecked.', 409); o.status = 'packing'; o.revision++; delete o.verification; delete o.pickupCode; delete o.readyAt; event(next, `${id} returned to packing for a fresh check.`); });
    return json(res, 200, payload());
  }
  if (pathname === '/api/scenarios') {
    const changes = validateChanges(input.changes);
    const base = snapshot(state);
    const comparison = compareScenario(base, changes);
    const scenario = { id: randomUUID(), name: (typeof input.name === 'string' ? input.name.trim().slice(0, 70) : '') || 'Kitchen recovery drill', createdAt: new Date().toISOString(), snapshot: base, changes, comparison };
    await update(next => { next.scenarios.unshift(scenario); next.scenarios = next.scenarios.slice(0, 20); }, false);
    return json(res, 201, { ...payload(), scenarioId: scenario.id });
  }
  if (pathname === '/api/playback') {
    if (input.action === 'stop') await update(next => { next.playback = null; }, false);
    else if (input.action) {
      let controlled;
      try { controlled = controlPlayback(state.playback, input); } catch (error) { fail(error.message); }
      await update(next => { next.playback = controlled; }, false);
    } else {
      if (!state.scenarios.some(s => s.id === input.scenarioId)) fail('Choose a saved scenario first.');
      if (!['fixed', 'adaptive'].includes(input.policy)) fail('Choose a comparison policy.');
      await update(next => { next.playback = { scenarioId: input.scenarioId, policy: input.policy, startedAt: Date.now(), speed: 2, position: 0, paused: false }; }, false);
    }
    return json(res, 200, payload());
  }
  const scenarioRoute = pathname.match(/^\/api\/scenarios\/([^/]+)\/(replay|apply|restart|explain)$/);
  if (scenarioRoute) {
    const [, id, action] = scenarioRoute;
    const scenario = state.scenarios.find(s => s.id === id);
    if (!scenario) fail('Scenario not found.', 404);
    if (action === 'explain') {
      const text = await explainScenario(scenario, { key: env.OPENROUTER_API_KEY, model: aiModels(env).staff });
      await update(next => { const s = next.scenarios.find(s => s.id === id); if (s) s.explanation = text; }, false);
    } else if (action === 'replay') {
      const comparison = compareScenario(scenario.snapshot, scenario.changes);
      await update(next => { next.scenarios.find(s => s.id === id).comparison = comparison; }, false);
    } else {
      if (action === 'apply' && scenario.snapshot.version !== state.version) fail('The kitchen changed since this plan was simulated. Run a new comparison, or explicitly restart this saved drill.', 409);
      const nextState = disrupt(scenario.snapshot, scenario.changes);
      await update(next => {
        for (const key of ['orders', 'staff', 'stations', 'inventory']) next[key] = clone(nextState[key]);
        if (action === 'restart') for (const order of next.orders) { delete order.verification; delete order.pickupCode; delete order.readyAt; if (order.status === 'ready') order.status = 'packing'; order.revision++; }
        next.appliedPlan = { scenarioId: id, name: scenario.name, comparison: scenario.comparison };
        next.playback = null;
        event(next, `${action === 'restart' ? 'Restarted' : 'Applied'} drill: ${scenario.name}. Upstream changes are simulated.`, 'warning');
      });
    }
    return json(res, 200, payload());
  }
  if (pathname === '/api/forecast') return json(res, 200, simulate(snapshot(state), 'adaptive'));
  fail('Route not found.', 404);
}
      const url = new URL(request.url);
      const req = { method: request.method, headers: { ...Object.fromEntries(request.headers), host: url.host }, web: request };
      return await api(req, {}, url.pathname);
    } catch (error) {
      return json({}, error.status || 500, { error: error.status ? error.message : error.name === 'TimeoutError' ? 'The AI request timed out. The simulation still works; please retry.' : 'The demo server could not complete this request.' });
    }
  };
}
