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
  const keyDown = flight.indexOf('await setMovementKey(attacker, "e", true);');
  const commit = flight.indexOf("if (committedObserved) {");
  assert.ok(flight.includes("await sleep(45);"));
  assert.ok(!flight.includes("await sleep(120);"));
  const sDown = flight.indexOf('await setMovementKey(defender, "s", true);');
  const dodge = flight.indexOf("await performArenaTimedPointerDodge(defender, defenderElementId, 15);");
  const sUp = flight.indexOf('await setMovementKey(defender, "s", false);');
  const keyUp = flight.indexOf('await setMovementKey(attacker, "e", false);');
  assert.ok(keyDown >= 0 && commit > keyDown && sDown > commit
    && dodge > sDown && sUp > dodge && keyUp > sUp);
  assert.equal(flight.match(/await performArenaTimedPointerDodge\(/g)?.length, 1);
  assert.ok(!flight.includes("await pressArenaPerpendicularDodgeAfterPause("));
  assert.ok(flight.includes("finally {"));
  assert.ok(!flight.includes('await pulseMovementKey(attacker, "e", heavyKeyPulseMs);'));
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
