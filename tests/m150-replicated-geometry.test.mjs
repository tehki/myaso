import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { qualifyM150ParryGeometry } from "../scripts/m150-replicated-geometry.mjs";

const combat = { reach: 76, radius: 18 };
test("M150 genuinely closer third rival and exclusive reachable attacker qualify", () => {
  const result = qualifyM150ParryGeometry({
    attacker: { x: -88, y: 0 }, defender: { x: 0, y: 0 },
    closer: { x: 0, y: 60 }, ...combat,
  });
  assert.equal(result.qualified, true);
  assert.ok(result.closerDistance < result.attackerDistance);
  assert.ok(result.excludedDistance > combat.reach + combat.radius + 5);
});
test("M150 rejects nearer attacker, unreachable attacker, and vulnerable third rival", () => {
  const defender = { x: 0, y: 0 };
  assert.equal(qualifyM150ParryGeometry({
    defender, attacker: { x: -55, y: 0 }, closer: { x: 0, y: 65 }, ...combat,
  }).qualified, false);
  assert.equal(qualifyM150ParryGeometry({
    defender, attacker: { x: -115, y: 0 }, closer: { x: 0, y: 60 }, ...combat,
  }).qualified, false);
  assert.equal(qualifyM150ParryGeometry({
    defender, attacker: { x: -82, y: 0 }, closer: { x: -15, y: 49 }, ...combat,
  }).qualified, false);
  assert.throws(() => qualifyM150ParryGeometry({
    defender, attacker: { x: NaN, y: 0 }, closer: { x: 0, y: 60 }, ...combat,
  }), TypeError);
});
test("M150 uses real WASD corrections and replicated fighter proximity without relaxing damage or parry", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiParryPunishFfaFocusFlight(");
  const end = source.indexOf("\nasync function ", start + 20);
  const flight = source.slice(start, end);
  assert.ok(flight.includes("if (convert) {"));
  assert.ok(flight.includes("qualifyM150ParryGeometry("));
  assert.ok(flight.includes("await pulseMovementKey(client, key, holdMs)"));
  assert.ok(flight.includes("await sleep(260)"));
  assert.ok(flight.includes("defenderBefore?.focusLabel !== `NEAREST #${closerId}`"));
  assert.ok(flight.includes("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 75)"));
  assert.ok(flight.includes("currentAttacker?.playerHp === 66"));
  assert.ok(flight.includes("currentCloser?.playerHp === 100"));
  assert.ok(!flight.includes("dispatchEvent("));
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.ok(online.includes('acceptanceScenario === "uiparrypunishffahit"'));
  assert.ok(online.includes("acceptance.fighters = [...state.values()].map"));
});
