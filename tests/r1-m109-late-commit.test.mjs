import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M109 late release-to-light commit is recognized before a clean retry, without weakening authoritative result", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("async function runOnlineUiHeavyWhiffPunishFlight(");
  const end = source.indexOf("\nasync function runOnlineUiDodgeFeedbackFlight(", start + 20);
  assert.ok(start >= 0 && end > start);
  const flight = source.slice(start, end);
  const genuineGesture = flight.indexOf("if (!down || !up || up.t <= down.t)");
  const late = flight.indexOf("const lateCommitted = lightCommitCount(missDefender) > commitsBefore");
  const remote = flight.indexOf("lightThreatCount(missAttacker) > threatsBefore", late);
  const commit = flight.indexOf("successfulPunishPointerOffset = pointerOffset;\n        punishCommitted = true;\n        break;", late);
  const clean = flight.indexOf("const cleanLatchMiss = ", late);
  assert.ok(genuineGesture >= 0 && genuineGesture < late);
  assert.ok(remote > late && remote < commit);
  assert.ok(commit > remote && commit < clean);
  assert.ok(flight.includes("if (!cleanLatchMiss)"));
  assert.ok(flight.includes('if (!punishCommitted) {'));
  assert.ok(flight.includes("if (attackerResult.playerHp !== 66 || attackerResult.playerGuard !== 100"));
  assert.ok(flight.includes("defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100"));
  assert.ok(flight.includes('defenderResult.events.includes("Opponent hit - 34 HP.")'));
  assert.ok(flight.includes('attackerResult.events.includes("Hit taken - 34 HP.")'));
  assert.ok(flight.includes('defenderResult.feedbackTransitions.includes("hit-confirm")'));
  assert.ok(flight.includes('attackerResult.feedbackTransitions.includes("damage-taken")'));
});
