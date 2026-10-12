import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMBAT } from "../src/combat/model.mjs";
import { planM198GuardBreakW3cExchange } from "../scripts/m198-guardbreak-input-plan.mjs";

const plan = () => planM198GuardBreakW3cExchange({
  parryWindowMs: COMBAT.block.parryWindowMs,
  shortBlockMs: COMBAT.block.shortBlockMs,
  attackWindupMs: COMBAT.attack.windupMs,
  guardDamage: COMBAT.attack.guardDamage,
  maxGuard: COMBAT.guard.max,
});

test("M198 schedules a single real click inside the unchanged block-only interval", () => {
  const result = plan();
  assert.equal(result.clicksPerWheel, 1);
  assert.equal(result.pointerPauseMs, 40);
  assert.equal(result.nominalWheelToImpactMs, 175);
  assert.equal(result.blockOnlyMarginMs, 50);
  assert.ok(result.nominalWheelToImpactMs > COMBAT.block.parryWindowMs);
  assert.ok(result.nominalWheelToImpactMs < COMBAT.block.shortBlockMs);
  assert.equal(result.minimumExchanges, 3);
  assert.ok(Object.isFrozen(result));
});

test("M198 fails closed on impossible or invalid block-only timing", () => {
  const ok = {
    parryWindowMs: 125, shortBlockMs: 240, attackWindupMs: 135,
    guardDamage: 38, maxGuard: 100,
  };
  for (const change of [
    { shortBlockMs: 110 }, { attackWindupMs: 300 },
    { parryWindowMs: 240 }, { guardDamage: 0 }, { maxGuard: NaN },
    { shortBlockMs: Infinity },
  ]) {
    assert.throws(() => planM198GuardBreakW3cExchange({ ...ok, ...change }), RangeError);
  }
});

test("M198 guard-break browser acceptance uses genuine one-click W3C plan", () => {
  const source = readFileSync(
    new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8",
  );
  const guardBreak = source.slice(
    source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("),
  );
  assert.ok(guardBreak.includes("await scrollArenaWheel(defender, defenderElementId, 120, 0);"));
  assert.match(guardBreak, /await scrollArenaWheel\(defender, defenderElementId, 120, 0\);\s+await performArenaAttackBurst\(/);
  assert.ok(guardBreak.includes("attacker, m198Plan.clicksPerWheel, m198Plan.pointerPauseMs"));
  assert.ok(guardBreak.includes("defenderState?.playerHp !== 100"));
  assert.ok(guardBreak.includes("feedbackTransitions.includes(\"parried\")"));
  assert.ok(guardBreak.includes("defenderResult.playerGuard !== 0"));
  assert.ok(!guardBreak.includes("performArenaAttackBurst(attacker, 3, 45)"));
});
