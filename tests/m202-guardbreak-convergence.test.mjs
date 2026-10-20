import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mustAwaitM202GuardConvergence as needsWait } from "../scripts/m202-guardbreak-convergence.mjs";

const check = (attemptsDone, defenderGuard, attackerConfirmed = false) =>
  needsWait({ attemptsDone, minimumExchanges: 3, defenderGuard, attackerConfirmed });

test("M202 awaits delayed zero-guard replication after exactly three true block hits", () => {
  assert.equal(check(3, 24, true), true);
  assert.equal(check(3, 24), true);
  assert.equal(check(2, 62, true), true);
});

test("M202 does not wait for an early ordinary guarded hit", () => {
  assert.equal(check(1, 62), false);
  assert.equal(check(2, 24), false);
  assert.equal(check(3, 0, true), false);
});

test("M202 rejects invalid stale guard and counts fail closed", () => {
  for (const guard of [NaN, -1, Infinity, undefined]) {
    assert.throws(() => check(3, guard), RangeError);
  }
  assert.throws(() => needsWait({ attemptsDone: 0, minimumExchanges: 3, defenderGuard: 24, attackerConfirmed: true }), RangeError);
  assert.throws(() => needsWait({ attemptsDone: 3, minimumExchanges: 0, defenderGuard: 24, attackerConfirmed: true }), RangeError);
});

test("M202 browser runner converges without extra genuine input or relaxed assertions", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const section = source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("), source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(section.includes("mustAwaitM202GuardConvergence("));
  assert.ok(section.includes("M202_GUARD_BREAK_CONVERGED"));
  assert.ok(section.includes("M202 zero guard did not converge"));
  assert.ok(section.includes("defenderState?.playerHp !== 100"));
  assert.ok(section.includes("attackerState?.feedbackTransitions.includes(\"parried\")"));
  assert.ok(section.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(section.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  assert.ok(section.includes("defenderResult.playerGuard !== 0"));
});
