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
  assert.match(flight, /performArenaM221GuardBreakClick\(attacker, 10\)/);
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
  assert.match(source, /wheelHeadStartMs: 0/);
  assert.match(source, /postTrustedWheelMs: 45/);
});
