import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M33 and M146 perform complete genuine short LMB before parry, never charging heavy", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiParryFlight(");
  const end = source.indexOf("\nasync function runOnlineUiParryPunishFfaFocusFlight(", start + 20);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  const tap = flight.indexOf("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 75)");
  const lead = flight.indexOf("await sleep(55)", tap);
  const wheel = flight.indexOf("await setArenaBlock(defender, defenderElementId, true)", lead);
  const proof = flight.indexOf("await waitForUiParryEvidence(entries, attacker, defender, 350, false, lastAttemptBaseline)", wheel);
  assert.ok(tap >= 0 && lead > tap && wheel > lead && proof > wheel);
  assert.ok(!flight.includes("await setArenaAttack(attacker, attackerElementId, true, attackOffset)"));
  assert.ok(flight.includes('entry.startsWith("Heavy strike committed")'));
  assert.ok(flight.includes("if (!pristine)"));
  assert.ok(flight.includes("stagedAttacker?.playerHp === attackerBefore?.playerHp"));
  assert.ok(flight.includes("stagedDefender?.playerGuard === defenderBefore?.playerGuard"));
  assert.ok(flight.includes('if (!evidence) evidence = await waitForUiParryEvidence(entries, attacker, defender, 800, true, lastAttemptBaseline)'));
});
test("M146 retains exact genuine late punish and authoritative stun/combat gates", () => {
  const src = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const s = src.slice(src.indexOf("async function runOnlineUiParryPunishWindowFlight("),
    src.indexOf("\nasync function runOnlineUiParryTellFlight("));
  assert.ok(s.includes('await runOnlineUiParryFlight(entries, 0, {'));
  assert.ok(s.includes("COMBAT.block.parryStunMs !== 650"));
  assert.ok(s.includes("targetInputEpochMs = stunTransition.epochMs + 370"));
  assert.ok(s.includes("performArenaAttackHold(defender, defenderElementId, punishOffset, 90)"));
  assert.ok(s.includes("punishDelayMs < 340 || punishDelayMs > 470"));
  assert.ok(s.includes("COMBAT.attack.damage"));
  assert.ok(s.includes('defenderState.events.includes("Opponent hit - 34 HP.")'));
  assert.ok(s.includes('attackerState.events.includes("Hit taken - 34 HP.")'));
});
