import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMBAT } from "../src/combat/model.mjs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const flight = source.slice(
  source.indexOf("async function runOnlineUiHeavyDodgeFlight("),
  source.indexOf("async function runOnlineUiDirectionalLightFlight("),
);

test("M204 schedules one genuine wheel during the FIRST physical LMB heavy hold", () => {
  const keyDown = flight.indexOf('performM110NativeHeldLmb(attacker, attackerElementId, attackOffset).then(');
  const commit = flight.indexOf("windup = await awaitM223HeavyWindup({");
  assert.ok(flight.includes("serverLogOffset = m201ServerOutput().length"));
  assert.ok(flight.includes("await awaitChargeTick(10)"));
  assert.ok(flight.includes("const dispatchPhase=await awaitChargeTick(20)"));
  assert.ok(!flight.includes("wheelTargetEpochMs - Date.now()"));
  assert.ok(!flight.includes("await sleep(90);"));
  assert.ok(!flight.includes("await sleep(120);"));
  const sDown = flight.indexOf('await setMovementKey(defender, "s", true);');
  const dodge = flight.indexOf("await performArenaTimedPointerDodge(defender, defenderElementId, 0, defenderWheelViewport);");
  const sUp = flight.indexOf('await setMovementKey(defender, "s", false);');
  const keyUp = flight.lastIndexOf('const delivered = await lmbOutcome;');
  assert.ok(keyDown >= 0 && commit > keyDown && sDown > commit
    && dodge > sDown && sUp > dodge && keyUp > sUp);
  assert.equal(flight.match(/await performArenaTimedPointerDodge\(/g)?.length, 1);
  assert.ok(!flight.includes("await pressArenaPerpendicularDodgeAfterPause("));
  assert.ok(flight.includes("finally {"));
  assert.ok(!flight.includes('await pulseMovementKey(attacker, "e", heavyKeyPulseMs);'));
  assert.ok(!flight.includes('setMovementKey(attacker, "e"'));
});

test("M204 preserves clean 100 HP and real perpendicular wheel/keyboard proof", () => {
  assert.ok(flight.includes("defenderResult.playerHp !== 100"));
  assert.ok(flight.includes("attackerResult.playerHp !== 100"));
  assert.ok(flight.includes('defenderResult.keys.includes("keydown:KeyS")'));
  assert.ok(flight.includes('defenderResult.keys.includes("keyup:KeyS")'));
  assert.ok(flight.includes("event.deltaY < 0"));
  assert.ok(flight.includes('"dodge-success"'));
  assert.ok(flight.includes('"dodge-evaded"'));
});

test("M204 has bounded unchanged server-authoritative heavy and dodge timings", () => {
  assert.equal(COMBAT.heavyAttack.windupMs, 320);
  assert.equal(COMBAT.heavyAttack.damage, 46);
  assert.equal(COMBAT.dodge.iframeMs, 125);
  assert.equal(COMBAT.dodge.durationMs, 170);
});

test("M204 reads authentic server windup before scheduling a single native Chrome dodge", () => {
  assert.match(source, /scenario === "uiheavydodge"/);
  assert.match(flight, /awaitM223HeavyWindup\(/);
  assert.match(flight, /fighterId: beforeAttacker\.playerNetId/);
  assert.match(flight, /wheelIssuedAfterObservedMs/);
  assert.ok(!flight.includes("dispatchEvent("));
  assert.ok(!flight.includes("new WheelEvent("));
});
