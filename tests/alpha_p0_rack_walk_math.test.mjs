import test from "node:test";
import assert from "node:assert/strict";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS,WORLD_ALPHA_SPAWN_COORDINATES,
  validateWorldAlphaArmoryLayout} from "../src/world/alpha-armory.mjs";
import {nextNativeWalkPulse,nativeRackArrived} from "../scripts/alpha_p0_rack_walk_math.mjs";

test("four canonical World socket approaches are fixed, distinct and legitimate",()=>{
 assert.equal(validateWorldAlphaArmoryLayout(),true);
 assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>[s.socketId,s.approach.x,s.approach.y]),[
  ["greyhaven-rack-1",3740,4088],["greyhaven-rack-2",3780,4088],
  ["greyhaven-rack-3",3820,4088],["greyhaven-rack-4",3860,4088]
 ]);
 assert.deepEqual(WORLD_ALPHA_SPAWN_COORDINATES.map(p=>[p.x,p.y]),[
  [4110,4160],[4206,4160],[4110,4256],[4206,4256]
 ]);
});
test("real W3C movement pulse planner heads from each distinct spawn toward real socket",()=>{
 for(let i=0;i<4;i++){
  const from=WORLD_ALPHA_SPAWN_COORDINATES[i];
  const to=WORLD_ALPHA_SWORD_RACK_SOCKETS[i].approach;
  const x=nextNativeWalkPulse(from.x,to.x),y=nextNativeWalkPulse(from.y,to.y);
  assert.equal(x.key,"negative");
  assert.equal(y.key,"negative");
  assert(x.holdMs>=75&&x.holdMs<=550);
  assert(y.holdMs>=75&&y.holdMs<=550);
  assert.equal(x.done,false);assert.equal(y.done,false);
 }
});
test("planner bounds real press duration and does not claim arrival for distant actors",()=>{
 assert.deepEqual(nextNativeWalkPulse(1000,1000),{done:true,key:null,holdMs:0,distance:0});
 assert.equal(nextNativeWalkPulse(0,10000).holdMs,550);
 assert.equal(nextNativeWalkPulse(0,15).holdMs,75);
 assert.equal(nextNativeWalkPulse(100,140).key,"positive");
 assert.equal(nativeRackArrived({x:100,y:100},{x:100,y:100}),true);
 assert.equal(nativeRackArrived({x:100,y:100},{x:125,y:100}),false);
 assert.equal(nativeRackArrived({x:100,y:100},{x:112,y:112}),true);
 assert.equal(nativeRackArrived({x:100,y:100},{x:115,y:115}),false);
});
test("nonfinite, malformed or excessive tolerance cannot substitute for server position",()=>{
 for(const val of [NaN,Infinity,-Infinity])assert.throws(()=>nextNativeWalkPulse(val,0));
 assert.equal(nativeRackArrived({x:NaN,y:3},{x:0,y:3}),false);
 assert.equal(nativeRackArrived(null,{x:0,y:3}),false);
 assert.equal(nativeRackArrived({x:0,y:0},{x:50,y:50},1000),false);
});
