import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M144 retains exact real 60..200ms light-release lead gate with earlier trusted onset", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
  const end = source.indexOf("\nasync function ", start + 20);
  assert.ok(start > 0 && end > start);
  const flight = source.slice(start, end);
  assert.ok(flight.includes("const jumpInputDelayMs = spatial ? 100 : 155;"));
  assert.ok(flight.includes("await lightChallenge.wait()"));
  assert.ok(flight.includes("await sleep(jumpInputDelayMs)"));
  assert.ok(flight.includes("performArenaAttackHold(lightAttacker, lightArena, 200, 90)"));
  assert.ok(flight.includes("performArenaJumpAttackChord(jumpAttacker, jumpArena, -200, 90)"));
  assert.ok(flight.includes("jumpAttackDowns[0].epochMs - lightUps[0].epochMs"));
  assert.ok(flight.includes("const minLeadMs = spatial ? 70 : 60;"));
  assert.ok(flight.includes("const maxLeadMs = spatial ? 150 : 200;"));
  assert.ok(flight.includes("inputLeadMs < minLeadMs || inputLeadMs > maxLeadMs"));
  assert.ok(flight.includes("lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex || nearestReturnIndex <= jumpPunishIndex"));
  assert.ok(flight.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"));
  assert.ok(flight.includes("sampleUiEvidenceWhileActive(entries, spatial ? 760 : 1250, 8)"));
  assert.ok(flight.includes("evidence.some((entry) => entry.playerHp !== 100 || entry.playerGuard !== 100)"));
});
