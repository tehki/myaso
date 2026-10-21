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

test("M336 M145 holds one authentic Space+LMB across 30Hz sampling; M144 unchanged", () => {
  assert.match(flight, /performArenaPreAimedJumpAttackChord\(jumpAttacker, spatial \? 180 : 90\)/);
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

test("M336 read-only M144/M145 real FFA and spatial client input evidence preserves production controls", () => {
  const guarded = game.indexOf('if (acceptanceScenario === "uimultirecoveryspatial" || acceptanceScenario === "uimultirecoveryffa") {', game.indexOf("function simulatePrediction("));
  const send = game.indexOf("networkClient.sendInput({ tick: outgoingTick, ...currentInput });", guarded);
  const reset = game.indexOf("attackRequested = false;", send);
  assert.ok(guarded >= 0 && send > guarded && reset > send);
  const evidence = game.slice(guarded, send);
  // In addition to the original spatial M145, independently capture actual
  // M144 submission before the same untouched native client send boundary.
  assert.match(evidence, /uimultirecoveryspatial/);
  assert.match(evidence, /uimultirecoveryffa/);
  assert.match(evidence, /debug\.inputSubmissions\.push\(\{/);
  assert.match(evidence, /attack: Boolean\(currentInput\.attack\)/);
  assert.match(evidence, /jump: Boolean\(currentInput\.jump\)/);
  assert.match(evidence, /heavyAttack: Boolean\(currentInput\.heavyAttack\)/);
  assert.match(evidence, /debug\.inputSubmissions\.length > 32/);
  assert.ok(!evidence.includes("networkClient.sendInput("));
  assert.match(runner, /inputSubmissions: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputSubmissions \?\? \[\]\)\.slice\(-32\)/);
});
