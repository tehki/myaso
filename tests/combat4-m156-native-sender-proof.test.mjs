import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";

test("M156 native probe observes real 30Hz held, release and neutral sender frames without sending extra packets", () => {
  const original = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const start = original.indexOf("function simulatePrediction(stepMs) {");
  const end = original.indexOf("\nfunction predictMovement(", start);
  assert.ok(start >= 0 && end > start, "extract exact original sender for deterministic execution");

  const packets = [];
  const debug = {};
  const state = { attack: true, heavyAttack: true, jump: false };
  const charge = { held: true };
  const ctx = {
    sampleInput() {},
    matchOver: false,
    local: { initialized: false },
    predictionStep: 1,
    clientTick: 330,
    networkClient: { sendInput(input) { packets.push({ ...input }); } },
    markStaminaDenialSubmitted() {},
    currentInput: state,
    acceptanceScenario: "uirollknockdownffahit",
    reviewedGestureLab: false,
    window: { __MYASO_ACCEPTANCE_STATE__: debug },
    leftButtonDown: true,
    leftButtonCharge: { isCharging: () => charge.held },
    attackRequested: false,
    runningAttackRequested: false,
    committedLightMove: null,
    heavyAttackRequested: false,
    rollRequested: false,
    kickRequested: false,
    jumpRequested: false,
    dashRequested: false,
    dashMove: null,
    m111InputProbe: null,
    Date: { now: () => 1792808253288 },
  };
  runInNewContext(original.slice(start, end), ctx);
  const step = () => ctx.simulatePrediction(1000 / 60);

  step(); // original held LMB sampler, unchanged 30Hz sender boundary
  assert.equal(packets.length, 1);
  assert.equal(packets[0].attack, true);
  assert.equal(packets[0].heavyAttack, true);
  assert.equal(debug.inputSubmissions[0].lmbPressed, true);
  assert.equal(debug.inputSubmissions[0].lmbCharging, true);

  // Actual onLight release is separately queued for the next ordinary sample.
  ctx.leftButtonDown = false;
  charge.held = false;
  state.attack = true;
  state.heavyAttack = false;
  ctx.attackRequested = true;
  step(); // no transport send between normal 30Hz slots
  assert.equal(packets.length, 1);
  step();
  assert.equal(packets.length, 2);
  assert.equal(packets[1].attack, true);
  assert.equal(packets[1].heavyAttack, false);
  assert.equal(debug.inputSubmissions[1].pendingLight, true);
  assert.equal(debug.inputSubmissions[1].lmbPressed, false);

  // Neutral frame after release remains visible only in M156 native QA.
  state.attack = false;
  ctx.attackRequested = false;
  step();
  step();
  assert.equal(packets.length, 3);
  assert.deepEqual(Array.from(packets, x => x.tick), [330, 331, 332]);
  assert.deepEqual(Array.from(packets, x => [x.attack, x.heavyAttack]),
    [[true, true], [true, false], [false, false]]);
  assert.deepEqual(Array.from(debug.inputSubmissions, x => [x.attack, x.heavyAttack]),
    [[true, true], [true, false], [false, false]]);

  // Local v2 review mode may not claim legacy held-state ownership.
  ctx.reviewedGestureLab = true;
  const previous = debug.inputSubmissions.length;
  step();
  step();
  assert.equal(debug.inputSubmissions.length, previous);
  assert.equal(packets.length, 4, "original movement sender cadence is not altered");
});
