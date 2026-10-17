import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshotRenderClock, createReconciliationCamera } from "../src/browser/smooth-motion.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";
import { NETWORK } from "../src/network/constants.mjs";

test("20Hz snapshots yield continuously varying remote position across 60Hz presentation frames", () => {
  const clock = createSnapshotRenderClock();
  const remote = createRemoteInterpolator();
  const frames = [];
  const simHz = NETWORK.serverSimulationHz;
  const velocity = 215;
  // Browser receives fresh samples at 20Hz. World motion remains at 60Hz.
  for (let ms = 0; ms <= 350; ms += 1000 / 60) {
    const arrival = Math.round(ms / 50);
    if (Math.abs(ms - arrival * 50) < 0.01) {
      remote.push({
        netId: 2, x: ms / 1000 * velocity, y: 100,
        facing: 0, hp: 100, guard: 100, action: 0, flags: 0,
      }, 100 + Math.round(ms * simHz / 1000));
    }
    const tick = 100 + Math.round(Math.floor(ms / 50) * 50 * simHz / 1000);
    const presentationTick = clock.sample(tick, ms);
    const fighter = remote.sample(2, presentationTick);
    frames.push({ ms, tick: presentationTick, x: fighter.x });
  }
  const afterBuffer = frames.filter(f => f.ms >= 150 && f.ms <= 300);
  const movingFrames = afterBuffer.filter((frame, i) => i && frame.x > afterBuffer[i - 1].x + 0.1);
  assert.ok(movingFrames.length >= 5,
    "remote animation must move on intermediate RAFs, not exclusively at snapshot arrivals");
  for (let i = 1; i < afterBuffer.length; i++) {
    assert.ok(afterBuffer[i].x >= afterBuffer[i - 1].x - 0.01, "movement must not reverse");
    assert.ok(afterBuffer[i].x - afterBuffer[i - 1].x < 13,
      "remote fighter must not teleport across multiple frames at each 50ms packet");
  }
});

test("snapshot jitter never reverses render time or extrapolates unbounded through outage", () => {
  const clock = createSnapshotRenderClock();
  const samples = [
    [200, 1000], [203, 1050], [203, 1065], [205, 1120],
    [204, 1135], [205, 1190], [205, 2000], [205, 2100],
  ].map(([tick, now]) => clock.sample(tick, now));
  assert.ok(samples.every(Number.isFinite));
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] >= samples[i - 1], "out-of-order packet cannot rewind presentation clock");
  }
  assert.ok(samples.at(-1) - samples[4] <= NETWORK.reconciliation.maxRemoteExtrapolationMs
    * NETWORK.serverSimulationHz / 1000 + 1);
});

test("visibility resume and uint32 wrap reset the render timeline safely", () => {
  const clock = createSnapshotRenderClock();
  clock.sample(123, 1000);
  clock.sample(129, 1100);
  clock.reset();
  const newTick = clock.sample(10, 2000);
  assert.ok(newTick >= 0 && newTick <= 10);
  clock.reset();
  clock.sample(0xfffffff0, 3000);
  const afterWrap = clock.sample(8, 3050);
  assert.ok(afterWrap < 10 && afterWrap >= 0, "wrap must not create absurd interpolation tick");
  assert.throws(() => clock.sample(-1, 3100));
});

test("reconciliation camera hides small rebase snap without altering predicted world state", () => {
  const camera = createReconciliationCamera();
  const predicted = { x: 300, y: 120, hp: 100 };
  const authoritativeReplayed = { x: 288, y: 122, hp: 66 };
  const correction = camera.absorb(predicted, authoritativeReplayed, 1000);
  assert.equal(correction.snapped, false);
  assert.ok(Math.hypot(predicted.x - authoritativeReplayed.x, predicted.y - authoritativeReplayed.y) > 10);
  const atCorrection = camera.sample(authoritativeReplayed, 1000);
  assert.ok(Math.abs(atCorrection.x - predicted.x) < 0.01);
  assert.ok(Math.abs(atCorrection.y - predicted.y) < 0.01);
  assert.equal(authoritativeReplayed.hp, 66, "camera must never modify server-combat state");
  const halfway = camera.sample(authoritativeReplayed, 1058);
  assert.ok(Math.abs(halfway.x - 294) < 0.1, "58ms halves visible rebase offset");
  const settled = camera.sample(authoritativeReplayed, 1500);
  assert.ok(Math.abs(settled.x - authoritativeReplayed.x) < 1);
});

test("camera correction remains bounded under many ACKs and snaps hard on major teleports", () => {
  const camera = createReconciliationCamera();
  for (let i = 0; i < 90; i++) {
    camera.absorb({ x: 230, y: 300 }, { x: 220, y: 300 }, 1000 + i * 16);
    const render = camera.sample({ x: 220, y: 300 }, 1000 + i * 16);
    assert.ok(render.x - 220 <= 22.001, "max correction is bounded independent of ACK count");
    assert.equal(render.y, 300);
  }
  const snapped = camera.absorb({ x: 320, y: 400 }, { x: 50, y: 400 }, 2500);
  assert.equal(snapped.snapped, true);
  assert.equal(camera.sample({ x: 50, y: 400 }, 2500).x, 50);
  camera.absorb({ x: 51, y: 400 }, { x: 50, y: 400 }, 2520);
  camera.reset();
  assert.deepEqual(camera.sample({ x: 50, y: 400 }, 2540), { x: 50, y: 400 });
});

test("reconciliation render-only improvements preserve native combat, original tick rates and fail-closed browser proofs", async () => {
  const fs = await import("node:fs");
  const online = fs.readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const serverConfig = fs.readFileSync(new URL("../src/network/constants.mjs", import.meta.url), "utf8");
  assert.match(online, /visualCamera\.absorb\(/);
  assert.match(online, /snapshotRenderClock\.sample\(/);
  assert.match(online, /drawFighterScreen\(canvas\.width \/ 2, canvas\.height \/ 2, local/);
  assert.match(online, /restoreAuthoritative,/);
  assert.match(online, /replayInput\(entry\) \{ predictMovement\(entry, 1000 \/ NETWORK\.inputSendHz\); \}/);
  assert.match(serverConfig, /serverSimulationHz: 60/);
  assert.match(serverConfig, /snapshotSendHz: 20/);
  assert.match(serverConfig, /remoteInterpolationMs: 90/);
});
