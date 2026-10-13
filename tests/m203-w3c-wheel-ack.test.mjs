import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planM203W3cPointerPause as pause } from "../scripts/m203-w3c-wheel-ack.mjs";

const plan = wheelCommandMs => pause({ wheelCommandMs, nominalPointerPauseMs: 40 });
test("M203 preserves 40ms parry margin for fast genuine wheel ack", () => {
  assert.equal(plan(0), 40);
  assert.equal(plan(20), 40);
  assert.equal(plan(35), 40);
});
test("M203 scales down extra pointer pause when Firefox W3C ack lags", () => {
  assert.equal(plan(50), 25);
  assert.equal(plan(65), 10);
  assert.equal(plan(75), 0);
  assert.equal(plan(110), 0);
  assert.equal(plan(250), 0);
});
test("M203 rejects invalid timing and never creates negative W3C pauses", () => {
  for (const n of [NaN, Infinity, -1, undefined]) {
    assert.throws(() => plan(n), RangeError);
  }
  assert.throws(() => pause({ wheelCommandMs: 10, nominalPointerPauseMs: 9999 }), RangeError);
});
test("M203 maintains one genuine Firefox scroll followed by one genuine Chrome W3C click", () => {
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(section.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(section.includes("dispatchM208WheelLedW3cExchange({"));
  assert.ok(section.includes("attacker, m198Plan.clicksPerWheel, pointerPauseMs"));
  assert.ok(section.includes("defenderState?.playerHp !== 100"));
  assert.ok(section.includes('feedbackTransitions.includes("parried")'));
  assert.ok(section.includes("defenderResult.playerGuard !== 0"));
});
