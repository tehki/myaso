import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const from = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
const to = runner.indexOf("\nasync function ", from + 35);
const flight = runner.slice(from, to);
const begin = runner.indexOf("async function performArenaPreAimedJumpAttackChord(");
const end = runner.indexOf("\nasync function ", begin + 30);
const chord = runner.slice(begin, end);

test("M144/M336 both hold one authentic Space+LMB across original 30Hz input sampling", () => {
  assert.match(flight, /performArenaPreAimedJumpAttackChord\(jumpAttacker, 180\)/);
  assert.match(chord, /const boundedHoldMs = Math\.max\(50, Math\.min\(180, Math\.trunc\(holdMs\)\)\)/);
  assert.match(chord, /type: "pointerDown", button: 0/);
  assert.match(chord, /type: "keyDown", value: " "/);
  assert.match(chord, /type: "pointerUp", button: 0/);
  assert.match(chord, /type: "keyUp", value: " "/);
  assert.match(flight, /const minLeadMs = spatial \? 70 : 60/);
  assert.match(flight, /const maxLeadMs = spatial \? 150 : 200/);
  assert.match(flight, /Math\.abs\(spaceDowns\[0\]\.epochMs - jumpAttackDowns\[0\]\.epochMs\) > 60/);
  assert.match(flight, /verifyM211DualRecoveryServerProof\(m201ServerOutput\(\)/);
  assert.match(flight, /lightPunishIndex < 0 \|\| jumpPunishIndex <= lightPunishIndex/);
  assert.doesNotMatch(flight, /dispatchEvent\(|\.click\(\)/);
});

test("M336 read-only real client input submission evidence does not change packet or controls", () => {
  const guarded = game.indexOf('if (acceptanceScenario === "uimultirecoveryspatial"', game.indexOf("function simulatePrediction("));
  const send = game.indexOf("networkClient.sendInput({ tick: outgoingTick, ...currentInput });", guarded);
  const reset = game.indexOf("attackRequested = false;", send);
  assert.ok(guarded >= 0 && send > guarded && reset > send);
  assert.match(game.slice(guarded, send), /acceptanceScenario === "uimultirecoveryffa"/,
    "M144 must expose actual 30Hz sender input samples without modifying packets");
  const evidence = game.slice(guarded, send);
  assert.match(evidence, /debug\.inputSubmissions\.push\(\{/);
  assert.match(evidence, /attack: Boolean\(currentInput\.attack\)/);
  assert.match(evidence, /jump: Boolean\(currentInput\.jump\)/);
  assert.match(evidence, /heavyAttack: Boolean\(currentInput\.heavyAttack\)/);
  assert.match(evidence, /debug\.inputSubmissions\.length > 32/);
  assert.ok(!evidence.includes("networkClient.sendInput("));
  assert.match(runner, /inputSubmissions: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputSubmissions \?\? \[\]\)\.slice\(-32\)/);
});
