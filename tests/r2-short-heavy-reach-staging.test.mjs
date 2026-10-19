import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT } from "../src/combat/model.mjs";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");

test("restored short heavy reaches during the guarded active window through real approach, not old 130 hitbox", () => {
  assert.equal(COMBAT.attack.reach, 76);
  assert.equal(COMBAT.heavyAttack.reach, 82);
  assert.equal(COMBAT.heavyAttack.activeMs, 100);
  assert.equal(COMBAT.heavyAttack.lungeSpeed, 240);
  const normalApproach = 180 * COMBAT.moveSpeed / 1000;
  const blockApproach = 290 * COMBAT.moveSpeed / 1000;
  assert.ok(blockApproach - normalApproach >= 23 && blockApproach - normalApproach <= 25);
  const span = runner.slice(runner.indexOf("async function runOnlineUiHeavyBlockFlight("),
    runner.indexOf("async function runOnlineUiHeavyParryFlight("));
  assert.match(span, /prepareHeavyCounterplayFlight\(\s*entries, "M107 heavy block", \{ movementMs: 290 \}/);
  assert.match(span, /targetAfterWindupMs|155/);
  assert.match(span, /defenderResult\.playerHp === 100/);
  assert.match(span, /"parried"/);
  assert.match(span, /"parry-success"/);
  assert.doesNotMatch(span, /dispatchEvent\(|simulateAttack|skipDefense/);
});

test("M188 retains actual M223 authenticated windup and unchanged defense periods", () => {
  const heavy = runner.slice(runner.indexOf("async function performHeavyCounterplayWindowWheel("),
    runner.indexOf("async function runOnlineUiHeavyBlockFlight("));
  assert.match(heavy, /awaitM223HeavyWindup\(/);
  assert.match(heavy, /scrollArenaWheel\(defender, defenderElementId, 120, m223WheelDelayMs\)/);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.block.parryWindowMs, 125);
});
