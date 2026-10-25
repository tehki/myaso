import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");

test("M41 native parry waits for the original replicated World windup before its real wheel", () => {
  const start = source.indexOf('if (scenario === "uiparrytell") {', source.indexOf("async function runOnlineUiParryFlight("));
  assert.ok(start >= 0, "M41 must have a dedicated authoritative choreography branch");
  const rest = source.slice(start, source.indexOf("} else {", start));
  const genuineAttack = rest.indexOf("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 35);");
  const worldMessage = rest.indexOf("await waitForM41WorldWindup(");
  const genuineWheel = rest.indexOf("await setArenaBlock(defender, defenderElementId, true);");
  assert.ok(genuineAttack >= 0 && worldMessage > genuineAttack && genuineWheel > worldMessage,
    "M41 must observe original World windup before one actual defender wheel");
  assert.match(source, /async function waitForM41WorldWindup[\s\S]*?Heavy strike committed - the long windup is readable\./,
    "the transient authoritative Heavy windup must be available as the first genuine stage");
  assert.match(source, /async function waitForM41WorldWindup[\s\S]*?Attack committed - your windup is readable\./,
    "the authoritative Light-windup fallback must remain available");
  assert.match(source, /async function waitForM41WorldWindup\(attacker, timeoutMs, baselineEventCount\)/,
    "M41 cue must require an explicit per-attempt baseline");
  assert.match(source, /evidence\.events\.slice\(baselineEventCount\)\.find\(/,
    "stale windup cues from earlier attempts must never trigger another wheel");
  assert.match(source, /lastAttemptBaseline\.find\(\(entry\) => entry\.browser === attacker\.name\)/,
    "fresh cue baseline must come from the attacker immediately before this attack");
  assert.match(source, /attacker, 180, attemptAttackerBaseline\.events\.length/,
    "M41 must pass the current genuine attempt offset into cue admission");
  assert.match(source, /M33 genuine short-click parry resolved unexpectedly:/,
    "a genuine HP or guard impact must remain a fatal failure");
  assert.match(source, /M41 remote parry-stun tell never appeared:/,
    "remote-only raster evidence remains mandatory");
  assert.match(source, /M41 local parried fighter painted the remote-only tell:/,
    "parried local actor must not paint the remote tell");
});
