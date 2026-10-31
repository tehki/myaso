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
  assert.ok(guardBreak.includes("dispatchR2ReleaseLedShortBlock({"));
  // M221 replaced the split WebDriver down/ACK/up path with one authentic
  // W3C click after a trusted Firefox wheel. The old static M198 text check
  // referenced a sender no longer used; keep both delivery ordering and
  // single-click proof strict instead of silently accepting missing callbacks.
  const wheel = guardBreak.indexOf("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)");
  const click = guardBreak.indexOf("sendAttackUp: () => setArenaAttackButton(attacker, false)");
  assert.ok(wheel >= 0 && click > wheel);
  assert.ok(guardBreak.includes("const receipt=await challenge.wait()"));
  const clickFn = source.slice(
    source.indexOf("async function setArenaAttackButton("),
    source.indexOf("async function performArenaAttackBurst("),
  );
  assert.ok(clickFn.includes('pressed ? "pointerDown" : "pointerUp"'));
  assert.ok(clickFn.includes("button: 0"));
  assert.ok(guardBreak.includes("sendAttackDown: () => setArenaAttackButton(attacker, true)"));
  assert.ok(guardBreak.includes("defenderState?.playerHp !== 100"));
  assert.ok(guardBreak.includes("feedbackTransitions.includes(\"parried\")"));
  assert.ok(guardBreak.includes("defenderResult.playerGuard !== 0"));
  assert.ok(!guardBreak.includes("performArenaAttackBurst(attacker, 3, 45)"));
});
