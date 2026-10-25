import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");

test("M41 native parry waits for the original replicated World windup before its real wheel", () => {
  const start = source.indexOf('if (scenario === "uiparrytell") {', source.indexOf("async function runOnlineUiParryFlight("));
  assert.ok(start >= 0, "M41 must have a dedicated authoritative choreography branch");
  const rest = source.slice(start, source.indexOf("} else {", start));
  const genuineAttack = rest.indexOf("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 35);");
  const worldMessage = rest.indexOf('await waitForUiMessage(attacker, "Attack committed - your windup is readable.", 180);');
  const genuineWheel = rest.indexOf("await setArenaBlock(defender, defenderElementId, true);");
  assert.ok(genuineAttack >= 0 && worldMessage > genuineAttack && genuineWheel > worldMessage,
    "M41 must observe real committed windup before one actual defender wheel");
  assert.match(source, /M33 genuine short-click parry resolved unexpectedly:/,
    "a genuine HP or guard impact must remain a fatal failure");
  assert.match(source, /M41 remote parry-stun tell never appeared:/,
    "remote-only raster evidence remains mandatory");
  assert.match(source, /M41 local parried fighter painted the remote-only tell:/,
    "parried local actor must not paint the remote tell");
});
