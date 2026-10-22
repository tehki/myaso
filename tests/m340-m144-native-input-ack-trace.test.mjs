import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const record = game.slice(game.indexOf("function recordM144OriginalInputTrace("),
  game.indexOf("function simulatePrediction("));
const sender = game.slice(game.indexOf("function simulatePrediction("),
  game.indexOf("function predictMovement("));
const callback = game.slice(game.indexOf("  onProcessedAck(ack) {"),
  game.indexOf("  onAck(ack) {"));

test("M340 native M144/M143 trace is explicitly scenario-bound, finite and diagnostic", () => {
  assert.match(record, /acceptanceScenario !== "uimultirecoveryffa"/);
  assert.match(record, /acceptanceScenario !== "uijumprecoveryffa"/);
  assert.match(record, /window\.__MYASO_ACCEPTANCE_STATE__/);
  assert.match(record, /originalInputTraceRemaining = 12/);
  assert.match(record, /debug\.inputSubmissions\.length > 32/);
  assert.doesNotMatch(record, /sendInput|set_input|dispatchEvent|\.click\(/);
});

test("M340 observes unmodified real outgoing v1 attack / heavy / jump, including neutral after edges", () => {
  assert.match(sender, /recordM144OriginalInputTrace\(\{[\s\S]*?kind: "send"/);
  for (const token of ["clientTick: outgoingTick", "attack: Boolean(currentInput.attack)",
    "heavyAttack: Boolean(currentInput.heavyAttack)", "jump: Boolean(currentInput.jump)",
    "pointerHeld: leftButtonCharge.isPressed()", "charging: leftButtonCharge.isCharging()",
    'spaceHeld: keys.has("Space")']) {
    assert.ok(sender.includes(token), token);
  }
  assert.equal(sender.match(/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);/g)?.length, 1);
  assert.ok(sender.indexOf("recordM144OriginalInputTrace({") < sender.indexOf("networkClient.sendInput("));
  assert.ok(sender.indexOf("networkClient.sendInput(") < sender.indexOf("attackRequested = false;"));
});

test("M340 pairs real processed INPUT_ACK with client tick without inventing an ACK", () => {
  assert.match(callback, /kind: "processed-ack"/);
  assert.match(callback, /processedClientTick: ack\.processedClientTick/);
  assert.match(callback, /playerNetId: ack\.playerNetId/);
  assert.doesNotMatch(callback, /sendInput|processInput|dispatchEvent/);
  assert.ok(game.includes('if (acceptanceScenario === "uimultirecoveryspatial") {'),
    "original M336 M145 instrumentation must remain unchanged");
});

test("M340 native M144 still observes original three-stage focus, physical inputs and 60..200ms lead", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  assert.ok(runner.includes('inputSubmissions: (window.__MYASO_ACCEPTANCE_STATE__.inputSubmissions ?? []).slice(-32)'));
  const start = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
  const end = runner.indexOf("\nasync function ", start + 40);
  const flight = runner.slice(start, end);
  assert.ok(flight.includes("lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex"));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200"));
  assert.ok(flight.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"));
});
