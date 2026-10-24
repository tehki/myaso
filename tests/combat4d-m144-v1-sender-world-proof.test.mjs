import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M144 native sender proof is read-only, original v1, bounded and 3-browser World-linked", () => {
  const client = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const native = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/src/main.rs", import.meta.url), "utf8");
  const start = client.indexOf("function simulatePrediction(stepMs) {");
  const end = client.indexOf("\nfunction predictMovement(", start);
  assert.ok(start >= 0 && end > start);
  const sender = client.slice(start, end);
  assert.ok(sender.includes('acceptanceScenario === "uimultirecoveryffa"'));
  assert.ok(sender.includes('acceptanceScenario === "uimultirecoveryspatial"'));
  assert.ok(sender.includes('debug.m144SentSamples.push({'));
  assert.ok(sender.includes('jump: Boolean(currentInput.jump)'));
  assert.ok(sender.includes('keySpace: keys.has("Space")'));
  assert.ok(sender.includes('debug.m144SentSamples.length > 96'));
  assert.ok(sender.indexOf('debug.m144SentSamples.push({') < sender.indexOf('networkClient.sendInput({'),
    "real sender trace must be captured before the unchanged original packet submission");
  assert.ok(native.includes('m144SentSamples: (window.__MYASO_ACCEPTANCE_STATE__.m144SentSamples ?? [])'));
  assert.ok(native.includes('M144_ORIGINAL_AUTHENTIC_INGRESS '));
  assert.ok(native.includes('line.startsWith("M121_V1_SERVER_INPUT ")') || native.includes('/^M121_V1_SERVER_INPUT /'));
  assert.ok(native.includes('scenario === "uimultirecoveryffa"'));
  assert.ok(native.includes('scenario === "uimultirecoveryspatial"'));
  assert.ok(native.includes('performArenaPreAimedJumpAttackChord(jumpAttacker, spatial ? 180 : 90)'));
  assert.ok(native.includes('const jumpPunishIndex = focusTransitions.findIndex('));
  assert.ok(native.includes('nearestReturnIndex <= jumpPunishIndex'));
  assert.ok(server.includes('!bind.ip().is_loopback() || !flight_action_proof || v2_lab'));
  assert.ok(server.includes('sample.attack || sample.heavy_attack || sample.jump'));
  assert.ok(server.includes('u8::from(sample.jump)'));
  assert.ok(server.includes('u8::from(input.jump)'));
  assert.ok(server.includes('u8::from(latest.jump)'));
});
