import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMBAT } from "../src/combat/model.mjs";
import { dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(setImmediate);

test("M194 holds genuine Chrome LMB until late trusted Firefox wheel, then releases exactly once", async () => {
  const trusted = deferred(), ack = deferred(), ceiling = deferred();
  let now = 0;
  const calls = [];
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    now: () => now,
    sleep: ms => { calls.push("ceiling:" + ms); return ceiling.promise; },
    sendAttackDown: () => { calls.push("native-down"); now = 7; },
    sendWheel: () => { calls.push("native-wheel"); return ack.promise; },
    awaitTrustedWheel: () => trusted.promise,
    sendAttackUp: () => { calls.push("native-up"); },
  });
  await tick();
  assert.deepEqual(calls, ["native-down", "ceiling:190", "native-wheel"]);
  now = 143;
  trusted.resolve({ trusted: true, deltaY: 120 });
  await tick();
  assert.deepEqual(calls, ["native-down", "ceiling:190", "native-wheel", "native-up"]);
  let complete = false;
  flight.then(() => { complete = true; });
  await tick();
  assert.equal(complete, false, "real Firefox wheel W3C ACK remains mandatory");
  now = 160; ack.resolve();
  const evidence = await flight;
  assert.equal(evidence.attackUpDispatchMs, 143);
  assert.equal(evidence.trustedWheelObservedMs, 143);
  assert.equal(evidence.clickHoldMs, 143);
  assert.equal(evidence.wheelAckMs, 160);
  assert.ok(evidence.clickHoldMs < COMBAT.heavyAttack.windupMs);
  assert.equal(calls.filter(x => x === "native-up").length, 1);
});

test("M194 missing trusted wheel fails closed before Chrome LMB release", async () => {
  const trusted = deferred(), ceiling = deferred();
  let ups = 0, now = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    now: () => now,
    sleep: ms => { assert.equal(ms, 190); return ceiling.promise; },
    sendAttackDown: () => {},
    sendWheel: () => {},
    awaitTrustedWheel: () => trusted.promise,
    sendAttackUp: () => { ups++; },
  });
  await tick();
  now = 190;
  ceiling.resolve();
  await assert.rejects(flight, /M194 trusted native wheel not delivered/);
  assert.equal(ups, 0);
});

test("M194 invalid or untrusted wheel and failed genuine W3C action never pass", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    sleep: () => new Promise(() => {}),
    sendAttackDown: () => {}, sendWheel: () => {},
    awaitTrustedWheel: () => ({ trusted: false, deltaY: 120 }),
    sendAttackUp: () => { ups++; },
  }), /trusted real Firefox/);
  assert.equal(ups, 0);
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    sleep: () => new Promise(() => {}),
    sendAttackDown: () => {}, sendWheel: () => { throw Error("geckodriver wheel failure"); },
    awaitTrustedWheel: () => new Promise(() => {}),
    sendAttackUp: () => { ups++; },
  }), /geckodriver wheel failure/);
  assert.equal(ups, 0);
});

test("M194 mode is confined to its genuine guard-break scenario and preserves strict proof gates", async () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const section = runner.slice(runner.indexOf("async function runOnlineUiGuardBreakFlight("),
    runner.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.match(section, /trustedWheelWaitMs: scenario === "uiguardbreak" \? 190 : 0/);
  assert.match(section, /awaitTrustedWheel: \(\) => challenge\.wait\(\)/);
  assert.match(section, /if \(!trustedWheelBeforeRelease\)/);
  assert.match(section, /M193 guard-break exchange/);
  assert.match(section, /defenderState\?\.playerHp !== 100/);
  assert.match(section, /defenderResult\.playerGuard !== 0/);
  assert.match(section, /M320_GUARD_BREAK_AUTH_TRACE/);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.guardDamage, 38);
  assert.equal(COMBAT.heavyAttack.windupMs, 320);
  let downCount = 0;
  for (const invalid of [-1, 280, 320, Infinity, NaN]) {
    await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
      trustedWheelWaitMs: invalid,
      sendAttackDown: () => { downCount++; }, sendWheel: () => {},
      awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
      sendAttackUp: () => {},
    }), TypeError);
  }
  assert.equal(downCount, 0);
});

test("M194 wheel-first native chronology requires trusted Firefox wheel BEFORE one real Chrome click", async () => {
  const trusted = deferred(), ack = deferred(), timeoutCeiling = deferred();
  const calls = [];
  let now = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs: 35, trustedWheelWaitMs: 190,
    now: () => now,
    sleep: ms => {
      calls.push("wait:" + ms);
      if (ms === 190) return timeoutCeiling.promise;
      now += ms;
      return Promise.resolve();
    },
    sendWheel: () => { calls.push("real-fox-wheel"); return ack.promise; },
    awaitTrustedWheel: () => trusted.promise,
    sendAttackDown: () => { calls.push("real-chrome-down"); now += 7; },
    sendAttackUp: () => { calls.push("real-chrome-up"); now += 9; },
  });
  await tick();
  assert.equal(calls.includes("real-chrome-down"), false);
  now = 15;
  trusted.resolve({ trusted: true, deltaY: 120 });
  await tick();
  assert.deepEqual(calls.filter(x => x.startsWith("real-")), [
    "real-fox-wheel", "real-chrome-down", "real-chrome-up",
  ]);
  const pending = Promise.race([flight.then(() => "complete"), tick().then(() => "still-awaiting-original-wheel-ACK")]);
  assert.equal(await pending, "still-awaiting-original-wheel-ACK");
  now = 75;
  ack.resolve();
  const receipt = await flight;
  assert.equal(receipt.wheelHeadStartMs, 35);
  assert.equal(receipt.postTrustedWheelMs, 35);
  assert.equal(receipt.attackDownDispatchMs, 50);
  assert.equal(receipt.attackUpDispatchMs, 57);
  assert.equal(receipt.clickHoldMs, 7);
  assert.ok(receipt.clickHoldMs < COMBAT.heavyAttack.windupMs);
  assert.equal(calls.filter(x => x === "real-chrome-up").length, 1);
});

test("M194 wheel-first misses native trusted wheel and aborts BEFORE Chrome LMB down", async () => {
  let downs = 0, ups = 0;
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs: 35, trustedWheelWaitMs: 190,
    sendWheel: () => {},
    awaitTrustedWheel: () => new Promise(() => {}),
    sendAttackDown: () => { downs++; },
    sendAttackUp: () => { ups++; },
    sleep: ms => ms === 190 ? Promise.resolve() : Promise.reject(Error("unexpected extra wait")),
  }), /wheel not delivered before wheel-first attack/);
  assert.equal(downs, 0);
  assert.equal(ups, 0);
  for (const invalid of [NaN, -1, 81, Infinity]) {
    await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
      preWheelHeadStartMs: invalid, trustedWheelWaitMs: 190,
      sendWheel: () => {}, awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
      sendAttackDown: () => { downs++; }, sendAttackUp: () => { ups++; },
    }), TypeError);
  }
  assert.equal(downs, 0);
});

test("M194 original W3C guard-only scenario alone opts into real wheel-first order", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.match(runner, /preWheelHeadStartMs: scenario === "uiguardbreak" \? 35 : 0/);
  assert.match(runner, /trustedWheelWaitMs: scenario === "uiguardbreak" \? 190 : 0/);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.guardDamage, 38);
});
