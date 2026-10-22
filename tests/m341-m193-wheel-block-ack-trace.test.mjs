import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const guard = game.slice(game.indexOf("function recordAcceptanceState("),
  game.indexOf("function observeThreatCommitment(", game.indexOf("function recordAcceptanceState(")));
const trace = game.slice(game.indexOf("function recordM144OriginalInputTrace("),
  game.indexOf("function simulatePrediction("));
const sender = game.slice(game.indexOf("function simulatePrediction("),
  game.indexOf("function predictMovement("));
const originalNative = runner.slice(runner.indexOf("async function runOnlineUiGuardBreakFlight("),
  runner.indexOf("\nasync function ", runner.indexOf("async function runOnlineUiGuardBreakFlight(") + 50));

test("M341 M193 native block trace can exist only in original guardbreak/tell or preexisting M143/M144 scenarios", () => {
  assert.match(guard, /"uiguardbreak"/);
  assert.match(guard, /"uiguardbreaktell"/);
  assert.match(guard, /recordAcceptanceAction\(\s*acceptance\.ownActionTransitions/);
  for (const token of ["uiguardbreak", "uiguardbreaktell", "uimultirecoveryffa", "uijumprecoveryffa"]) {
    assert.ok(trace.includes('acceptanceScenario !== "' + token + '"'), token);
  }
  assert.match(trace, /entry\.attack \|\| entry\.heavyAttack \|\| entry\.jump \|\| entry\.block/);
  assert.match(trace, /originalInputTraceRemaining = 12/);
  assert.match(trace, /debug\.inputSubmissions\.length > 32/);
  assert.doesNotMatch(trace, /sendInput\(|set_input|dispatchEvent|\.click\(/);
});

test("M341 inspect exact genuine v1 block sample and wheel interval before unmodified sender", () => {
  const beforeSend = sender.slice(sender.indexOf("recordM144OriginalInputTrace({"),
    sender.indexOf("networkClient.sendInput({ tick: outgoingTick, ...currentInput });"));
  assert.match(beforeSend, /kind: "send"/);
  assert.match(beforeSend, /clientTick: outgoingTick/);
  assert.match(beforeSend, /block: Boolean\(currentInput\.block\)/);
  assert.match(beforeSend, /shortBlockWindowRemainingMs: Math\.max\(0, Math\.round\(shortBlockUntil - performance\.now\(\)\)\)/);
  assert.match(beforeSend, /attack: Boolean\(currentInput\.attack\)/);
  assert.match(beforeSend, /jump: Boolean\(currentInput\.jump\)/);
  assert.match(beforeSend, /heavyAttack: Boolean\(currentInput\.heavyAttack\)/);
  assert.equal(sender.match(/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);/g)?.length, 1);
  assert.ok(sender.indexOf("networkClient.sendInput(") < sender.indexOf("attackRequested = false;"));
});

test("M341 only genuine accepted processed-input ACKs and original readUiEvidence; M193 strict W3C unchanged", () => {
  const cb = game.slice(game.indexOf("  onProcessedAck(ack) {"), game.indexOf("  onAck(ack) {"));
  assert.match(cb, /kind: "processed-ack"/);
  assert.match(cb, /processedClientTick: ack\.processedClientTick/);
  assert.match(cb, /playerNetId: ack\.playerNetId/);
  assert.match(cb, /serverTick: Number\.isInteger\(ack\.serverTick\)/);
  assert.doesNotMatch(cb, /sendInput\(|dispatchEvent\(/);
  assert.match(runner, /inputSubmissions: \(window\.__MYASO_ACCEPTANCE_STATE__\.inputSubmissions \?\? \[\]\)\.slice\(-32\)/);
  assert.match(originalNative, /trustedWheelBeforeRelease/);
  assert.match(originalNative, /M201_AUTH_\(ACTION\|BLOCK\|PARRY\|BREAK\)/);
  assert.match(originalNative, /M193 guard-break exchange/);
  assert.match(originalNative, /feedbackTransitions\.includes\("parried"\)/);
});

test("M341 requires original 125ms server parry and 38 guard instead of changing gameplay contract", () => {
  const sim = readFileSync(new URL("../server/src/simulation.rs", import.meta.url), "utf8");
  assert.match(sim, /const BLOCK_PARRY_WINDOW_MS: f32 = 125\.0;/);
  assert.match(sim, /const BLOCK_GUARD_DAMAGE: f32 = 38\.0;/);
  assert.match(sim, /if target\.action_elapsed_ms <= BLOCK_PARRY_WINDOW_MS/);
  assert.match(sim, /CombatEvent::Parry/);
  assert.match(sim, /CombatEvent::Block/);
});
