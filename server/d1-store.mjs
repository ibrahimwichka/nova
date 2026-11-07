import { initialState, fail } from './domain.mjs';
export function createD1Store(db) {
  return {
    async load() {
      const seed = initialState();
      await db.prepare('INSERT OR IGNORE INTO demo_state (id, revision, payload) VALUES (?, ?, ?)').bind('main', 1, JSON.stringify(seed)).run();
      const row = await db.prepare('SELECT payload FROM demo_state WHERE id = ?').bind('main').first();
      if (!row) fail('The shared restaurant could not be opened. Please retry.', 503);
      return JSON.parse(row.payload);
    },
    async save(next, expectedRevision) {
      const result = await db.prepare('UPDATE demo_state SET revision = ?, payload = ? WHERE id = ? AND revision = ?').bind(next.revision, JSON.stringify(next), 'main', expectedRevision).run();
      if (result.meta.changes !== 1) fail('Another device updated the restaurant. Please retry your action.', 409);
    },
  };
}
