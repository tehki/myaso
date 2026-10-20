import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = runner.indexOf("async function runOnlineUiJumpRecoveryFfaFocusFlight(");
const end = runner.indexOf("\nasync function ", start + 40);
const flight = runner.slice(start, end);
const chordStart = runner.indexOf("async function performArenaPreAimedJumpAttackChord(");
const chordEnd = runner.indexOf("\nasync function ", chordStart+36);
const chord = runner.slice(chordStart, chordEnd);

test("M337 M143 uses real pre-aim and pointer-first Space+LMB with no W3C reposition inside chord", () => {
  assert.ok(start > 0 && end > start);
  const aim = flight.indexOf("await aimArena(jumpAttacker, jumpArena, -200)");
  const chordCall = flight.indexOf("performArenaPreAimedJumpAttackChord(jumpAttacker, 90)");
  assert.ok(aim >= 0 && chordCall > aim);
  assert.doesNotMatch(flight, /performArenaJumpAttackChord\(jumpAttacker, jumpArena/);
  assert.ok(chord.indexOf('type: "pointer"') < chord.indexOf('type: "key"'));
  assert.match(chord, /type: "pointerDown", button: 0/);
  assert.match(chord, /type: "keyDown", value: " "/);
  assert.doesNotMatch(chord, /type: "pointerMove"|dispatchEvent\(/);
  assert.match(chord, /type: "pointerUp", button: 0/);
  assert.match(chord, /type: "keyUp", value: " "/);
});

test("M337 preserves strict real event/chord, server jump lifecycle and focus/vitals assertions", () => {
  assert.match(flight, /Math\.abs\(spaceDowns\[0\]\.epochMs - attackDowns\[0\]\.epochMs\) > 60/);
  assert.match(flight, /jumpState\.acceptance\?\.scenario !== "uijumprecoveryffa"/);
  assert.match(flight, /COMBAT_ACTION\.jumpAttackWindup/);
  assert.match(flight, /COMBAT_ACTION\.jumpAttackActive/);
  assert.match(flight, /COMBAT_ACTION\.jumpAttackRecovery/);
  assert.match(flight, /punishIndex < 0 \|\| nearestReturnIndex <= punishIndex/);
  assert.match(flight, /evidence\.some\(\(entry\) => entry\.playerHp !== 100 \|\| entry\.playerGuard !== 100\)/);
  assert.match(flight, /attackDowns\[0\]\.x >= 0\.5/);
});
