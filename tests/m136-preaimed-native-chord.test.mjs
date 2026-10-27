import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url),"utf8");
const start=source.indexOf("async function runOnlineUiJumpAttackFlight(");
const end=source.indexOf("\nasync function ",start+45);
const flight=source.slice(start,end);

test("M136 original Chrome/Firefox JumpAttack pre-aims then uses existing simultaneous genuine W3C chord",()=>{
  const aim=flight.indexOf("await aimArena(attacker, attackerElementId, attackOffset)");
  const native=flight.indexOf("await performArenaPreAimedJumpAttackChord(attacker, 90)");
  assert.ok(aim>=0 && native>aim);
  assert.doesNotMatch(flight,/performArenaJumpAttackChord\(attacker,/);
  assert.match(flight,/Math\.abs\(jumpDown\.epochMs - attackDown\.epochMs\) > 60/);
  assert.match(flight,/opponentHp === 58/);
  assert.match(flight,/playerHp === 58/);
  assert.match(flight,/COMBAT_ACTION\.jumpAttackRecovery/);
});

test("M136 uses only already-existing pointer-first W3C chord; no fabricated keys or HIT",()=>{
  const helper=source.slice(source.indexOf("async function performArenaPreAimedJumpAttackChord("),
    source.indexOf("\nasync function ",source.indexOf("async function performArenaPreAimedJumpAttackChord(")+30));
  assert.ok(helper.indexOf('type: "pointer"') < helper.indexOf('type: "key"'));
  assert.match(helper,/type: "pointerDown", button: 0/);
  assert.match(helper,/type: "keyDown", value: " "/);
  assert.doesNotMatch(helper,/type: "pointerMove"|dispatchEvent|M201_AUTH_HIT/);
});
