import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const a = source.indexOf("async function runOnlineUiMiddleBlockPressureFlight(");
const b = source.indexOf("\nasync function runOnlineUiGuardBreakFlight(", a + 20);
const flight = source.slice(a, b);

test("R2 genuine middle pointer hold proves exactly three -38 guard events, 100 HP, no parries", () => {
  assert.ok(a >= 0 && b > a);
  assert.match(flight, /pointerDown", button: 1/);
  assert.match(flight, /pointerUp", button: 1/);
  assert.match(flight, /const expectedGuards = \[62, 24, 0\]/);
  assert.match(flight, /performArenaM221GuardBreakClick\(attacker, 45\)/);
  assert.match(flight, /defenderState.playerHp !== 100/);
  assert.match(flight, /defenderState.feedbackTransitions.includes\("parry-success"\)/);
  assert.match(flight, /attackerState.feedbackTransitions.includes\("parried"\)/);
  assert.match(flight, /defenderState.wheels.some\(w => w.deltaY > 0\)/);
  assert.match(flight, /noHpDamage: true/);
  assert.ok(!flight.includes("dispatchEvent("));
  assert.ok(!flight.includes("new PointerEvent("));
});

test("R2 adds hold-block acceptance WITHOUT disabling original strict M194 wheel-block suite", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(workflow, /MYASO_PVP_SCENARIO: "uimiddleblockpressure"/);
  assert.match(workflow, /Validate M194 repeated real guard-break block-only pressure/);
  assert.match(workflow, /for attempt in 1 2 3 4 5/);
  // R2 no longer uses the obsolete wheel-first timed click. The unchanged
  // M194 suite must exercise authentic LMB-down, trusted Firefox wheel, and
  // LMB-up release-to-strike while retaining strict guard/parry/HP checks.
  const start = source.indexOf("async function runOnlineUiGuardBreakFlight(");
  const end = source.indexOf("\nasync function runOnlineUiGuardBreakTellFlight(", start);
  assert.ok(start >= 0 && end > start);
  const guardBreak = source.slice(start, end);
  assert.match(guardBreak, /dispatchR2ReleaseLedShortBlock\(\{/);
  assert.match(guardBreak, /sendAttackDown: \(\) => setArenaAttackButton\(attacker, true\)/);
  assert.match(guardBreak, /awaitTrustedWheel: \(\) => challenge\.wait\(\)/);
  assert.match(guardBreak, /if \(!trustedWheelBeforeRelease\)/);
  assert.match(guardBreak, /sendAttackUp: \(\) => setArenaAttackButton\(attacker, false\)/);
  assert.match(guardBreak, /defenderState\?\.playerHp !== 100/);
  assert.match(guardBreak, /defenderResult\.playerGuard !== 0/);
  assert.match(guardBreak, /feedbackTransitions\.includes\("parried"\)/);
  const heldRelease = readFileSync(new URL("../scripts/r2-release-led-short-block.mjs", import.meta.url), "utf8");
  assert.match(heldRelease, /wheelHeadStartMs: 0/);
  assert.match(heldRelease, /postTrustedWheelMs = 0/, "all established W3C scenarios retain zero extra post-wheel wait by default");
  assert.ok(guardBreak.includes("postTrustedWheelMs: m151ReleaseAnchoredGuardOnly ? 25 : 0"),
    "only M151 keeps the optional 25ms pause; M194 releases upon actual trusted wheel receipt");
  assert.match(heldRelease, /receiptGraceMs = 100/);
});
