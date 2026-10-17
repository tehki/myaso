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
 const wait=flight.indexOf("await sleep(35)",downup);
 const wheel=flight.indexOf("await scrollArenaWheel(defender, defenderElementId, -120)",wait);
 const evidence=flight.indexOf("waitForUiDodgeEvidence(entries, attacker, defender, 520, false, lastAttemptBaseline)",wheel);
 assert.ok(downup>=0 && wait>downup && wheel>wait && evidence>wheel);
 assert.ok(flight.includes("attackUp.epochMs - attackDown.epochMs >= 320"));
 assert.ok(flight.includes("rollWheel.epochMs <= attackUp.epochMs"));
 assert.ok(flight.includes("rollWheel.epochMs - attackUp.epochMs >= COMBAT.attack.windupMs"));
 assert.ok(flight.includes("defenderResult.playerHp !== 100"));
 assert.ok(flight.includes("defenderResult.playerGuard !== 100"));
 assert.ok(flight.includes("attackerResult.playerHp !== 100"));
 assert.ok(flight.includes('attackerResult.feedbackTransitions.includes("parried")'));
 assert.ok(!flight.includes("dispatchEvent("));
});
