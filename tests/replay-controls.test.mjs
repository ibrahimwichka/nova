import test from 'node:test';
import assert from 'node:assert/strict';
import { playbackMinute, controlPlayback } from '../shared/replay.mjs';
import { deliveryRoute, routePose, APPROACH_ROUTE } from '../shared/courier-route.mjs';
import { initialState } from '../server/domain.mjs';
import { createApi } from '../server/api.mjs';
test("shared replay controls preserve position through pause, speed, seek and resume", () => {
  let playback = {
    scenarioId: "drill",
    policy: "adaptive",
    startedAt: 1000,
    speed: 2,
  };
  assert.equal(playbackMinute(playback, 4000), 6);
  playback = controlPlayback(playback, { action: "pause" }, 4000);
  assert.equal(playbackMinute(playback, 9000), 6);
  playback = controlPlayback(playback, { action: "speed", speed: 0.5 }, 9000);
  playback = controlPlayback(playback, { action: "resume" }, 10000);
  assert.equal(playbackMinute(playback, 12000), 7);
  playback = controlPlayback(playback, { action: "seek", minute: 40 }, 12000);
  assert.equal(playbackMinute(playback, 14000), 41);
  assert.equal(playbackMinute(playback, 999999), 60);
  for (const input of [
    { action: "seek", minute: NaN },
    { action: "seek", minute: -1 },
    { action: "seek", minute: 61 },
    { action: "speed", speed: 100 },
    { action: "unknown" },
  ])
    assert.throws(() => controlPlayback(playback, input));
  assert.throws(() => controlPlayback(null, { action: "pause" }));
});
test("replay API controls synchronize spectators without changing live kitchen evidence", async () => {
  let state = initialState();
  const api = createApi({
    store: {
      load: async () => structuredClone(state),
      save: async (next) => {
        state = next;
      },
    },
  });
  const call = async (input) => {
    const response = await api(
      new Request("https://nova.test/api/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await call({ action: "pause" })).status, 400);
  const s = await api(
    new Request("https://nova.test/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Replay test", changes: { rush: true } }),
    }),
  );
  const scenario = await s.json();
  const before = structuredClone({
    orders: state.orders,
    inventory: state.inventory,
    version: state.version,
  });
  await call({ scenarioId: scenario.scenarioId, policy: "adaptive" });
  await call({ action: "pause" });
  await call({ action: "seek", minute: 31.5 });
  await call({ action: "speed", speed: 4 });
  assert.equal(state.playback.position, 31.5);
  assert.equal(state.playback.paused, true);
  assert.equal(state.playback.speed, 4);
  assert.deepEqual(
    {
      orders: state.orders,
      inventory: state.inventory,
      version: state.version,
    },
    before,
  );
  const revision = state.revision;
  assert.equal((await call({ action: "speed", speed: 0 })).status, 400);
  assert.equal(state.revision, revision);
  await call({ action: "resume" });
  assert.equal(state.playback.paused, false);
});
test("courier poses travel forward and use atan2 heading for every district turn", () => {
  for (const points of [
    APPROACH_ROUTE,
    ...["maple", "park", "river"].map(deliveryRoute),
  ]) {
    const lengths = points
      .slice(1)
      .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    const total = lengths.reduce((a, b) => a + b, 0);
    let before = 0;
    lengths.forEach((length, i) => {
      const a = points[i],
        b = points[i + 1],
        pose = routePose(points, (before + length / 2) / total);
      assert.ok(Math.abs(pose.x - (a.x + b.x) / 2) < 1e-6);
      assert.ok(Math.abs(pose.y - (a.y + b.y) / 2) < 1e-6);
      assert.equal(
        pose.heading,
        (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      );
      before += length;
    });
    const end = routePose(points, 1);
    assert.ok(Math.abs(end.x - points.at(-1).x) < 1e-6);
    assert.ok(Math.abs(end.y - points.at(-1).y) < 1e-6);
    assert.equal(routePose(points, -1).x, points[0].x);
  }
  assert.notDeepEqual(
    deliveryRoute("park").at(-1),
    deliveryRoute("maple").at(-1),
  );
});
