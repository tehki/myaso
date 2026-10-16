import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  M233_MAX_SAMPLES,
  recordM233RecoveryHandoff,
  summarizeM233RecoveryHandoff,
} from "../src/browser/m233-recovery-handoff-trace.mjs";

const state = (jumpAction, lightAction) => new Map([
  [2, { netId: 2, x: 0, y: 0, action: 0 }],
  [1, { netId: 1, x: -5, y: 0, action: jumpAction }],
  [3, { netId: 3, x: 3, y: 0, action: lightAction }],
]);
const capture = (trace, source, combatState, focusNetId, focusMode, serverTick) =>
  recordM233RecoveryHandoff(trace, {
    source, state: combatState, ownId: 2, focusNetId, focusMode, serverTick,
    epochMs: serverTick * 17, isRecovery: (entity) => entity.action === 7 || entity.action === 9,
  });

test("M233 distinguishes true replicated recovery, HUD eligibility and HUD selection", () => {
  const trace = [];
  capture(trace, "ingress", state(0, 7), 3, "replicated", 360);
  capture(trace, "hud", state(0, 7), 3, "recovery", 361);
  capture(trace, "ingress", state(9, 0), 1, "replicated", 377);
  capture(trace, "hud", state(9, 0), 1, "recovery", 378);
  const summary = summarizeM233RecoveryHandoff(trace, { jumpId: 1, lightId: 3 });
  assert.equal(summary.source, "actual-browser-replicated-state-and-hud-frame");
  assert.equal(summary.observedLightIngressRecovery, true);
  assert.equal(summary.selectedLightInHud, true);
  assert.equal(summary.observedJumpIngressRecovery, true);
  assert.equal(summary.observedJumpHudRecovery, true);
  assert.equal(summary.selectedJumpInHud, true);
  assert.equal(summary.firstJumpIngressRecovery?.serverTick, 377);
  assert.equal(summary.firstJumpHudSelection?.focusNetId, 1);
  assert.equal(summary.firstJumpHudSelection?.fighters.find(f => f.netId === 1).distanceSquared, 25);
});

test("M233 never infers a rendered jump focus from a server ingress observation", () => {
  const trace = [];
  capture(trace, "ingress", state(9, 7), 3, "replicated", 370);
  capture(trace, "hud", state(0, 7), 3, "recovery", 372);
  const summary = summarizeM233RecoveryHandoff(trace, { jumpId: 1, lightId: 3 });
  assert.equal(summary.observedJumpIngressRecovery, true);
  assert.equal(summary.observedJumpHudRecovery, false);
  assert.equal(summary.selectedJumpInHud, false);
  assert.equal(summary.firstJumpHudSelection, null);
  assert.equal(summary.selectedLightInHud, true);
  assert.equal(summarizeM233RecoveryHandoff(null, { jumpId: 1 }).available, false);
});

test("M233 deduplicates constant state, bounds captured observations and rejects invalid input", () => {
  const trace = [];
  const one = state(9, 7);
  capture(trace, "hud", one, 3, "recovery", 360);
  capture(trace, "hud", one, 3, "recovery", 361);
  assert.equal(trace.length, 1);
  for (let tick = 362; tick < 662; tick += 1) {
    capture(trace, "hud", state(tick % 2 ? 0 : 9, 7), tick % 2 ? 3 : 1, "recovery", tick);
  }
  assert.equal(trace.length, M233_MAX_SAMPLES);
  assert.equal(trace.at(-1).serverTick, 661);
  const length = trace.length;
  recordM233RecoveryHandoff(trace, { source: "injected", state: one, ownId: 2, isRecovery: () => true });
  assert.equal(trace.length, length);
  const summary = summarizeM233RecoveryHandoff(trace, { jumpId: 1, lightId: 3 });
  assert.equal(summary.lastSamples.length, 20);
});

test("M233 is wired only to acceptance-only replica/HUD tracing and genuine M145 failure evidence", () => {
  const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const record = game.slice(game.indexOf("function recordAcceptanceState("), game.indexOf("function recordAcceptanceAction("));
  const hud = game.slice(game.indexOf("function updateHud("), game.indexOf("function updateOwnReadiness("));
  const start = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(entries, spatial = false)");
  const end = runner.indexOf("\nasync function ", start + 10);
  const flight = runner.slice(start, end);
  assert.ok(record.includes('acceptanceScenario === "uimultirecoveryspatial"'));
  assert.ok(record.includes('source: "ingress"'));
  assert.ok(hud.includes('acceptanceScenario === "uimultirecoveryspatial"'));
  assert.ok(hud.includes('source: "hud"'));
  assert.ok(runner.includes("m233RecoveryHandoff: (window.__MYASO_ACCEPTANCE_STATE__.m233RecoveryHandoff ?? [])"));
  assert.ok(flight.includes("summarizeM233RecoveryHandoff(observerState.acceptance?.m233RecoveryHandoff"));
  assert.ok(flight.includes("if (lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex)"));
  assert.ok(flight.includes("...(spatial ? { spatialFailureEvidence, m233FailureEvidence } : {})"));
});
