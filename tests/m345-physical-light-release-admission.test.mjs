import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const start = game.indexOf("function simulatePrediction(stepMs) {");
const end = game.indexOf("\nfunction predictMovement(", start);
const production = game.slice(start, end);
const chargeBegin = game.indexOf("const leftButtonCharge = createLeftButtonCharge({");
const chargeEnd = game.indexOf("\nconst rightButtonGesture", chargeBegin);
const physicalOnLight = game.slice(chargeBegin, chargeEnd);

function originalSender() {
  const packets = [];
  const ctx = {
    networkClient: { playerNetId: 1, sendInput: (packet) => packets.push({ ...packet }) },
    document: { hidden: false }, matchOver: false, local: { initialized: true },
    acceptanceScenario: "", window: {}, currentInput: {
      attack: false, heavyAttack: false, dodge: false, block: false, moveX: 0, moveY: 0,
    },
    clientTick: 50, predictionStep: 0, attackRequested: true,
    committedLightMove: { moveX: 0, moveY: 1 }, // genuine strafe at physical release
    heavyAttackRequested: false, runningAttackRequested: false, rollRequested: false,
    kickRequested: false, jumpRequested: false, dashRequested: false, dashMove: null,
    shortBlockUntil: 0, markStaminaDenialSubmitted() {}, predictMovement() {},
  };
  ctx.sampleInput = () => {
    ctx.currentInput.attack = ctx.attackRequested;
    ctx.currentInput.heavyAttack = ctx.heavyAttackRequested;
    ctx.currentInput.moveX = ctx.attackRequested ? (ctx.committedLightMove?.moveX ?? 0) : 0;
    ctx.currentInput.moveY = ctx.attackRequested ? (ctx.committedLightMove?.moveY ?? 0) : 0;
  };
  vm.runInNewContext(production
    + "\nthis.acceptance = { flushPhysicalCommittedLightInput, simulatePrediction };", ctx);
  return { ctx, packets, ...ctx.acceptance };
}

test("M345 actual physical onLight commits captured lateral and triggers one urgent submission", () => {
  assert.match(physicalOnLight, /attackRequested = true/);
  assert.match(physicalOnLight, /committedLightMove = resolveLightAttackReleaseMovement\(/);
  assert.match(physicalOnLight, /flushPhysicalCommittedLightInput\(\)/);
  assert.ok(physicalOnLight.indexOf("flushPhysicalCommittedLightInput()")
    > physicalOnLight.indexOf("committedLightMove ="));
});

test("M345 6ms physical release reaches existing original sender before 30Hz, exactly once", () => {
  const { ctx, packets, flushPhysicalCommittedLightInput, simulatePrediction } = originalSender();
  assert.equal(flushPhysicalCommittedLightInput(), true);
  assert.deepEqual(packets.map((p) => [p.tick, p.attack, p.heavyAttack, p.moveY]),
    [[50, true, false, 1]]);
  assert.equal(ctx.attackRequested, false);
  assert.equal(ctx.committedLightMove, null);
  simulatePrediction(1000 / 60);
  simulatePrediction(1000 / 60);
  assert.deepEqual(packets.map((p) => [p.tick, p.attack, p.heavyAttack, p.moveY]),
    [[50, true, false, 1], [51, false, false, 0]]);
});

test("M345 no seat, hidden tab, stale UI and match-over never manufacture light", () => {
  const { ctx, packets, flushPhysicalCommittedLightInput } = originalSender();
  ctx.networkClient.playerNetId = 0;
  assert.equal(flushPhysicalCommittedLightInput(), false);
  ctx.networkClient.playerNetId = 1;
  ctx.document.hidden = true;
  assert.equal(flushPhysicalCommittedLightInput(), false);
  ctx.document.hidden = false;
  ctx.local.initialized = false;
  assert.equal(flushPhysicalCommittedLightInput(), false);
  ctx.local.initialized = true;
  ctx.matchOver = true;
  assert.equal(flushPhysicalCommittedLightInput(), false);
  assert.equal(packets.length, 0);
  assert.equal(ctx.clientTick, 50);
});

test("M345 keeps one canonical v1 sender and original W3C/M-series native gates", () => {
  assert.equal(game.match(/networkClient\.sendInput\(/g)?.length, 1);
  assert.match(production, /clientTick = \(clientTick \+ 1\) >>> 0/);
  assert.match(production, /predictionStep % 2 === 0 && networkClient/);
  assert.match(production, /function flushPhysicalWheelInput\(/);
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.match(runner, /M121 left-sweep readability was incomplete/);
  assert.match(runner, /M156 actionable third-party roll knockdown punish/);
  assert.match(runner, /M107 heavy dodge changed authoritative vitals/);
  assert.match(runner, /M194/);
});
