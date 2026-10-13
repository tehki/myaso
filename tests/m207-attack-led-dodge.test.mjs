import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchM207AttackLedDodge } from "../scripts/m207-attack-led-dodge.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a,b)=>{resolve=a;reject=b;});
  return {resolve,reject,promise};
};
test("M207 fast genuine Firefox LMB ACK schedules exactly one Chrome wheel",async()=>{
  const calls=[];let time=0;
  const result=await dispatchM207AttackLedDodge({
    now:()=>time,sleep:()=>new Promise(()=>{}),
    sendAttackDown:()=>{calls.push("attack");time=18;},
    sendDodgeWheel:()=>{calls.push("wheel");},
  });
  assert.deepEqual(calls,["attack","wheel"]);
  assert.equal(result.attackAckBeforeDodge,true);
  assert.equal(result.attackAckMs,18);
});
test("M207 slow Firefox ACK cannot indefinitely delay first genuine Chrome dodge",async()=>{
  const ack=deferred();const events=[];let time=0;
  const flight=dispatchM207AttackLedDodge({
    now:()=>time,
    sleep:()=>{time=35;return Promise.resolve();},
    sendAttackDown:()=>{events.push("attack-start");return ack.promise;},
    sendDodgeWheel:()=>{events.push("wheel");},
  });
  await new Promise(setImmediate);
  assert.deepEqual(events,["attack-start","wheel"]);
  time=170;ack.resolve();
  const result=await flight;
  assert.equal(result.attackAckBeforeDodge,false);
  assert.equal(result.wheelDispatchedAtMs,35);
  assert.equal(result.attackAckMs,170);
});
test("M207 refuses any Firefox failure before its wheel is dispatched",async()=>{
  let wheels=0;
  await assert.rejects(()=>dispatchM207AttackLedDodge({
    sendAttackDown:()=>Promise.reject(new Error("Firefox real pointer failed")),
    sendDodgeWheel:()=>{wheels++;},
    sleep:()=>new Promise(()=>{}),
  }),/Firefox real pointer failed/);
  assert.equal(wheels,0);
});
test("M207 refuses failure of a delayed Firefox ACK after one genuine wheel",async()=>{
  const ack=deferred();let wheels=0;
  const flight=dispatchM207AttackLedDodge({
    sendAttackDown:()=>ack.promise,
    sendDodgeWheel:()=>{wheels++;},
    sleep:()=>Promise.resolve(),
  });
  await new Promise(setImmediate);
  assert.equal(wheels,1);
  ack.reject(new Error("late Firefox W3C failure"));
  await assert.rejects(flight,/late Firefox W3C failure/);
});
test("M207 rejects invalid wait and silent non-W3C callbacks",async()=>{
  for(const wait of [-1,126,NaN,Infinity]){
    await assert.rejects(()=>dispatchM207AttackLedDodge({
      sendAttackDown:()=>{},sendDodgeWheel:()=>{},sleep:()=>{},
      maxAttackAckWaitMs:wait,
    }),RangeError);
  }
});
test("M207 remains actual Firefox LMB+Chrome wheel with strict clean HP and no-parry assertions",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=source.slice(source.indexOf("async function runOnlineUiDodgeFeedbackFlight("),
    source.indexOf("async function runOnlineUiDodgeTellFlight("));
  assert.ok(section.includes("dispatchM207AttackLedDodge({"));
  assert.ok(section.includes("sendAttackDown: () => setArenaAttack(attacker, attackerElementId, true, attackOffset)"));
  assert.ok(section.includes("sendDodgeWheel: () => scrollArenaWheel(defender, defenderElementId, -120)"));
  assert.ok(section.includes("await setArenaAttack(attacker, attackerElementId, false, attackOffset)"));
  assert.ok(section.includes('await setMovementKey(defender, "s", false)'));
  assert.ok(section.includes("defenderResult.playerHp !== 100"));
  assert.ok(section.includes('feedbackTransitions.includes("parried")'));
  assert.ok(section.includes('rollWheel = defenderResult.wheels.find((event) => event.deltaY < 0)'));
});
