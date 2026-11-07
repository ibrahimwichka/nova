export const COLS = 24, ROWS = 15, TILE = 40;
export const SPOTS = {
  counter: { x: 6, y: 9, name: 'Order counter', icon: 'menu' },
  pickup: { x: 18, y: 9, name: 'Pickup counter', icon: 'bag' },
  lounge: { x: 11, y: 12, name: 'Waiting area', icon: 'seat' },
  exit: { x: 3, y: 13, name: 'Exit', icon: 'door' },
  grill: { x: 4, y: 4, name: 'Grill', icon: 'burger' },
  fryer: { x: 10, y: 4, name: 'Fryer', icon: 'fries' },
  prep: { x: 16, y: 4, name: 'Cold prep', icon: 'wrap' },
  packing: { x: 20, y: 6, name: 'Packing bench', icon: 'bag' },
  tickets: { x: 11, y: 6, name: 'Order tickets', icon: 'ticket' },
  office: { x: 13, y: 8, name: 'Owner desk', icon: 'ticket' },
};
export const CUSTOMER_SPOTS = ['counter', 'lounge', 'pickup', 'exit'];
export const KITCHEN_SPOTS = ['tickets', 'grill', 'fryer', 'prep', 'packing'];
export function walkable(role, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 1 || x > 22) return false;
  if (role === 'owner') return walkable('customer', x, y) || walkable('kitchen', x, y) || y === 7 && x >= 12 && x <= 14;
  if (role === 'customer') return y >= 8 && y <= 13 && !((x >= 9 && x <= 10 || x >= 14 && x <= 15) && y >= 10 && y <= 11);
  if (role === 'kitchen') return y >= 1 && y <= 6 && !(y <= 3 && [3, 4, 5, 9, 10, 11, 15, 16, 17].includes(x)) && !(x >= 21 && y >= 5);
  return false;
}
export function findPath(role, start, target) {
  if (!walkable(role, target.x, target.y)) return [];
  const key = p => `${p.x},${p.y}`;
  const queue = [start], seen = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (key(p) === key(target)) {
      const path = []; let cursor = p;
      while (seen.get(key(cursor))) { path.unshift(cursor); cursor = seen.get(key(cursor)); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const next = { x: p.x + dx, y: p.y + dy };
      if (walkable(role, next.x, next.y) && !seen.has(key(next))) { seen.set(key(next), p); queue.push(next); }
    }
  }
  return [];
}
export const nearSpot = (position, id) => Math.abs(position.x - SPOTS[id].x) + Math.abs(position.y - SPOTS[id].y) <= 1;
export function movementForKey(key) {
  return { arrowup: [0,-1], w: [0,-1], arrowdown: [0,1], s: [0,1], arrowleft: [-1,0], a: [-1,0], arrowright: [1,0], d: [1,0] }[key.toLowerCase()] || null;
}
export function suggestedCustomerSpot(order) {
  if (!order || ['cancelled','delivered'].includes(order.status)) return 'counter';
  if (order.status === 'collected') return 'exit';
  if (order.status === 'ready' && !order.delivery) return 'pickup';
  return 'lounge';
}
export const requiredStations = (order, catalog) => [...new Set(Object.keys(order?.items || {}).map(sku => catalog[sku]?.station).filter(Boolean))];
export function orderProblems(order, state, config) {
  if (!order || !['queued', 'preparing'].includes(order.status)) return [];
  const result = [], needs = {};
  for (const [sku, count] of Object.entries(order.items)) {
    const item = config.catalog[sku];
    for (const [id, qty] of Object.entries(item.ingredients)) needs[id] = (needs[id] || 0) + count * qty;
    if (item.station && !state.stations.find(s => s.id === item.station)?.available) result.push(`${item.name}: station unavailable`);
    if (item.station && !state.staff.some(w => w.available && w.skills.includes(item.station))) result.push(`${item.name}: no qualified worker`);
  }
  if (order.status === 'queued') for (const [id, qty] of Object.entries(needs)) if (state.inventory[id] < qty) result.push(`${config.ingredients[id]}: insufficient stock`);
  return [...new Set(result)];
}
