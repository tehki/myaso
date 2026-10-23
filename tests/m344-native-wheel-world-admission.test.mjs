import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const initial = game.indexOf("function simulatePrediction(stepMs) {");
const end = game.indexOf("\nfunction predictMovement(", initial);
assert.ok(initial >= 0 && end > initial, "the original browser input path must exist");
const actualSender = game.slice(initial, end);

function actualOriginalBrowserSender() {
  const packets = [];
  const ctx = {
    networkClient: { playerNetId: 1, sendInput: (packet) => packets.push({ ...packet }) },
    document: { hidden: false }, matchOver: false,
    local: { initialized: true }, acceptanceScenario: "",
    currentInput: { attack: false, heavyAttack: false, dodge: false, block: false },
    clientTick: 42, predictionStep: 0, attackRequested: false,
    runningAttackRequested: false, committedLightMove: null, heavyAttackRequested: false,
    rollRequested: false, kickRequested: false, jumpRequested: false, dashRequested: false,
    dashMove: null, shortBlockUntil: 0,
    markStaminaDenialSubmitted() {}, predictMovement() {},
  };
  ctx.sampleInput = () => {
    ctx.currentInput.dodge = ctx.rollRequested;
    ctx.currentInput.block = ctx.shortBlockUntil > 0;
    ctx.currentInput.attack = ctx.attackRequested;
    ctx.currentInput.heavyAttack = ctx.heavyAttackRequested;
  };
  vm.runInNewContext(actualSender
    + "\nthis.original = { flushPhysicalWheelInput, simulatePrediction };", ctx);
  return { ctx, packets, ...ctx.original };
}

test("M344 physical W3C roll emits the first available sequenced v1 sample immediately", () => {
  const { ctx, packets, flushPhysicalWheelInput, simulatePrediction } = actualOriginalBrowserSender();
  ctx.rollRequested = true; // actual browser wheel handler's pending edge
  assert.equal(flushPhysicalWheelInput(), true);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].tick, 42);
  assert.equal(packets[0].dodge, true);
  assert.equal(ctx.clientTick, 43);
  assert.equal(ctx.rollRequested, false, "one real wheel must not replay as new roll");
  simulatePrediction(1000 / 60);
  assert.equal(packets.length, 1, "no spurious 60Hz duplicate");
  simulatePrediction(1000 / 60);
  assert.equal(packets.length, 2, "ordinary 30Hz input preserved");
  assert.equal(packets[1].tick, 43);
  assert.equal(packets[1].dodge, false);
});

test("M344 trusted wheel guard gets immediate Block without resetting the held window", () => {
  const { ctx, packets, flushPhysicalWheelInput, simulatePrediction } = actualOriginalBrowserSender();
  ctx.shortBlockUntil = 250; // supplied by true wheel event handler, not client claim to World
  assert.equal(flushPhysicalWheelInput(), true);
  assert.deepEqual(packets.map((p) => [p.tick, p.block]), [[42, true]]);
  assert.equal(ctx.shortBlockUntil, 250);
  simulatePrediction(1000 / 60);
  simulatePrediction(1000 / 60);
  assert.deepEqual(packets.map((p) => [p.tick, p.block]), [[42, true], [43, true]]);
  // World still owns the 125ms first-block parry window.
});

test("M344 urgent wheel and simultaneous LMB share one sender, without duplicate light", () => {
  const { ctx, packets, flushPhysicalWheelInput, simulatePrediction } = actualOriginalBrowserSender();
  ctx.rollRequested = true;
  ctx.attackRequested = true;
  assert.equal(flushPhysicalWheelInput(), true);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].dodge, true);
  assert.equal(packets[0].attack, true);
  assert.equal(ctx.attackRequested, false);
  simulatePrediction(1000 / 60);
  simulatePrediction(1000 / 60);
  assert.equal(packets[1].attack, false);
  assert.equal(packets[1].dodge, false);
});

test("M344 no early network seat, hidden tab, uninitialized or ended match can send", () => {
  const { ctx, packets, flushPhysicalWheelInput } = actualOriginalBrowserSender();
  ctx.rollRequested = true;
  ctx.networkClient.playerNetId = 0;
  assert.equal(flushPhysicalWheelInput(), false);
  ctx.networkClient.playerNetId = 1;
  ctx.document.hidden = true;
  assert.equal(flushPhysicalWheelInput(), false);
  ctx.document.hidden = false;
  ctx.local.initialized = false;
  assert.equal(flushPhysicalWheelInput(), false);
  ctx.local.initialized = true;
  ctx.matchOver = true;
  assert.equal(flushPhysicalWheelInput(), false);
  assert.equal(packets.length, 0);
  assert.equal(ctx.clientTick, 42);
  assert.equal(ctx.rollRequested, true);
});

test("M344 physical wheel event is the only urgent trigger and uses original one sender", () => {
  const start = game.indexOf('canvas.addEventListener("wheel", (event) => {');
  const endWheel = game.indexOf('}, { passive: false });', start);
  assert.ok(start >= 0 && endWheel > start);
  const wheel = game.slice(start, endWheel);
  assert.match(wheel, /if \(event\.deltaY < 0\)/);
  assert.match(wheel, /rollRequested = true/);
  assert.match(wheel, /if \(event\.deltaY !== 0\) flushPhysicalWheelInput\(\)/);
  assert.doesNotMatch(wheel, /dispatchEvent\(|new WheelEvent\(|Date\.now\(\) -|setTimeout\(/);
  assert.equal(game.match(/networkClient\.sendInput\(/g)?.length, 1);
  assert.match(actualSender, /predictionStep % 2 === 0 && networkClient\) submitAuthoritativeInputSample\(\)/);
  assert.match(actualSender, /const outgoingTick = clientTick/);
  assert.match(actualSender, /clientTick = \(clientTick \+ 1\) >>> 0/);
});

test("M344 original native M107, M193, M194 and M156 inputs/strict assertions unchanged", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.match(runner, /M107 heavy dodge changed authoritative vitals/);
  assert.match(runner, /M156 actionable third-party roll knockdown punish/);
  assert.match(runner, /did not land exactly one 34 HP third-party light/);
  assert.match(runner, /runOnlineUiGuardBreakPunishFfaFocusFlight/);
  assert.match(runner, /runOnlineUiHeavyDodgeFlight/);
});
