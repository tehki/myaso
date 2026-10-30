import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const begin = source.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
const end = source.indexOf("\nasync function ", begin + 36);
const flight = source.slice(begin, end);
const chordBegin = source.indexOf("async function performArenaPreAimedJumpAttackChord(");
const chordEnd = source.indexOf("\nasync function ", chordBegin + 36);
const chord = source.slice(chordBegin, chordEnd);

test("M334 genuine pointer pre-aim precedes authenticated light event and native chord", () => {
  assert.ok(begin >= 0 && end > begin && chordBegin >= 0 && chordEnd > chordBegin);
  const aim = flight.indexOf("await aimArena(jumpAttacker, jumpArena, -200)");
  const token = flight.indexOf("m227Registry.issue({ type: spatial");
  const attack = flight.indexOf("performArenaAttackHold(lightAttacker, lightArena, 200, 45)");
  const receipt = flight.indexOf("await lightChallenge.wait()");
  const delayed = flight.indexOf("await waitForM227TrustedLead(receipt, jumpInputDelayMs, {sleep})");
  const chordCall = flight.indexOf("await performArenaPreAimedJumpAttackChord(jumpAttacker, 180)");
  assert.ok(aim >= 0 && aim < token && token < attack && attack < chordCall);
  assert.ok(receipt < delayed && delayed < chordCall);
  assert.match(flight, /const jumpInputDelayMs = spatial \? 80 : 70/);
  assert.match(flight, /const minLeadMs = spatial \? 70 : 60/);
  assert.match(flight, /const maxLeadMs = spatial \? 150 : 200/);
  assert.match(flight, /Math\.abs\(spaceDowns\[0\]\.epochMs - jumpAttackDowns\[0\]\.epochMs\) > 60/);
});

test("M335 one W3C pointer-first command keeps Space and LMB in the same first tick", () => {
  assert.equal((chord.match(/webdriver\(session\.base, "POST"/g) ?? []).length, 1);
  const pointerIndex = chord.indexOf('type: "pointer"');
  const keyIndex = chord.indexOf('type: "key"');
  assert.ok(pointerIndex >= 0 && pointerIndex < keyIndex, "native pointer source precedes keyboard");
  const mouse = chord.slice(pointerIndex, keyIndex);
  const key = chord.slice(keyIndex);
  assert.match(mouse, /type: "pointerDown", button: 0/);
  assert.match(key, /type: "keyDown", value: " "/);
  assert.doesNotMatch(chord, /type: "pointerMove"|dispatchEvent\(|window\.__MYASO/);
  assert.equal((key.match(/type: "keyDown"/g) ?? []).length, 1);
  assert.equal((mouse.match(/type: "pointerDown"/g) ?? []).length, 1);
  assert.ok(key.indexOf('type: "keyDown"') < key.indexOf('type: "pause"'));
  assert.ok(mouse.indexOf('type: "pointerDown"') < mouse.indexOf('type: "pause"'));
  assert.match(key, /type: "pause", duration: boundedHoldMs[\s\S]*type: "keyUp"/);
  assert.match(mouse, /type: "pause", duration: boundedHoldMs[\s\S]*type: "pointerUp"/);
  assert.match(chord, /Math\.max\(50, Math\.min\(180, Math\.trunc\(holdMs\)\)\)/);
  // Game officially supports Space pressed with LMB already down.
  const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.ok(game.includes('if (leftButtonDown) leftButtonCharge.commitLight()'));
  assert.ok(game.includes('jumpRequested = true;'));
});
