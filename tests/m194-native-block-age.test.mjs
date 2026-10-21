import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("M194 genuine W3C wheel gets bounded 40ms age before one light release", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiGuardBreakFlight(");
  const end = source.indexOf("\nasync function ", start + 40);
  assert.ok(start >= 0 && end > start, "M194 real multiplayer flight must be present");
  const flight = source.slice(start, end);
  assert.match(flight, /postTrustedWheelMs:\s*\["uiguardbreak", "uiguardbreakpunishffahit"\]\.includes\(scenario\) \? 40 : 0/);
  assert.match(flight, /trustedWheelWaitMs:\s*\["uiguardbreak", "uiguardbreakpunishffahit"\]\.includes\(scenario\) \? 190 : 0/);
  assert.match(flight, /sendAttackDown: \(\) => setArenaAttackButton\(attacker, true\)/);
  assert.match(flight, /sendWheel: \(\) => scrollArenaWheel\(defender, defenderElementId, 120, 0\)/);
  assert.match(flight, /awaitTrustedWheel: \(\) => challenge\.wait\(\)/);
  assert.match(flight, /sendAttackUp: \(\) => setArenaAttackButton\(attacker, false\)/);
  assert.match(flight, /if \(!trustedWheelBeforeRelease\)/);
  assert.match(flight, /M193 guard-break exchange \$\{attempt \+ 1\} resolved as parry instead of -38 guard/);
  assert.match(flight, /defenderState\?\.playerHp !== 100/);
  assert.match(flight, /M320_GUARD_BREAK_AUTH_TRACE/);
  assert.doesNotMatch(flight, /dispatchEvent|setTimeout\(.*wheel|forceParry|fakeGuard/);
});
