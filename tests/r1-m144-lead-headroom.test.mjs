import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LEFT_HEAVY_CHARGE_MS } from "../src/browser/left-button-charge.mjs";

test("M144 retains exact real 60..200ms light-release lead gate with earlier trusted onset", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start > 0 && end > start);
  const flight = source.slice(start, end);
  assert.ok(flight.includes("const jumpInputDelayMs = spatial ? 80 : 70;"));
  assert.ok(flight.includes("await lightChallenge.wait()"));
  assert.ok(flight.includes('m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" })'));
  assert.ok(flight.includes("await sleep(jumpInputDelayMs)"));
  // Real UI light click must not cross the 80ms heavy upgrade timer.
  const genuineLightClickMs = 45;
  assert.ok(genuineLightClickMs < LEFT_HEAVY_CHARGE_MS);
  assert.ok(flight.includes(`performArenaAttackHold(lightAttacker, lightArena, 200, ${genuineLightClickMs})`));
  assert.ok(flight.includes("performArenaPreAimedJumpAttackChord(jumpAttacker, spatial ? 180 : 90)"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightUps[0].epochMs"));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60;"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200;"));
  assert.ok(flight.includes("inputLeadMs < minLeadMs || inputLeadMs > maxLeadMs"));
  assert.ok(flight.includes("lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex"));
  assert.ok(flight.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"));
  assert.ok(flight.includes("sampleUiEvidenceWhileActive(entries, 1250, 8)"));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60;"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200;"));
  assert.ok(flight.includes("evidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)"));
});


test("M326 authentic spatial jump headroom retains unchanged measured and server gates", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
  const end = source.indexOf("\nasync function ", start + 20);
  const flight = source.slice(start, end);
  assert.ok(flight.includes("const jumpInputDelayMs = spatial ? 80 : 70;"));
  assert.ok(flight.includes('m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" })'));
  assert.ok(flight.includes("await lightChallenge.wait()"));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60;"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200;"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightDowns[0].epochMs"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightUps[0].epochMs"));
  assert.ok(flight.includes("inputLeadMs < minLeadMs || inputLeadMs > maxLeadMs"));
  assert.ok(flight.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"));
  assert.ok(!flight.includes("dispatchEvent("));
});

test("M144 preserves read-only 30Hz Space+LMB source and authenticated ACK evidence", () => {
  const client = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const sender = client.slice(client.indexOf("function simulatePrediction(stepMs) {"),
    client.indexOf("\nfunction predictMovement(", client.indexOf("function simulatePrediction(stepMs) {")));
  const ack = client.slice(client.indexOf("  onAck(ack) {"), client.indexOf("\nfunction observeCombatState("));
  const diagnosticCondition = 'acceptanceScenario === "uimultirecoveryspatial" || acceptanceScenario === "uimultirecoveryffa"';
  assert.ok(sender.includes(diagnosticCondition), "M144 and M145 use the same genuine production outgoing sample");
  assert.ok(sender.includes("networkClient.sendInput({ tick: outgoingTick, ...currentInput });"),
    "the original game must send real input unchanged");
  assert.ok(sender.includes("debug.inputSubmissions.push({"), "only record real submissions");
  for (const field of ["attack: Boolean(currentInput.attack)", "jump: Boolean(currentInput.jump)",
    "heavyAttack: Boolean(currentInput.heavyAttack)", "clientTick: outgoingTick"]) {
    assert.ok(sender.includes(field), "actual source trace must include " + field);
  }
  assert.ok(ack.includes('if (acceptanceScenario === "uimultirecoveryffa")'),
    "M144 real server ACK trace is scenario-scoped");
  assert.ok(ack.includes("witness.lastProcessedClientTick = networkClient.processedClientTick"));
  assert.ok(ack.includes("witness.lastProcessedServerTick = networkClient.latestServerTick"));
  assert.ok(runner.includes("lastProcessedClientTick: window.__MYASO_ACCEPTANCE_STATE__.lastProcessedClientTick ?? null"));
  assert.ok(runner.includes("lastProcessedServerTick: window.__MYASO_ACCEPTANCE_STATE__.lastProcessedServerTick ?? null"));
  assert.ok(runner.includes("inputSubmissions: (window.__MYASO_ACCEPTANCE_STATE__.inputSubmissions ?? []).slice(-32)"));
  assert.ok(runner.includes("performArenaPreAimedJumpAttackChord(jumpAttacker, spatial ? 180 : 90)"));
  assert.ok(runner.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"),
    "read-only source evidence must not replace original World acceptance");
  assert.ok(!sender.includes("dispatchEvent("), "never replace native W3C input with fake DOM events");
});
