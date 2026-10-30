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
  assert.ok(flight.includes("await waitForM227TrustedLead(receipt, jumpInputDelayMs, {sleep})"));
  // Real UI light click must not cross the 80ms heavy upgrade timer.
  const genuineLightClickMs = 45;
  assert.ok(genuineLightClickMs < LEFT_HEAVY_CHARGE_MS);
  assert.ok(flight.includes(`performArenaAttackHold(lightAttacker, lightArena, 200, ${genuineLightClickMs})`));
  assert.ok(flight.includes("performArenaPreAimedJumpAttackChord(jumpAttacker, 180)"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightUps[0].epochMs"));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60;"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200;"));
  assert.ok(flight.includes("inputLeadMs < minLeadMs || inputLeadMs > maxLeadMs"));
  assert.ok(flight.includes("lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex"));
  assert.ok(flight.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"));
  assert.ok(flight.includes("sampleUiEvidenceWhileActive([observer], 1250, 8)"));
  assert.ok(flight.includes("performArenaPreAimedJumpAttackChord(jumpAttacker, 180)"),
    "M144 must preserve genuine 180ms W3C chord for original 30Hz sampling");
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
