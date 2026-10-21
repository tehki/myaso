import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("M121 real strafe key stays held across one genuine short LMB release", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const from = runner.indexOf("async function performArenaDirectionalLight(");
  const to = runner.indexOf("\n\nasync function ", from + 35);
  assert.ok(from > 0 && to > from, "M121 native helper must exist");
  const body = runner.slice(from, to);
  assert.match(body, /await setMovementKey\(session, strafeKey, true\)/);
  assert.match(body, /await sleep\(35\)/);
  assert.match(body, /await performArenaAttackHold\(session, elementId, xOffset, 35\)/);
  assert.match(body, /finally \{\s*await setMovementKey\(session, strafeKey, false\)/);
  const down = body.indexOf("await setMovementKey(session, strafeKey, true)");
  const tap = body.indexOf("await performArenaAttackHold(session, elementId, xOffset, 35)");
  const up = body.indexOf("await setMovementKey(session, strafeKey, false)");
  assert.ok(down < tap && tap < up);
  assert.doesNotMatch(body, /dispatchEvent|evaluate\(|execute\(|window\.__MYASO|\.click\(/);
});

test("M121 real WebDriver helper retains strict directional-sweep recovery gates", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const from = runner.indexOf("async function runOnlineUiDirectionalLightFlight(");
  const to = runner.indexOf("\nasync function ", from + 50);
  const flight = runner.slice(from, to);
  assert.ok(from > 0 && to > from);
  for (const required of [
    'performArenaDirectionalLight(attacker, attackerElementId, strafeKey, attackOffset)',
    '"Opponent hit - 34 HP."',
    '"Hit taken - 34 HP."',
    '"LEFT WINDUP"', '"LEFT SWEEP"',
    '"directional-attack-recovery"', '"Sweep recovery"',
    '"M121 left-sweep readability was incomplete"',
  ]) assert.ok(flight.includes(required), "required original M121 gate: " + required);
  assert.doesNotMatch(flight, /dispatchEvent|forceSweep|fakeRecovery|skipAssertion/);
});
