import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

test("M121 observer follows exactly original v1 30Hz movement sender without adding or changing packets", () => {
  const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function simulatePrediction(stepMs) {");
  const end = source.indexOf("\nfunction predictMovement(", start);
  assert.ok(start >= 0 && end > start);
  const originalSender = source.slice(start, end);
  assert.ok(originalSender.indexOf("m121SentSamples.push") < originalSender.indexOf("networkClient.sendInput("));
  const sent = [];
  const input = { moveX: 1, moveY: 0, attack: false, heavyAttack: false };
  const keySet = new Set(["KeyD"]);
  const debug = { m121SentSamples: [] };
  const ctx = {
    sampleInput() {}, matchOver: false, local: { initialized: false, action: 0 },
    predictionStep: 1, clientTick: 101,
    networkClient: { sendInput(packet) { sent.push({ ...packet }); } },
    markStaminaDenialSubmitted() {},
    currentInput: input,
    acceptanceScenario: "uidirectionallight", reviewedGestureLab: false,
    window: { __MYASO_ACCEPTANCE_STATE__: debug },
    keys: keySet,
    document: { activeElement: { id: "arena" } },
    m111InputProbe: null,
    Date: { now: () => 1792836346093 },
    attackRequested: false, runningAttackRequested: false, committedLightMove: null,
    heavyAttackRequested: false, rollRequested: false, kickRequested: false,
    jumpRequested: false, dashRequested: false, dashMove: null,
  };
  runInNewContext(originalSender, ctx);
  const step = () => ctx.simulatePrediction(1000 / 60);
  step();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].tick, 101);
  assert.equal(sent[0].moveX, 1);
  assert.equal(debug.m121SentSamples.length, 1);
  assert.equal(debug.m121SentSamples[0].keyD, true);
  assert.equal(debug.m121SentSamples[0].moveX, sent[0].moveX);
  assert.equal(debug.m121SentSamples[0].focus, "arena");
  step();
  assert.equal(sent.length, 1, "no extra sends from diagnostic");
  keySet.delete("KeyD");
  input.moveX = 0;
  input.attack = true;
  step();
  assert.equal(sent.length, 2);
  assert.equal(sent[1].tick, 102);
  assert.equal(sent[1].moveX, 0);
  assert.equal(sent[1].attack, true);
  assert.equal(debug.m121SentSamples[1].keyD, false);
  assert.equal(debug.m121SentSamples[1].attack, true);
  ctx.reviewedGestureLab = true;
  const before = debug.m121SentSamples.length;
  step(); step();
  assert.equal(sent.length, 3, "original sender cadence is unchanged in v2 lab");
  assert.equal(debug.m121SentSamples.length, before, "v1 M121 probe must be dormant in v2 review");
});
