import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("M238 M36 waits for real short pointerUP before perpendicular wheel, without moving combat rules", () => {
 const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const a=src.indexOf("async function runOnlineUiDodgeFeedbackFlight(");
 const b=src.indexOf("\nasync function ",a+20);
 const flight=src.slice(a,b);
 assert.ok(a>=0 && b>a);
 const downup=flight.indexOf("await performArenaAttackHold(attacker, attackerElementId, attackOffset, 65)");
 const wheel=flight.indexOf("await scrollArenaWheel(defender, defenderElementId, -120)",downup);
 const evidence=flight.indexOf("waitForUiDodgeEvidence(entries, attacker, defender, 520, false, lastAttemptBaseline)",wheel);
 assert.ok(downup>=0 && wheel>downup && evidence>wheel);
 assert.ok(!flight.slice(downup,wheel).includes("await sleep("));
 assert.ok(flight.includes("attackUp.epochMs - attackDown.epochMs >= 320"));
 assert.ok(flight.includes("rollWheel.epochMs <= attackUp.epochMs"));
 assert.ok(flight.includes("rollWheel.epochMs - attackUp.epochMs >= COMBAT.attack.windupMs"));
 assert.ok(flight.includes("defenderResult.playerHp !== 100"));
 assert.ok(flight.includes("defenderResult.playerGuard !== 100"));
 assert.ok(flight.includes("attackerResult.playerHp !== 100"));
 assert.ok(flight.includes('attackerResult.feedbackTransitions.includes("parried")'));
 assert.ok(!flight.includes("dispatchEvent("));
});

test("M239 M36 records authentic cross-browser epoch timestamps, never invents them", () => {
  const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const a=src.indexOf("async function installUiObserver(");
  const b=src.indexOf("\nasync function ",a+30);
  assert.ok(a>=0 && b>a);
  const observer=src.slice(a,b);
  assert.match(observer, /const epochEvidence = \[[^\]]*[\'"]uidodge[\'"][^\]]*\]\.includes\(new URLSearchParams\(location\.search\)\.get\(\'scenario\'\)\)/);
  assert.ok(observer.includes("if (epochEvidence) entry.epochMs = Date.now();"));
  assert.ok(observer.includes("state.pointers.push(entry);"));
  assert.ok(observer.includes("state.wheels.push(entry);"));
  const flight=src.slice(src.indexOf("async function runOnlineUiDodgeFeedbackFlight("),
    src.indexOf("\nasync function ",src.indexOf("async function runOnlineUiDodgeFeedbackFlight(")+25));
  assert.ok(flight.includes("Number.isFinite(attackDown?.epochMs)"));
  assert.ok(flight.includes("Number.isFinite(attackUp?.epochMs)"));
  assert.ok(flight.includes("Number.isFinite(rollWheel.epochMs)"));
  assert.ok(flight.includes("rollWheel.epochMs - attackUp.epochMs >= COMBAT.attack.windupMs"));
  assert.ok(flight.includes("waitForUiDodgeEvidence(entries, attacker, defender, 520, false, lastAttemptBaseline)"));
  assert.ok(flight.includes("attackerResult.playerHp !== 100 || attackerResult.playerGuard !== 100"));
  assert.ok(flight.includes("defenderResult.playerHp !== 100 || defenderResult.playerGuard !== 100"));
});
