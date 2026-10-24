import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M121 real original 30Hz KeyW+LMB accepts read-only direction evidence", () => {
  const src = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const start = src.indexOf("function simulatePrediction(stepMs) {");
  const end = src.indexOf("\nfunction ", start + 31);
  assert.ok(start >= 0 && end > start);
  const originalSender = src.slice(start, end);
  const captureStart = originalSender.indexOf(
    'if (acceptanceScenario === "uimultirecoveryspatial" || acceptanceScenario === "uidirectionallight")');
  const captureEnd = originalSender.indexOf("if (m111InputProbe)", captureStart);
  assert.ok(captureStart > 0 && captureEnd > captureStart);
  const readonly = originalSender.slice(captureStart, captureEnd);
  for (const evidence of [
    'const m121DirectionTrace = acceptanceScenario === "uidirectionallight"',
    'm121DirectionTrace && keys.has("KeyW")',
    "keyWHeldAtSample: keys.has(\"KeyW\")",
    "lmbHeldAtSample: Boolean(leftButtonDown)",
    "leftChargingAtSample: leftButtonCharge.isCharging()",
    "pendingLightReleaseAtSample: Boolean(attackRequested)",
    "pendingHeavyReleaseAtSample: Boolean(heavyAttackRequested)",
    "moveX: currentInput.moveX",
    "moveY: currentInput.moveY",
    "facing: currentInput.facing",
    "pressMoveY: leftButtonPressMovement?.moveY ?? null",
    "committedLightMoveY: committedLightMove?.moveY ?? null",
    "observedServerTick: networkClient.latestServerTick",
    "if (debug.inputSubmissions.length > 32)",
  ]) assert.ok(readonly.includes(evidence), `missing read-only M121 provenance: ${evidence}`);
  assert.doesNotMatch(readonly, /currentInput\.[A-Za-z]+\s*=(?!=)/,
    "never mutate the original sampled v1 input to pass M121");
  assert.doesNotMatch(readonly, /(?:networkClient\.sendInput|\.dispatchEvent|setTimeout)\s*\(/,
    "telemetry may not synthesize a source input or packet");
  assert.ok(originalSender.indexOf("networkClient.sendInput({ tick: outgoingTick, ...currentInput });", captureEnd) > captureEnd,
    "original v1 sender must transmit exactly the original unchanged sample");
  assert.match(originalSender, /currentInput\.moveY/,
    "original sampling logic remains in the function");
});
