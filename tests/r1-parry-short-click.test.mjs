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
  const lead = flight.indexOf("if (parryIngress.wheelLeadMs > 0) await sleep(parryIngress.wheelLeadMs)", tap);
  const releaseDelay = flight.indexOf("await sleep(releaseToStrikeParryDelayMs)", lead);
  const wheel = flight.indexOf("await setArenaBlock(defender, defenderElementId, true)", releaseDelay);
  const proof = flight.indexOf("await waitForUiParryEvidence(entries, attacker, defender, 350, false, lastAttemptBaseline)", wheel);
  assert.ok(dispatch >= 0 && tap > dispatch && lead > tap && releaseDelay > lead && wheel > releaseDelay && proof > wheel);
  assert.match(flight, /const releaseToStrikeParryDelayMs = scenario === "uiparrytell" \? 35 : 95/);
  assert.match(flight, /Any actual -38 guard block or 34 HP hit remains a terminal failure/);
  assert.ok(flight.includes("const parryIngress = await calibrateNativeParryIngress("));
  // Preserve genuine input and fail-closed outcomes; only staged native
  // dispatch moves later. The server's 125ms parry window is unchanged.
  assert.match(source.slice(source.indexOf("async function calibrateNativeParryIngress("), start),
    /targetAfterPointerDownMs = 50/);
  assert.match(source.slice(source.indexOf("async function calibrateNativeParryIngress("), start),
    /targetAfterPointerDownMs > 85/);
  assert.ok(flight.includes("await Promise.all(entries.map(installUiObserver));"));
  assert.ok(flight.includes("if (parryIngress.attackLeadMs > 0) await sleep(parryIngress.attackLeadMs)"));
  assert.ok(!flight.includes('defender.name !== "firefox"'));
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

test("M33 records trusted native wheel and pointer latency without synthetic inputs or altered combat rules", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const a = source.indexOf("async function calibrateNativeParryIngress(");
  const b = source.indexOf("async function runOnlineUiParryFlight(", a);
  const calibration = source.slice(a, b);
  assert.ok(a > 0 && b > a);
  assert.match(calibration, /event.isTrusted/);
  assert.match(calibration, /pointermove/);
  assert.match(calibration, /scrollArenaWheel\(defender, defenderElementId, 120, 0\)/);
  assert.match(calibration, /COMBAT.block.shortBlockMs \+ 130/);
  assert.match(calibration, /pointerSamples/);
  assert.match(calibration, /wheelSamples/);
  assert.match(calibration, /attackLeadMs: Math.max\(0, -skewMs\)/);
  assert.match(calibration, /wheelLeadMs: Math.max\(0, skewMs\)/);
  assert.ok(!calibration.includes("dispatchEvent("));
  assert.ok(!calibration.includes("new WheelEvent("));
});
