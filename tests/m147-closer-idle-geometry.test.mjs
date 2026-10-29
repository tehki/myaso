import test from "node:test";
import assert from "node:assert/strict";
import {planM147CloserIdleGeometry} from "../scripts/m147-closer-idle-geometry.mjs";
import {fighterFocusNetId} from "../src/browser/combat-readability.mjs";
const victim={netId:2,x:138,y:42,action:0};
const punisher={netId:1,x:64,y:42,action:0};
const closer={netId:3,x:210,y:42,action:0};
test("retained M14772/74px near-tie requires physical staging before HUD acceptance",()=>{
  const plan=planM147CloserIdleGeometry(victim,punisher,closer);
  assert.equal(plan.key,"a");assert.equal(plan.durationMs,94);
  assert.equal(closer.x,210,"planner never changes original replicas");
  const staged={...closer,x:190};
  assert.equal(planM147CloserIdleGeometry(victim,punisher,staged),null);
  assert.equal(fighterFocusNetId(new Map([victim,punisher,staged].map(f=>[f.netId,f])),2),3);
});
test("missing, nonidle, duplicate and crossed actors cannot qualify closer staging",()=>{
  for(const args of [[null,punisher,closer],[victim,{...punisher,action:1},closer],
    [victim,punisher,{...closer,netId:1}],[victim,punisher,{...closer,x:100}]])
    assert.throws(()=>planM147CloserIdleGeometry(...args));
});
