import { CATALOG, INGREDIENTS, clone, requirements, disrupt, fail } from './domain.mjs';

export function simulate(input, policy = 'fixed', horizon = 60) {
  if (!['fixed', 'adaptive'].includes(policy)) fail('Unknown planning policy.');
  const state = clone(input);
  const stock = clone(state.inventory);
  const workers = state.staff.filter(w => w.available).map(w => ({ ...w, free: 0 }));
  const stations = state.stations.map(s => ({ ...s, free: 0 }));
  const orders = state.orders.filter(o => o.status !== 'collected');
  const tasks = [];
  const results = [];
  const canStaff = station => workers.some(w => w.skills.includes(station) && (policy === 'adaptive' || w.home === station));
  for (const order of [...orders].sort((a, b) => a.due - b.due || a.id.localeCompare(b.id))) {
    const result = { id: order.id, customer: order.customer, due: order.due, arrival: order.arrival, status: 'pending', finish: null, reason: '', taskIds: [] };
    results.push(result);
    if (order.status === 'ready') { result.status = 'done'; result.finish = 0; continue; }
    const requiredStations = order.status === 'packing' ? ['packing'] : [...new Set([...Object.keys(order.items).map(s => CATALOG[s].station).filter(Boolean), 'packing'])];
    const failedStation = requiredStations.find(id => !stations.find(s => s.id === id)?.available || !canStaff(id));
    if (failedStation) {
      result.status = 'blocked';
      result.reason = !stations.find(s => s.id === failedStation)?.available ? `${failedStation} equipment unavailable` : `No ${policy === 'fixed' ? 'assigned' : 'qualified'} worker available for ${failedStation}`;
      continue;
    }
    if (order.status === 'queued') {
      const needs = requirements(order);
      const short = Object.entries(needs).find(([id, qty]) => stock[id] < qty);
      if (short) { result.status = 'blocked'; result.reason = `${INGREDIENTS[short[0]]}: ${short[1]} needed, ${stock[short[0]]} available`; continue; }
      for (const [id, qty] of Object.entries(needs)) stock[id] -= qty;
      for (const [sku, count] of Object.entries(order.items)) {
        const recipe = CATALOG[sku];
        if (!recipe.station) continue;
        for (let n = 0; n < count; n++) {
          const id = `${order.id}:${sku}:${n}`;
          tasks.push({ id, orderId: order.id, label: recipe.name, station: recipe.station, duration: recipe.duration, due: order.due, arrival: order.arrival, dependencies: [], start: null, end: null, workerId: null });
          result.taskIds.push(id);
        }
      }
    }
    const id = `${order.id}:pack`;
    tasks.push({ id, orderId: order.id, label: 'Pack order', station: 'packing', duration: 1.5, due: order.due, arrival: order.arrival, dependencies: [...result.taskIds], start: null, end: null, workerId: null });
    result.taskIds.push(id);
  }
  let time = 0;
  for (let iteration = 0; iteration < 5000; iteration++) {
    const waiting = tasks.filter(t => t.start === null);
    if (!waiting.length || time >= horizon) break;
    const eligible = waiting.filter(t => t.arrival <= time && t.dependencies.every(id => { const d = tasks.find(x => x.id === id); return d.end !== null && d.end <= time; })).sort((a, b) => a.due - b.due || a.id.localeCompare(b.id));
    for (const task of eligible) {
      const station = stations.find(s => s.id === task.station);
      if (station.free > time) continue;
      const worker = workers.filter(w => w.free <= time && w.skills.includes(task.station) && (policy === 'adaptive' || w.home === task.station)).sort((a, b) => Number(b.home === task.station) - Number(a.home === task.station) || a.skills.length - b.skills.length || a.id.localeCompare(b.id))[0];
      if (!worker || time + task.duration > horizon) continue;
      task.start = time; task.end = time + task.duration; task.workerId = worker.id;
      station.free = task.end; worker.free = task.end;
    }
    const future = [...tasks.filter(t => t.end !== null && t.end > time).map(t => t.end), ...tasks.filter(t => t.start === null && t.arrival > time).map(t => t.arrival)];
    if (!future.length) break;
    time = Math.min(...future);
  }
  for (const result of results.filter(r => r.status === 'pending')) {
    const pack = tasks.find(t => t.id === `${result.id}:pack`);
    if (pack?.end !== null && pack?.end !== undefined) { result.status = 'done'; result.finish = pack.end; }
    else { result.status = 'blocked'; result.reason = `Not completed within the ${horizon}-minute horizon`; }
  }
  const completed = results.filter(r => r.status === 'done');
  const onTime = completed.filter(r => r.finish <= r.due);
  const schedule = tasks.filter(t => t.start !== null).sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const utilization = state.stations.map(s => ({ id: s.id, name: s.name, busy: schedule.filter(t => t.station === s.id).reduce((sum, t) => sum + t.duration, 0) }));
  const moves = [...new Set(schedule.filter(t => state.staff.find(w => w.id === t.workerId).home !== t.station).map(t => `${state.staff.find(w => w.id === t.workerId).name} → ${state.stations.find(s => s.id === t.station).name}`))];
  return {
    policy, horizon, orders: results, schedule, remainingStock: stock, utilization, moves,
    metrics: { total: results.length, completed: completed.length, onTime: onTime.length, late: completed.length - onTime.length, blocked: results.length - completed.length, averageTime: completed.length ? Math.round(completed.reduce((sum, r) => sum + Math.max(0, r.finish - r.arrival), 0) / completed.length * 10) / 10 : 0, maxTime: completed.length ? Math.max(...completed.map(r => r.finish - r.arrival)) : 0 },
  };
}
export function compareScenario(input, changes) {
  const disrupted = disrupt(input, changes);
  const baseline = simulate(disrupted, 'fixed');
  const recovery = simulate(disrupted, 'adaptive');
  const actions = [];
  if (changes.absentWorker) actions.push(`${input.staff.find(w => w.id === changes.absentWorker).name} is unavailable. Compare fixed assignments with qualified cross-station coverage.`);
  if (changes.shortage) actions.push(`Propose pausing new items requiring ${INGREDIENTS[changes.shortage].toLowerCase()}. Existing affected orders remain unresolved; no substitutions were made.`);
  if (changes.equipmentDown) actions.push(`${input.stations.find(s => s.id === changes.equipmentDown).name} is unavailable. Dependent tasks remain blocked unless compatible capacity exists.`);
  if (changes.rush) actions.push('Six additional sample orders enter at minute 3 in both comparison runs.');
  for (const move of recovery.moves) actions.push(`Cross-trained coverage: ${move}. The time spent is included in both station and worker capacity.`);
  if (!recovery.moves.length) actions.push('Keep feasible tasks ordered by due time, within the available station and staff capacity.');
  if (recovery.metrics.blocked) actions.push(`${recovery.metrics.blocked} order(s) still need manager resolution. The recovery cannot replace unavailable stock or equipment.`);
  return { baseline, recovery, actions, assumptions: 'Simulated 60-minute horizon. Fixed recipe durations, one task per station and worker, all-or-nothing ingredient reservation, earliest due time first. Upstream tasks are not camera-verified.' };
}
