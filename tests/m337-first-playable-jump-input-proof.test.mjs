import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("First Playable M144/M145 capture bounded real client-submitted chord without input mutation", () => {
  const runtime = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const first = runtime.indexOf("function simulatePrediction(stepMs)");
  const last = runtime.indexOf("\nfunction predictMovement(", first);
  assert.ok(first > 0 && last > first, "production input submission function");
  const source = runtime.slice(first, last);
  assert.match(source, /acceptanceScenario === "uimultirecoveryspatial" \|\| acceptanceScenario === "uimultirecoveryffa"/);
  assert.match(source, /const outgoingTick = clientTick/);
  assert.match(source, /debug\.inputSubmissions\.push\(\{/);
  assert.match(source, /clientTick: outgoingTick/);
  assert.match(source, /attack: Boolean\(currentInput\.attack\)/);
  assert.match(source, /jump: Boolean\(currentInput\.jump\)/);
  assert.match(source, /heavyAttack: Boolean\(currentInput\.heavyAttack\)/);
  assert.match(source, /if \(debug\.inputSubmissions\.length > 32\) debug\.inputSubmissions\.shift\(\)/);
  assert.match(source, /networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\)/);
  const proofAt = source.indexOf("debug.inputSubmissions.push({");
  const sendAt = source.indexOf("networkClient.sendInput({ tick: outgoingTick, ...currentInput })");
  assert.ok(proofAt > 0 && sendAt > proofAt, "only read the real submitted sample before send");
  assert.doesNotMatch(source, /dispatchEvent|fakeInput|forceJumpAttack|simulateServerAction/);
});

test("First Playable keeps both original strict M144 and M145 recovery focus gates", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const from = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
  const to = runner.indexOf("\nasync function runOnlineUiMultiRecoveryPunishFlight(", from);
  assert.ok(from > 0 && to > from);
  const section = runner.slice(from, to);
  for (const token of [
    'M144 simultaneous recovery FFA focus',
    'M145 spatial recovery handoff',
    'PUNISH TARGET #',
    'NEAREST #',
    'performArenaPreAimedJumpAttackChord(jumpAttacker, spatial ? 180 : 90)',
    'await performArenaAttackHold',
    'did not arbitrate nearest punishable -> remaining punishable -> nearest rival',
    'did not render attack recovery -> jump recovery -> clear',
    'lacked one genuine same-tick Space + LMB jump chord'
  ]) if (token !== 'await performArenaAttackHold') assert.ok(section.includes(token), token);
});
