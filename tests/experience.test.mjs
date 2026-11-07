import test from 'node:test';
import assert from 'node:assert/strict';
import { worldTab, nextObjective } from '../src/experience-logic.mjs';
import { initialState, CATALOG, INGREDIENTS } from '../server/domain.mjs';
import { findPath } from '../src/game-logic.mjs';
const config={catalog:CATALOG,ingredients:INGREDIENTS};
test("Workspace priorities follow reachable cooking routes and surface blocked work", () => {
  const state = initialState(),
    order = { id: "T1", status: "queued", items: { burger: 1, fries: 1 } };
  let objective = nextObjective("kitchen", order, state, config, {
    x: 11,
    y: 6,
  });
  assert.equal(objective.label, "Accept the ticket");
  order.status = "preparing";
  order.gameStations = [];
  objective = nextObjective("kitchen", order, state, config, { x: 11, y: 6 });
  assert.equal(objective.target, "grill");
  assert.ok(findPath("kitchen", { x: 11, y: 6 }, { x: 4, y: 4 }).length);
  order.gameStations = ["grill"];
  assert.equal(
    nextObjective("kitchen", order, state, config, { x: 11, y: 6 }).target,
    "fryer",
  );
  state.stations.find((s) => s.id === "fryer").available = false;
  assert.equal(
    nextObjective("kitchen", order, state, config, { x: 11, y: 6 }).screen,
    "ops",
  );
  assert.equal(
    nextObjective("display", null, state, config, { x: 0, y: 0 }).disabled,
    true,
  );
  assert.equal(
    nextObjective("customer", null, state, config, { x: 3, y: 13 }).label,
    "Choose your meal",
  );
});
test("workspace routes preserve category deep links", () => {
  for (const tab of ["prep", "staff", "finance", "packing"])
    assert.equal(worldTab("?tab=" + tab), "ops");
  assert.equal(worldTab("?tab=scenarios"), "replay");
  assert.equal(worldTab("?tab=unknown"), "floor");
  assert.equal(worldTab("", "#ai-operations"), "inventory");
});

test("first-person movement follows camera heading on the existing walkable grid", async () => {
  const { movementFromCamera } = await import("../src/perspective.mjs");
  assert.deepEqual(movementFromCamera("w", 0), [0, -1]);
  assert.deepEqual(movementFromCamera("s", 0), [0, 1]);
  assert.deepEqual(movementFromCamera("a", 0), [-1, 0]);
  assert.deepEqual(movementFromCamera("d", 0), [1, 0]);
  assert.deepEqual(movementFromCamera("w", Math.PI / 2), [1, 0]);
  assert.deepEqual(movementFromCamera("d", Math.PI / 2), [0, 1]);
  assert.deepEqual(movementFromCamera("w", Math.PI), [0, 1]);
  assert.equal(movementFromCamera("Tab", 0), null);
});
