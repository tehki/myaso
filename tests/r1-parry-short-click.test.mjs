import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M33 and M146 perform complete genuine short LMB before parry, never charging heavy", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = source.indexOf("async function runOnlineUiParryFlight(");
  const end = source.indexOf("\nasync function runOnlineUiParryPunishFfaFocusFlight(", start + 20);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  const dispatch = flight.indexOf("await Promise.all([");
  const tap = flight.indexOf("performArenaAttackHold(attacker, attackerElementId, attackOffset, 35)", dispatch);
  const lead = flight.indexOf("await sleep(80)", tap);
  const wheel = flight.indexOf("await setArenaBlock(defender, defenderElementId, true)", lead);
  const proof = flight.indexOf("await waitForUiParryEvidence(entries, attacker, defender, 350, false, lastAttemptBaseline)", wheel);
  assert.ok(dispatch >= 0 && tap > dispatch && lead > tap && wheel > lead && proof > wheel);
  assert.ok(!flight.slice(tap,proof).includes("await sleep(20)"));
  assert.ok(flight.slice(tap,proof).includes("})(),"));
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

test("M147/M150 FFA parry uses one complete short light before wheel, preserves target isolation", () => {
  const src = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const begin = src.indexOf("async function runOnlineUiParryPunishFfaFocusFlight(");
  const end = src.indexOf("\nasync function runOnlineUiParryPunishWindowFlight(", begin + 20);
  assert.ok(begin > 0 && end > begin);
  const flight = src.slice(begin, end);
  const light = flight.indexOf("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 75)");
  const lead = flight.indexOf("await sleep(55)", light);
  const wheel = flight.indexOf("await setArenaBlock(defender, defenderElementId, true)", lead);
  const check = flight.indexOf("await waitForUiParryEvidence(entries, attacker, defender, 520, true, staged)", wheel);
  assert.ok(light >= 0 && lead > light && wheel > lead && check > wheel);
  assert.ok(!flight.includes("await setArenaAttack(attacker, attackerElementId, true, attackOffset)"));
  assert.ok(flight.includes("attackDowns.length === 1 && attackUps.length === 1"));
  assert.ok(flight.includes("attackUp.epochMs - attackDown.epochMs < 320"));
  assert.ok(flight.includes("!attackAimValid || !authenticShortLight || !blockWheel"));
  assert.ok(flight.includes("COMBAT.block.parryStunMs !== 650"));
  assert.ok(flight.includes("targetInputEpochMs = stunTransition.epochMs + 250"));
  assert.ok(flight.includes("currentAttacker?.playerHp === 66"));
  assert.ok(flight.includes("currentDefender?.playerHp === 100"));
  assert.ok(flight.includes("currentCloser?.playerHp === 100"));
  assert.ok(flight.includes("focusLabel === `NEAREST #${closerId}`"));
  assert.ok(flight.includes('closerState.events.includes("Hit taken - 34 HP.")'));
});
