import { walkable } from '../src/game-logic.mjs';
import { fail, CATALOG } from './domain.mjs';
export function validatePresence(input, now = Date.now()) {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(input.id || '') || !['customer', 'kitchen', 'owner'].includes(input.role)) fail('Invalid player.');
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 0) fail('Invalid movement sequence.');
  if (!Array.isArray(input.path) || input.path.length < 1 || input.path.length > 350) fail('Invalid movement path.');
  const path = input.path.map(p => ({ x: p.x, y: p.y }));
  for (let i = 0; i < path.length; i++) {
    if (!walkable(input.role, path[i].x, path[i].y)) fail('Player path crosses a wall or furniture.');
    if (i && Math.abs(path[i].x - path[i-1].x) + Math.abs(path[i].y - path[i-1].y) !== 1) fail('Player path must use adjacent tiles.');
  }
  const startedAt = Number.isFinite(input.startedAt) ? Math.max(now - 86400000, Math.min(now, input.startedAt)) : now;
  let packing = null;
  if (input.packing) {
    if (input.role !== 'kitchen' || typeof input.packing.orderId !== 'string' || !input.packing.counts || Object.entries(input.packing.counts).some(([sku,n]) => !CATALOG[sku] || !Number.isInteger(n) || n < 0 || n > 1000)) fail('Invalid live bag.');
    packing = { orderId: input.packing.orderId.slice(0,50), counts: input.packing.counts };
  }
  return { id: input.id, role: input.role, sequence: input.sequence, path, startedAt, updatedAt: now, orderId: typeof input.orderId === 'string' ? input.orderId.slice(0, 50) : '', packing };
}
export function memoryPresenceStore() {
  const players = new Map();
  return {
    async list(now = Date.now()) { return [...players.values()].filter(p => p.updatedAt >= now - 20000).map(p => structuredClone(p)); },
    async put(player) { if (!players.has(player.id) || players.get(player.id).sequence < player.sequence) players.set(player.id, structuredClone(player)); },
    async remove(id) { players.delete(id); },
  };
}
export function d1PresenceStore(db) {
  return {
    async list(now = Date.now()) {
      const result = await db.prepare('SELECT payload FROM game_presence WHERE updated_at >= ? ORDER BY updated_at DESC LIMIT 24').bind(now - 20000).all();
      return result.results.map(r => JSON.parse(r.payload));
    },
    async put(player) {
      await db.prepare('INSERT INTO game_presence (id, sequence, updated_at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET sequence = excluded.sequence, updated_at = excluded.updated_at, payload = excluded.payload WHERE excluded.sequence > game_presence.sequence').bind(player.id, player.sequence, player.updatedAt, JSON.stringify(player)).run();
    },
    async remove(id) { await db.prepare('DELETE FROM game_presence WHERE id = ?').bind(id).run(); },
  };
}
