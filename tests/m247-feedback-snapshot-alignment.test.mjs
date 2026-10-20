import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
const start = source.indexOf("async function runOnlineUiJumpRecoveryFfaPunishFlight(entries)");
const end = source.indexOf("\nasync function ", start + 1);
const flight = source.slice(start, end);

test("M247 reads genuine delayed attacker feedback after victim damage without a second attack", () => {
  assert.ok(start >= 0 && end > start);
  const hit = flight.indexOf("if (!hitEvidence) {");
  const settle = flight.indexOf("const settleDeadline = Date.now() + 700");
  const delivery = flight.indexOf("const feedbackDeliveryDeadline = Date.now() + 240");
  const finalVitals = flight.indexOf("final vitals did not prove exactly one 34-damage hit");
  assert.ok(hit > 0 && settle > hit && delivery > settle && finalVitals > delivery);
  const observation = flight.slice(delivery, finalVitals);
  assert.ok(observation.includes("await Promise.all(entries.map(readUiEvidence))"));
  assert.ok(observation.includes('events.includes("Opponent hit - 34 HP.")'));
  assert.ok(observation.includes("currentJump.playerHp !== 66"));
  assert.ok(observation.includes("currentObserver.playerHp !== 100"));
  assert.ok(observation.includes("currentCloser.playerHp !== 100"));
  assert.equal((flight.match(/performArenaAttackHold\(observer,/g) ?? []).length, 1);
});

test("M247 preserves strict real-input recovery deadline and hit/collateral proof", () => {
  assert.ok(flight.includes("punishDown.epochMs < recovery.epochMs"));
  assert.ok(flight.includes("punishDown.epochMs >= idle.epochMs"));
  assert.ok(flight.includes("punishDown.epochMs - recoveryCue.epochMs > 190"));
  assert.ok(flight.includes('!jumpState.events.includes("Hit taken - 34 HP.")'));
  assert.ok(flight.includes('!observerState.events.includes("Opponent hit - 34 HP.")'));
  assert.ok(flight.includes('closerState.events.includes("Hit taken - 34 HP.")'));
  assert.ok(flight.includes('observerState.focusLabel !== `NEAREST #${closerId}`'));
});
