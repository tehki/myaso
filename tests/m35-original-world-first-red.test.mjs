import test from "node:test";
import assert from "node:assert/strict";
import { inspectM35ParryFirstRed, verifyM35OriginalLightParry } from "../scripts/m35-original-world-first-red.mjs";
const red=[
 "M201_AUTH_ACTION tick=264 fighter=1 from=9 to=1",
 "M201_AUTH_ACTION tick=265 fighter=2 from=0 to=6",
 "M201_AUTH_BLOCK tick=272 attacker=1 target=2",
 "CORE8C_WORLD_CONTACT tick=272 world=1 outcome=BLOCK attacker=1 target=2 attackerLife=1 targetLife=2 defenderAction=6 defenderActionElapsedMs=133.3 defenderHp=100.0 defenderGuard=62.0",
].join("\n");
const source0=[{clientTick:116,epochMs:1793130236158,block:true,
 source:"physical-wheel-original-v1",
 m41PhysicalInput:{wheel:{trusted:true,callbackStartEpochMs:1793130236158},
 originalV1SendInvocationEpochMs:1793130236158}}];

test("charging observation cannot qualify native M35 without actual current-attempt original Light and PARRY125",()=>{
 const worldLog=red.replace("outcome=BLOCK","outcome=PARRY")
   .replace("defenderActionElapsedMs=133.3","defenderActionElapsedMs=66.7")
   .replace("defenderGuard=62.0","defenderGuard=100.0");
 const options={worldLog,attackerId:1,defenderId:2,inputSubmissions:source0};
 assert.equal(verifyM35OriginalLightParry(options).originalLightWindupTick,264);
 assert.throws(()=>verifyM35OriginalLightParry({...options,worldLog:red}),/LightWindup then PARRY125/);
 assert.throws(()=>verifyM35OriginalLightParry({...options,worldLog:worldLog.replace("to=1\n","to=9\n")}),/LightWindup/);
 assert.throws(()=>verifyM35OriginalLightParry({...options,worldLog:worldLog.replace("to=1\n","to=10\n")}),/Heavy substitute/);
});
test("real original M35 first-red Block133.3 is not a Parry",()=>{
 const r=inspectM35ParryFirstRed({worldLog:red,attackerId:1,defenderId:2,inputSubmissions:source0});
 assert.equal(r.verdict,"WORLD_EARLY_BLOCK_OUTSIDE_PARRY");
 assert.equal(r.parryWindowMs,125);assert.equal(r.blockMs,240);
 assert.equal(r.contact.tick,272);assert.equal(r.contact.hp,100);assert.equal(r.contact.guard,62);
 assert.equal(r.defenderBlockBeforeContact.tick,265);
 assert.equal(r.trustedSource0.clientTick,116);
 assert.equal(r.trustedSource0.wheelCallbackEpochMs,1793130236158);
});
test("World parry can only be declared from original PARRY contact in 125ms",()=>{
 const good=red.replace("outcome=BLOCK","outcome=PARRY")
  .replace("defenderActionElapsedMs=133.3","defenderActionElapsedMs=66.7")
  .replace("defenderGuard=62.0","defenderGuard=100.0");
 const r=inspectM35ParryFirstRed({worldLog:good,attackerId:1,defenderId:2});
 assert.equal(r.verdict,"WORLD_PARRY");assert.equal(r.trustedSource0,null);
});
test("late HIT before defender admission never becomes Parry",()=>{
 const l="CORE8C_WORLD_CONTACT tick=100 world=1 outcome=HIT attacker=1 target=2 defenderActionElapsedMs=0.0 defenderHp=66.0 defenderGuard=100.0\nM201_AUTH_ACTION tick=102 fighter=2 from=0 to=6";
 const r=inspectM35ParryFirstRed({worldLog:l,attackerId:1,defenderId:2});
 assert.equal(r.verdict,"WORLD_HIT_BEFORE_BLOCK");
 assert.equal(r.defenderBlockBeforeContact,null);
 assert.equal(r.defenderBlockAfterContact.tick,102);
});
test("stale actor and log without original World contact fail closed",()=>{
 assert.equal(inspectM35ParryFirstRed({worldLog:red,attackerId:2,defenderId:1}).verdict,"UNPROVEN");
 assert.equal(inspectM35ParryFirstRed({worldLog:"M201_AUTH_PARRY tick=8",attackerId:1,defenderId:2}).verdict,"UNPROVEN");
 assert.throws(()=>inspectM35ParryFirstRed({worldLog:red,attackerId:1,defenderId:1}),/distinct/);
});
