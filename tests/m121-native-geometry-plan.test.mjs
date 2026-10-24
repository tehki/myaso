import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT } from "../src/combat/model.mjs";
import { planM121NativeGeometry } from "../scripts/m121-native-geometry-plan.mjs";

const fighter = (netId,x,y=0) => ({netId,x,y,action:0});

test("M121 94.15px real-failure distance requires actual native approach, never qualifies by duration",()=>{
  const own=fighter(1,0),target=fighter(2,94.15);
  assert.ok(Math.hypot(target.x-own.x,target.y-own.y)>COMBAT.attack.reach+COMBAT.fighterRadius);
  const plan=planM121NativeGeometry(own,target,true);
  assert.deepEqual(plan,{key:"d",axis:"x",durationMs:104});
  assert.deepEqual(planM121NativeGeometry(own,target,true),plan,"unmoved replicas must still require movement after a command");
  assert.equal(own.x,0);assert.equal(target.x,94.15);
});

test("M121 stable interior position preserves unchanged reach even after later lateral20px",()=>{
  for(const direction of [-1,1]){
    const own=fighter(1,100),target=fighter(2,100+direction*72,3);
    assert.equal(planM121NativeGeometry(own,target,direction===1),null);
    assert.ok(Math.hypot(72,23)<COMBAT.attack.reach+COMBAT.fighterRadius-10);
  }
  assert.equal(COMBAT.attack.reach,76);assert.equal(COMBAT.fighterRadius,18);
});

test("M121 corrects lateral geometry first and genuinely retreats from compressed pairs",()=>{
  assert.equal(planM121NativeGeometry(fighter(1,0),fighter(2,94,-12),true).key,"w");
  assert.equal(planM121NativeGeometry(fighter(1,100),fighter(2,6,12),false).key,"s");
  assert.equal(planM121NativeGeometry(fighter(1,0),fighter(2,45),true).key,"a");
  assert.equal(planM121NativeGeometry(fighter(1,100),fighter(2,55),false).key,"d");
  assert.ok(planM121NativeGeometry(fighter(1,0),fighter(2,350),true).durationMs<=180);
});

test("M121 missing, busy, crossed or invalid replicas fail before native staging",()=>{
  for(const [own,target,right] of [
    [null,fighter(2,72),true],
    [fighter(1,0),fighter(1,72),true],
    [{...fighter(1,0),action:4},fighter(2,72),true],
    [fighter(1,0),{...fighter(2,72),x:NaN},true],
    [fighter(1,0),fighter(2,-72),true],
    [fighter(1,0),fighter(2,401),true],
    [fighter(1,0),fighter(2,72),"right"],
  ])assert.throws(()=>planM121NativeGeometry(own,target,right),/M121/);
});
