import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";
import { COMBAT } from "../src/combat/model.mjs";

const defer = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("M205 real trusted wheel gets one bounded 40ms sample before one native release", async () => {
  const wheelAck = defer(), attested = defer(), delay = defer();
  const order = [];
  let clock = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    postTrustedWheelMs: 40,
    now: () => clock,
    sleep: ms => {
      order.push("wait:" + ms);
      return ms === 40 ? delay.promise : new Promise(() => {});
    },
    sendAttackDown: () => { order.push("down"); clock = 4; },
    sendWheel: () => { order.push("wheel"); return wheelAck.promise; },
    awaitTrustedWheel: () => attested.promise,
    sendAttackUp: () => { order.push("up"); clock = 84; },
  });
  await new Promise(setImmediate);
  assert.deepEqual(order, ["down", "wait:190", "wheel"]);
  clock = 35;
  attested.resolve({ trusted: true, deltaY: 120 });
  await new Promise(setImmediate);
  assert.deepEqual(order, ["down", "wait:190", "wheel", "wait:40"]);
  clock = 75;
  delay.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(order, ["down", "wait:190", "wheel", "wait:40", "up"]);
  let settled = false;
  flight.then(() => { settled = true; });
  await new Promise(setImmediate);
  assert.equal(settled, false, "Firefox genuine W3C ACK is still mandatory");
  wheelAck.resolve();
  const result = await flight;
  assert.equal(result.postTrustedWheelMs, 40);
  assert.equal(result.attackUpDispatchMs, 75);
  assert.equal(result.clickHoldMs, 75);
  assert.ok(result.clickHoldMs < COMBAT.heavyAttack.windupMs);
  assert.equal(order.filter(x => x === "wheel").length, 1);
  assert.equal(order.filter(x => x === "up").length, 1);
});

test("M205 missing trusted Firefox event fails closed before Chrome up", async () => {
  const ceiling = defer();
  let ups = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    postTrustedWheelMs: 40,
    sleep: ms => ms === 190 ? ceiling.promise : Promise.resolve(),
    sendAttackDown: () => {},
    sendWheel: () => {},
    awaitTrustedWheel: () => new Promise(() => {}),
    sendAttackUp: () => { ups++; },
  });
  await new Promise(setImmediate);
  ceiling.resolve();
  await assert.rejects(flight, /trusted native wheel not delivered/);
  assert.equal(ups, 0);
});

test("M205 rejects unbounded holds or timing without trusted wheel certificate", async () => {
  for (const invalid of [-1, 61, 100, Infinity, NaN]) {
    await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
      trustedWheelWaitMs: 190, postTrustedWheelMs: invalid,
      sendAttackDown: () => {}, sendWheel: () => {},
      awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
      sendAttackUp: () => {},
    }), TypeError);
  }
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 0, postTrustedWheelMs: 40,
    sendAttackDown: () => {}, sendWheel: () => {},
    awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
    sendAttackUp: () => {},
  }), TypeError);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.guardDamage, 38);
});

test("M205 preserves original zero-parry, -38 guard, 34HP server proof and strict 3/3", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const scenario = source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.match(scenario, /postTrustedWheelMs:\s*\["uiguardbreak", "uiguardbreakpunishffahit"\]\.includes\(scenario\) \? 40 : 0/);
  for (const required of [
    'if (!trustedWheelBeforeRelease)', 'M193 guard-break exchange',
    'feedbackTransitions.includes("parried")', 'defenderState?.playerHp !== 100',
    'defenderResult.playerGuard !== 0', 'defenderResult.playerHp !== 100',
    'M320_GUARD_BREAK_AUTH_TRACE',
  ]) assert.ok(scenario.includes(required), required);
  const quality = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(quality, /for attempt in 1 2 3; do/);
  assert.match(quality, /MYASO_PVP_SCENARIO: "uiguardbreakpunishffahit"/);
});
