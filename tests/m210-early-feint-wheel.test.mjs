import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url),"utf8");
const start=runner.indexOf("async function performArenaFeint(");
const end=runner.indexOf("async function ",start+30);
const gesture=runner.slice(start,end);
const flight=runner.slice(runner.indexOf("async function runOnlineUiFeintFlight("),
  runner.indexOf("async function ",runner.indexOf("async function runOnlineUiFeintFlight(")+30));
function extractActions(id){
 const a=gesture.indexOf('id: `'+id+'-${session.name}`');
 const b=gesture.indexOf("actions: [",a);
 const end=gesture.indexOf("]",b);
 return gesture.slice(b,end+1);
}
test("M210 keeps one genuine W3C LMB down and up, held for 90ms",()=>{
 const pointer=extractActions("mouse");
 assert.equal((pointer.match(/type: "pointerDown"/g)||[]).length,1);
 assert.equal((pointer.match(/type: "pointerUp"/g)||[]).length,1);
 assert.ok(pointer.indexOf("pointerDown")<pointer.indexOf("pointerUp"));
 assert.match(pointer,/duration: 5/);
 assert.match(pointer,/duration: 85/);
 assert.ok(pointer.indexOf("duration: 5")<pointer.indexOf("duration: 85"));
 assert.ok(!pointer.includes("duration: 20"));
});
test("M210 real wheel-back is in next W3C tick, not same tick as LMB-down",()=>{
 const wheel=extractActions("wheel");
 assert.equal((wheel.match(/type: "scroll"/g)||[]).length,1);
 assert.ok(wheel.indexOf("duration: 5") < wheel.indexOf('type: "scroll"'));
 assert.ok(wheel.indexOf('type: "scroll"') < wheel.indexOf("duration: 85"));
 assert.match(wheel,/deltaY: 120/);
});
test("M210 preserves unchanged 70ms feint, strict 100HP and one observed recovery",()=>{
 assert.ok(flight.includes("await performArenaFeint(attacker, attackerElementId, attackOffset)"));
 assert.ok(flight.includes("await performArenaFeint(attacker, attackerElementId, awayOffset)"));
 assert.ok(flight.includes("attackerResult.opponentHp !== 100"));
 assert.ok(flight.includes("defenderResult.playerHp !== 100"));
 assert.ok(flight.includes('state === "feint-recovery"'));
 assert.ok(flight.includes('feedbackTransitions.includes("damage-taken")'));
 assert.ok(flight.includes("COMBAT.feint.staminaCost"));
 assert.ok(flight.includes("exhaustedLightDown"));
 assert.ok(flight.includes("exhaustedWheelBack"));
 assert.ok(flight.includes("Math.abs(exhaustedWheelBack.epochMs - exhaustedLightDown.epochMs) > 80"));
});
