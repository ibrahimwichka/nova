export const SCREENS = [
  { id: 'floor', label: 'Floor', anchor: 'restaurant-floor', icon: '⌖' },
  { id: 'delivery', label: 'Delivery map', anchor: 'delivery-simulator', icon: '⇢' },
  { id: 'inventory', label: 'Inventory', anchor: 'inventory-hud', icon: '▦' },
  { id: 'replay', label: 'Replay', anchor: 'replay-hud', icon: '↺' },
  { id: 'ops', label: 'Ops', anchor: 'ai-operations', icon: '◉' },
];

export const COURIER_ROUTE = [[130, 160], [222, 160], [282, 188], [405, 188], [463, 160], [630, 160]];
export const COURIER_APPROACH = [[60, 160], [130, 160]];
const FINISHED = ['collected', 'delivered'];
const ACTIVE_KITCHEN = ['queued', 'preparing', 'packing', 'ready'];
const clamp = (value, max = 1) => Math.max(0, Math.min(max, value));

export function stageFromLocation(hash, tab) {
  const screen = SCREENS.find(entry => hash === '#' + entry.anchor);
  if (screen) return screen.id;
  if (['inventory', 'delivery'].includes(tab)) return tab;
  if (['prep', 'staff', 'finance', 'scenarios', 'packing'].includes(tab)) return 'ops';
  return 'floor';
}

export function routePose(points, progress) {
  const segments = points.slice(1).map(([x, y], index) => {
    const [fromX, fromY] = points[index];
    return { fromX, fromY, dx: x - fromX, dy: y - fromY, length: Math.hypot(x - fromX, y - fromY) };
  });
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  const distance = length * clamp(Number.isFinite(progress) ? progress : 0);
  let passed = 0;
  for (const [index, segment] of segments.entries()) {
    if (segment.length === 0) continue;
    if (distance < passed + segment.length || index === segments.length - 1) {
      const portion = clamp((distance - passed) / segment.length);
      return { x: segment.fromX + segment.dx * portion, y: segment.fromY + segment.dy * portion, heading: Math.atan2(segment.dy, segment.dx) * 180 / Math.PI, distance, length };
    }
    passed += segment.length;
  }
  const [x, y] = points.at(-1) || [0, 0];
  return { x, y, heading: 0, distance, length };
}

export function orderReward(order, pricing = {}) {
  if (!FINISHED.includes(order.status)) return null;
  const payout = Object.entries(order.items || {}).reduce((total, [sku, count]) => total + (pricing[sku] || 0) * count, 0);
  const finishedAt = order.delivery?.confirmedAt ?? Date.parse(order.collectedAt);
  const dueAt = order.delivery?.arrivesAt ? order.delivery.arrivesAt + 12_000 : Date.parse(order.createdAt) + (order.due || 18) * 60_000;
  const fast = Number.isFinite(finishedAt) && Number.isFinite(dueAt) && finishedAt <= dueAt;
  const verified = order.verification?.status === 'green';
  return {
    payout, tips: verified ? Math.round(payout * .1) : 0, bonus: fast ? 100 : 0,
    stars: 3 + Number(verified) + Number(fast), xp: fast ? 125 : 100,
  };
}

export function shiftScore(orders, pricing) {
  const active = orders.filter(order => ACTIVE_KITCHEN.includes(order.status)).length;
  const results = orders.filter(order => FINISHED.includes(order.status) || order.status === 'cancelled');
  const rewards = results.map(order => orderReward(order, pricing)).filter(Boolean);
  let combo = 0;
  for (let index = results.length - 1; index >= 0 && FINISHED.includes(results[index].status); index--) combo++;
  const xp = rewards.reduce((total, reward) => total + reward.xp, 0);
  return {
    active, rush: clamp(active / 8), heat: active >= 6 ? 'Overloaded' : active >= 3 ? 'Building' : 'Steady',
    served: rewards.length, earnings: rewards.reduce((total, reward) => total + reward.payout + reward.tips + reward.bonus, 0),
    flags: orders.filter(order => order.status === 'packing' && order.verification?.status === 'red').length,
    combo, xp, rank: xp >= 750 ? 'Shift captain' : xp >= 300 ? 'Line lead' : 'Rookie',
  };
}

export function newestObjective(previous, orders) {
  const statuses = new Map(previous.map(order => [order.id, order.status]));
  const changed = orders.filter(order => statuses.get(order.id) !== order.status);
  const resolved = changed.findLast(order => FINISHED.includes(order.status) || order.status === 'cancelled');
  if (resolved && statuses.has(resolved.id)) return { kind: resolved.status === 'cancelled' ? 'failed' : 'passed', order: resolved };
  const ticket = changed.findLast(order => !statuses.has(order.id) && order.status === 'queued');
  return ticket ? { kind: 'ticket', order: ticket } : null;
}
