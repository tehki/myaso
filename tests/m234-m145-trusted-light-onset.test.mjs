import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createM227TrustedLightRegistry } from "../scripts/m227-trusted-light-pointer.mjs";

test("M234 spatial onset accepts only the one genuinely trusted light pointerdown", async () => {
  const registry = createM227TrustedLightRegistry({ timeoutMs: 300 });
  const challenge = registry.issue();
  assert.equal(registry.receive({ token: challenge.token, trusted: false, type: "pointerdown", button: 0 }), false);
  assert.equal(registry.receive({ token: challenge.token, trusted: true, type: "pointerup", button: 0 }), false);
  assert.equal(registry.receive({ token: challenge.token, trusted: true, type: "pointerdown", button: 2 }), false);
  const receipt = challenge.wait();
  assert.equal(registry.receive({ token: challenge.token, trusted: true, type: "pointerdown", button: 0 }), true);
  assert.deepEqual(await receipt, { trusted: true, type: "pointerdown", button: 0 });
  assert.equal(registry.receive({ token: challenge.token, trusted: true, type: "pointerdown", button: 0 }), false);
  challenge.close();
});

test("M234 spatial onset fails closed if real browser pointerdown was not observed", async () => {
  const registry = createM227TrustedLightRegistry({ timeoutMs: 8 });
  const challenge = registry.issue();
  let chordFired = false;
  const gatedChord = async () => {
    await challenge.wait();
    chordFired = true;
  };
  await assert.rejects(gatedChord(), /trusted light pointerdown was not observed/);
  assert.equal(chordFired, false, "no fallback chord and no synthetic input");
  challenge.close();
});

test("M234 anchors both M144 and M145 to a trusted receipt, preserving genuine gestures and lead windows", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(entries, spatial = false)");
  const end = runner.indexOf("\nasync function ", start + 20);
  assert.ok(start >= 0 && end > start);
  const flight = runner.slice(start, end);
  assert.ok(flight.includes("const jumpInputDelayMs = spatial ? 80 : 70;"));
  assert.ok(flight.includes("sampleUiEvidenceWhileActive([observer], 1250, 8)"));
  assert.ok(flight.includes("minLeadMs = spatial ? 70 : 60"));
  assert.ok(flight.includes("maxLeadMs = spatial ? 150 : 200"));
  assert.ok(flight.includes("nearestReturnIndex <= jumpPunishIndex"));
  assert.ok(flight.includes('const lightChallenge = m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" });'));
  assert.ok(!flight.includes("spatial ? null : m227Registry.issue()"));
  assert.ok(flight.includes('m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" })'));
  const challengeAt = flight.indexOf('const lightChallenge = m227Registry.issue({ type: spatial ? "pointerdown" : "pointerup" });');
  const armAt = flight.indexOf("window.__MYASO_M227_LIGHT_TOKEN__");
  const pressAt = flight.indexOf("performArenaAttackHold(lightAttacker, lightArena, 200, 45)");
  const waitAt = flight.indexOf("await lightChallenge.wait()");
  const delayAt = flight.indexOf("await waitForM227TrustedLead(receipt, jumpInputDelayMs, {sleep})");
  const chordAt = flight.indexOf("performArenaPreAimedJumpAttackChord(jumpAttacker, 180)");
  assert.ok(challengeAt < armAt && armAt < pressAt);
  assert.ok(pressAt < waitAt && waitAt < delayAt && delayAt < chordAt);
  assert.ok(flight.includes('spatial ? "M234_TRUSTED_SPATIAL_LIGHT_ONSET " : "M227_TRUSTED_LIGHT_RELEASE "'));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60;"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200;"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightDowns[0].epochMs"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightUps[0].epochMs"));
  assert.ok(flight.includes("!Number.isFinite(lightUps[0]?.epochMs)"));
  assert.ok(flight.includes("const jumpInputDelayMs = spatial ? 80 : 70;"));
  assert.ok(runner.includes("event.isTrusted === true && event.button === 0"));
  assert.ok(runner.includes("m227Registry.receive(packet)"));
});

test("M234 retains strict M145 pixel/HUD and authoritative lifecycle, unchanged by light input staging", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(entries, spatial = false)");
  const end = runner.indexOf("\nasync function ", start + 20);
  const flight = runner.slice(start, end);
  assert.ok(flight.includes("if (spatial) await armRecoveryHandoffSampler(observer)"));
  assert.ok(flight.includes("if (spatial) spatialSamples = await stopRecoveryHandoffSampler(observer)"));
  assert.ok(flight.includes("lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex"));
  assert.ok(flight.includes("summarizeM232SpatialHandoffFailure(spatialSamples, { lightId, jumpId })"));
  assert.ok(flight.includes("summarizeM233RecoveryHandoff(observerState.acceptance?.m233RecoveryHandoff"));
  assert.ok(flight.includes('evidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)'));
  assert.ok(flight.includes("M211_SERVER_DUAL_RECOVERY_PHASES"));
  assert.ok(flight.includes("spatialSamples.findIndex"));
});
