import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeM232SpatialHandoffFailure } from "../scripts/m232-spatial-handoff-failure.mjs";

const sample = (focusLabel, t, centroidX, count = 52) =>
  ({ focusLabel, t, centroidX, count, canvasWidth: 640 });

test("M232 captures actual Firefox focus-label ring evidence without inventing missing #1", () => {
  const result = summarizeM232SpatialHandoffFailure([
    sample("PUNISH TARGET #3", 380, 420),
    sample("PUNISH TARGET #3", 395, 418, 81),
    sample("NEAREST #3", 790, -1, 0),
  ], { lightId: 3, jumpId: 1 });
  assert.equal(result.source, "actual-firefox-focus-label-mutation-and-canvas-readback");
  assert.equal(result.observedLightLabels, 2);
  assert.equal(result.observedJumpLabels, 0);
  assert.equal(result.maxLightRingPixels, 81);
  assert.equal(result.maxJumpRingPixels, 0);
  assert.equal(result.firstJump, null, "no synthetic recovered jump ring");
  assert.equal(result.firstLight?.centroidX, 420);
  assert.equal(result.available, true);
});

test("M232 retains actual two-target ring order, timestamps and geometry", () => {
  const result = summarizeM232SpatialHandoffFailure([
    sample("PUNISH TARGET #3", 370, 456),
    sample("PUNISH TARGET #1", 550, 196, 68),
    sample("NEAREST #3", 810, -1, 0),
  ], { lightId: 3, jumpId: 1 });
  assert.equal(result.observedLightLabels, 1);
  assert.equal(result.observedJumpLabels, 1);
  assert.equal(result.firstLight?.t, 370);
  assert.equal(result.firstJump?.t, 550);
  assert.equal(result.firstJump?.centroidX, 196);
  assert.equal(result.maxJumpRingPixels, 68);
});

test("M232 summary is bounded even with untrusted sample volume or bad fields", () => {
  const rows = Array.from({ length: 10_000 }, (_, i) =>
    sample(i % 2 ? "PUNISH TARGET #1" : "PUNISH TARGET #3", i, i * 0.5, i));
  const result = summarizeM232SpatialHandoffFailure(rows, { lightId: 3, jumpId: 1 });
  assert.equal(result.sampleCount, 10_000);
  assert.equal(result.inspectedCount, 4096);
  assert.equal(result.lastObservedSamples.length, 24);
  assert.equal(result.truncatedInput, true);
  const malformed = summarizeM232SpatialHandoffFailure([null, false, {
    focusLabel: "PUNISH TARGET #1".repeat(30),
    count: -1, centroidX: Infinity, canvasWidth: NaN, t: Number.NaN,
  }], { lightId: 3, jumpId: 1 });
  assert.equal(malformed.observedJumpLabels, 0);
  assert.equal(malformed.lastObservedSamples[0].focusLabel.length, 64);
  assert.equal(malformed.lastObservedSamples[0].centroidX, null);
  assert.equal(malformed.lastObservedSamples[0].count, null);
  assert.equal(summarizeM232SpatialHandoffFailure(null, { lightId: 3, jumpId: 1 }).available, false);
});

test("M232 adds actual sampler evidence only to failing spatial M145 path", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(entries, spatial = false)");
  const end = runner.indexOf("\nasync function ", start + 10);
  const body = runner.slice(start, end);
  assert.ok(body.includes("if (spatial) await armRecoveryHandoffSampler(observer)"));
  assert.ok(body.includes("if (spatial) spatialSamples = await stopRecoveryHandoffSampler(observer)"));
  assert.ok(body.includes("const lightPunishIndex = focusTransitions.findIndex"));
  assert.ok(body.includes("const jumpPunishIndex = focusTransitions.findIndex"));
  assert.ok(body.includes("const nearestReturnIndex = focusTransitions.findIndex"));
  const failed = body.slice(body.indexOf("if (lightPunishIndex < 0"));
  assert.ok(failed.includes("spatialFailureEvidence = spatial"));
  assert.ok(failed.includes("summarizeM232SpatialHandoffFailure(spatialSamples, { lightId, jumpId })"));
  assert.ok(failed.includes("...(spatial ? { spatialFailureEvidence, m233FailureEvidence } : {})"));
  assert.ok(failed.includes("summarizeM233RecoveryHandoff(observerState.acceptance?.m233RecoveryHandoff"));
  assert.ok(failed.includes("throw new Error("));
  assert.ok(body.includes("M211_SERVER_DUAL_RECOVERY_PHASES"));
  assert.ok(body.includes("spatialSamples.findIndex"));
});
