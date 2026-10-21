import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMBAT } from "../src/combat/model.mjs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const flight = source.slice(
  source.indexOf("async function runOnlineUiHeavyDodgeFlight("),
  source.indexOf("async function runOnlineUiDirectionalLightFlight("),
);

test("M204 schedules one genuine wheel during the FIRST heavy key hold, before E release", () => {
  const preAim = flight.indexOf("await aimArena(defender, defenderElementId, 0, 180);");
  const dispatch = flight.indexOf("await dispatchM107NativeDodge({");
  assert.ok(preAim >= 0 && dispatch > preAim);
  assert.ok(flight.includes("serverLogOffset = m201ServerOutput().length"));
  assert.ok(flight.includes('sendHeavyDown: () => setMovementKey(attacker, "e", true)'));
  assert.ok(flight.includes('sendPerpendicularDown: () => setMovementKey(defender, "s", true)'));
  assert.ok(flight.includes("awaitWindup: () => awaitM223HeavyWindup({"));
  assert.ok(flight.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, -120)"));
  assert.ok(flight.includes('sendPerpendicularUp: () => setMovementKey(defender, "s", false)'));
  assert.ok(flight.includes('sendHeavyUp: () => setMovementKey(attacker, "e", false)'));
  assert.equal(flight.match(/dispatchM107NativeDodge\(/g)?.length, 1);
  assert.ok(!flight.includes("await performArenaTimedPointerDodge("));
  assert.ok(!flight.includes("await pressArenaPerpendicularDodgeAfterPause("));

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
