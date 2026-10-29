import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";
import { dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
const tick = () => new Promise(setImmediate);

test("M40 uses real trusted wheel receipt before Chrome release without relaxing World guards", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.match(source, /const m40ReleaseAnchoredGuardOnly = scenario === "uiguardbreaktell"/);
  assert.match(source, /trustedWheelWaitMs: .*m40ReleaseAnchoredGuardOnly\) \? 190 : 0/);
  assert.match(source, /postTrustedWheelMs: .*m40ReleaseAnchoredGuardOnly\) \? 25 : 0/);
  assert.match(source, /if \(!trustedWheelBeforeRelease\)/);
  assert.match(source, /M193 guard-break exchange/);
  assert.match(source, /defenderState\?\.playerHp !== 100/);
  assert.match(source, /defenderResult\.playerGuard !== 0/);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.guardDamage, 38);
});

test("M40 first-red 139ms Firefox receipt cannot arrive after real Chrome RELEASE", async () => {
  const trusted = deferred(), ack = deferred(), ceiling = deferred();
  let now = 0;
  const edges = [];
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 25,
    now: () => now,
    sleep: ms => {
      if (ms === 190) return ceiling.promise;
      assert.equal(ms, 25);
      now += ms;
      return Promise.resolve();
    },
    sendAttackDown: () => { edges.push("real-down"); now = 4; },
    sendWheel: () => { edges.push("real-wheel-request"); now = 10; return ack.promise; },
    awaitTrustedWheel: () => trusted.promise,
    sendAttackUp: () => { edges.push("real-up"); now += 3; },
  });
  await tick();
  assert.deepEqual(edges, ["real-down", "real-wheel-request"]);
  now = 139;
  assert.equal(edges.includes("real-up"), false, "never release before Firefox trusted DOM event");
  trusted.resolve({ trusted: true, deltaY: 120 });
  await tick();
  assert.deepEqual(edges, ["real-down", "real-wheel-request", "real-up"]);
  let settled = false;
  flight.then(() => { settled = true; });
  await tick();
  assert.equal(settled, false, "real Firefox W3C command ACK is also mandatory");
  now = 175;
  ack.resolve();
  const result = await flight;
  assert.equal(result.trustedWheelObservedMs, 139);
  assert.equal(result.attackUpDispatchMs, 164);
  assert.equal(result.postTrustedWheelMs, 25);
  const projectedWorldBlockAge = result.attackUpDispatchMs - result.trustedWheelObservedMs + COMBAT.attack.windupMs;
  assert.equal(projectedWorldBlockAge, 160, "projection only; original World contact is final proof");
  assert.ok(projectedWorldBlockAge > COMBAT.block.parryWindowMs);
  assert.ok(projectedWorldBlockAge < COMBAT.block.shortBlockMs);
  assert.equal(edges.filter(x => x === "real-up").length, 1);
});

test("M40 missing Firefox trusted event aborts before Chrome release", async () => {
  const ceiling = deferred();
  let released = 0, now = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 25,
    now: () => now,
    sleep: ms => { assert.equal(ms, 190); return ceiling.promise; },
    sendAttackDown: () => { now = 5; },
    sendWheel: () => {},
    awaitTrustedWheel: () => new Promise(() => {}),
    sendAttackUp: () => { released++; },
  });
  await tick();
  now = 190;
  ceiling.resolve();
  await assert.rejects(flight, /trusted native wheel not delivered/);
  assert.equal(released, 0);
});
