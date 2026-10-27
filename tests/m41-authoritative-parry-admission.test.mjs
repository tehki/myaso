import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");

test("M41 native parry waits for the original replicated World windup before its real wheel", () => {
  const start = source.indexOf('if (scenario === "uiparrytell" || scenario === "uistun" || scenario === "uiparry") {', source.indexOf("async function runOnlineUiParryFlight("));
  assert.ok(start >= 0, "M35 and M41 must share the qualified authoritative choreography branch");
  const rest = source.slice(start, source.indexOf("} else {", start));
  const helper = readFileSync(new URL("../scripts/m41-native-observed-parry.mjs", import.meta.url), "utf8");
  const aim = rest.indexOf("await aimArena(attacker, attackerElementId, attackOffset);");
  const dispatch = rest.indexOf("await dispatchM41ObservedParry({");
  assert.ok(aim >= 0 && dispatch > aim, "real aim completes before concurrent click/cue choreography");
  assert.match(rest, /sendAttack: \(\) => performArenaM221GuardBreakClick\(attacker, 35\)/);
  assert.match(rest, /awaitWorldCue: \(\) => prearmed \? prearmed.wait\(\) : waitForM41WorldWindup\(/);
  assert.match(rest, /const prearmed = \(scenario === "uistun" \|\| scenario === "uiparry"\)/);
  assert.ok(rest.indexOf("script: m35PrearmedCueScript()") < dispatch,
    "M35 arms the same strict browser cue check before sending native input");
  assert.match(rest, /sendWheel: \(\) => \(scenario === "uiparrytell" \|\| scenario === "uiparry"\)\s*\? scrollM41ViewportWheel\(defender, defenderViewport\)\s*: setArenaBlock\(defender, defenderElementId, true\)/,
    "M33/M41 use one viewport wheel after fresh World cue; M35 preserves original element wheel");
  assert.match(rest, /attacker, 180, attemptAttackerBaseline\.events\.length, attackerReady\.playerNetId/);
  assert.match(helper, /const light = latestText === "Attack committed - your windup is readable\."/,
    "M35 must wait for the genuine light-windup cue");
  assert.match(helper, /allowHeavy && heavy/,
    "M41 must preserve its separately qualified earlier heavy-windup timing");
  assert.match(helper, /actorId !== expectedActorId/);
  assert.match(helper, /const index = state\.events\.length - 1/,
    "native cue must be the latest actually rendered event, never earlier history");
  assert.match(source, /async function waitForM41WorldWindup\(attacker, timeoutMs, baselineEventCount, expectedActorId, allowHeavy = false\)/);
  const poll = source.slice(source.indexOf("async function waitForM41WorldWindup("), source.indexOf("async function runOnlineUiParryFlight("));
  assert.doesNotMatch(poll, /readUiEvidence/);
  assert.match(poll, /await webdriver\(attacker\.base, "POST",/);
  assert.match(poll, /m41NativeAsyncCueScript\(\)/);
  assert.match(poll, /args: \[baselineEventCount, expectedActorId, allowHeavy, timeoutMs\]/);
  assert.match(source, /M33 genuine short-click parry resolved unexpectedly:/,
    "a genuine HP or guard impact must remain a fatal failure");
  assert.match(source, /M41 remote parry-stun tell never appeared:/,
    "remote-only raster evidence remains mandatory");
  assert.match(source, /M41 local parried fighter painted the remote-only tell:/,
    "parried local actor must not paint the remote tell");
});
