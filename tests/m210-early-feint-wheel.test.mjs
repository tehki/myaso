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
test("R1 preserves one genuine short W3C LMB held for 20ms then released",()=>{
 const pointer=extractActions("mouse");
 assert.equal((pointer.match(/type: "pointerDown"/g)||[]).length,1);
 assert.equal((pointer.match(/type: "pointerUp"/g)||[]).length,1);
 assert.ok(pointer.indexOf("pointerDown")<pointer.indexOf("pointerUp"));
 assert.match(pointer,/duration: 20/);
 assert.match(pointer,/duration: 0/);
 assert.ok(pointer.indexOf("duration: 20")<pointer.indexOf("pointerUp"));
 assert.match(pointer,/pointerUp", button: 0 },?\s*\]$/);
});
test("M324 wheel-back shares the W3C tick with LMB release",()=>{
 const wheel=extractActions("wheel");
 assert.equal((wheel.match(/type: "scroll"/g)||[]).length,1);
 assert.ok(wheel.indexOf("duration: 20") < wheel.indexOf('type: "scroll"'));
 assert.ok(!wheel.includes("duration: 85"));
 assert.match(wheel, /duration: 20 },\s*{ type: "scroll"/);
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
 assert.ok(flight.includes("exhaustedWheelBack.epochMs - exhaustedLightUp.epochMs > 80"));
 assert.ok(flight.includes("exhaustedWheelBack.epochMs < exhaustedLightUp.epochMs"));
});
