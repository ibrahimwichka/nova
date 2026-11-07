import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createD1Store } from '../server/d1-store.mjs';

test('hosted storage seeds once, persists across clients, and rejects stale writes', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0000_nova_state.sql', import.meta.url), 'utf8'));
  const db = { prepare(query) { return { bind(...args) { return { async run() { const r = sql.prepare(query).run(...args); return { meta: { changes: Number(r.changes) } }; }, async first() { return sql.prepare(query).get(...args); } }; } }; } };
  const a = createD1Store(db), b = createD1Store(db);
  const first = await a.load(); assert.equal(first.orders.length, 10);
  const next = structuredClone(first); next.revision++; next.inventory.chicken = 2;
  await a.save(next, first.revision);
  assert.equal((await b.load()).inventory.chicken, 2);
  await assert.rejects(b.save(first, first.revision), /Another device/);
  sql.close();
});
