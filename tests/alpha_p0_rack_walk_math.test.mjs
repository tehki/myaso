import test from "node:test";
import assert from "node:assert/strict";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS,WORLD_ALPHA_SPAWN_COORDINATES,
  validateWorldAlphaArmoryLayout} from "../src/world/alpha-armory.mjs";
import {nextNativeWalkPulse,nativeRackArrived,proposedNativeRackReachPoint,nativeRackWithinProposedReach,verifyNativeRackPeerConsensus} from "../scripts/alpha_p0_rack_walk_math.mjs";
import {WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS} from "../src/world/alpha-solid-geometry.mjs";

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

test("west-first southern courtyard legs avoid EVERY real server-reviewed static AABB",()=>{
 // Exact segment-vs-inflated-AABB test (radius 18 from source server simulation).
 const radius=18,solids=WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS;
 const hit=(a,b,s)=>{
  let lo=0,hi=1;
  for(const [axis,min,max] of [
   ["x",s.min_x-radius,s.max_x+radius],
   ["y",s.min_y-radius,s.max_y+radius]
  ]){
   const d=b[axis]-a[axis];
   if(d===0){if(a[axis]<min||a[axis]>max)return false;continue}
   const t0=(min-a[axis])/d,t1=(max-a[axis])/d;
   lo=Math.max(lo,Math.min(t0,t1));
   hi=Math.min(hi,Math.max(t0,t1));
   if(lo>hi)return false;
  }
  return lo<=hi;
 };
 const clear=(a,b)=>solids.every(s=>!hit(a,b,s));
 for(let i=0;i<4;i++){
  const start=WORLD_ALPHA_SPAWN_COORDINATES[i];
  const finish=WORLD_ALPHA_SWORD_RACK_SOCKETS[i].approach;
  const west={x:finish.x,y:start.y};
  assert(clear(start,west),"original SOUTHERN west-first leg blocked player "+(i+1));
  assert(clear(west,finish),"original near-rack north leg blocked player "+(i+1));
 }
 const smith=solids.find(s=>s.id==="building:smith");
 assert(smith);
 // Delayed northward input near y4020 would hit Smith's eastern wall:
 // actual second native-run failure stopped at x=3914 when westward travel
 // attempted too close to the building. This is a risky path, not permission
 // to disable server collision or fake arrival.
 assert.equal(hit({x:4110,y:4020},{x:3820,y:4020},smith),true);
});

test("proposed World #639 near-sword target has margin within offline Items 56 reach",()=>{
  for(const slot of WORLD_ALPHA_SWORD_RACK_SOCKETS){
    const point=proposedNativeRackReachPoint(slot);
    assert.deepEqual(point,{x:slot.x,y:slot.y+30});
    assert(Object.isFrozen(point));
    assert.equal(nativeRackArrived(point,point),true);
    assert.equal(nativeRackWithinProposedReach(point,slot),true);
    // All possible 18-unit arrival errors around the proposed target
    // remain within 48 < 56 in the same authored coordinate frame.
    for(const theta of [0,Math.PI/4,Math.PI/2,Math.PI,1.5*Math.PI]){
      const observed={x:point.x+18*Math.cos(theta),y:point.y+18*Math.sin(theta)};
      assert.equal(nativeRackArrived(observed,point),true);
      assert.equal(nativeRackWithinProposedReach(observed,slot),true);
    }
    // A successful 18-unit ORIGINAL approach acceptance is NOT necessarily
    // within reach: 4088+12 = 4100, sword y=4038 => 62 > 56.
    assert.equal(nativeRackArrived({x:slot.x,y:4100},slot.approach),true);
    assert.equal(nativeRackWithinProposedReach({x:slot.x,y:4100},slot),false);
  }
});
test("proposed reach is offline-only, bounded, exact-socket and fail closed",()=>{
  const slot=WORLD_ALPHA_SWORD_RACK_SOCKETS[0];
  for(const invalid of [null,undefined,{x:NaN,y:4068},{x:3740,y:Infinity}])
    assert.equal(nativeRackWithinProposedReach(invalid,slot),false);
  assert.equal(nativeRackWithinProposedReach({x:slot.x,y:slot.y},slot,10000),false);
  assert.equal(nativeRackWithinProposedReach({x:slot.x,y:slot.y},null),false);
  assert.equal(nativeRackWithinProposedReach({x:slot.x,y:slot.y+57},slot),false);
  assert.throws(()=>proposedNativeRackReachPoint({...slot,approach:{x:slot.x,y:0}}));
  assert.throws(()=>proposedNativeRackReachPoint({x:NaN,y:4038}));
});

test("four actual-shape snapshot observers must agree on true Rust near-sword actors",()=>{
  // Offline synthetic NEGATIVE/contract fixtures; actual flight uses W3C only.
  const slots=WORLD_ALPHA_SWORD_RACK_SOCKETS;
  const w=slots.map((slot,i)=>({id:i+1,socketId:slot.socketId,
    proposedReach:{observedPosition:{netId:i+1,x:slot.x,y:4068},serverTick:100+i}}));
  const frame=()=>slots.map((slot,i)=>({netId:i+1,x:slot.x,y:4068}));
  const views=[1,2,3,4].map(id=>({id,tick:120+id,fighters:frame()}));
  const pass=verifyNativeRackPeerConsensus(views,w,slots);
  assert.equal(pass.realRustFighterCount,4);
  assert.equal(pass.maxPeerDrift,0);
  assert.equal(pass.itemPickupApproved,false);
  const within=structuredClone(views);
  within[3].fighters[0].x+=4;
  assert.equal(verifyNativeRackPeerConsensus(within,w,slots).maxPeerDrift,4);
  const mutations=[
    x=>{x[3].fighters[1].x+=12}, // all in nominal reach56 but 4 browser disagreement
    x=>{x[0].fighters[0].x+=10}, // still inside approach tolerance 18
    x=>{x[1].fighters[1].netId=3}, // ghost/duplicate
    x=>{x[2].fighters.push({netId:5,x:3820,y:4068})}, // unexpected fifth
    x=>{x[1].id=1}, // duplicated observer
    x=>{x[3].tick=103}, // not newer than latest native W3C arrival
    x=>{x[0].fighters[2].x=NaN}, // invalid coordinate
    x=>{x[1].fighters[0].y=4088}, // out of proposed bound
  ];
  for(const mutate of mutations){
    const bad=structuredClone(views);
    mutate(bad);
    assert.throws(()=>verifyNativeRackPeerConsensus(bad,w,slots),
      /native rack peer consensus/);
  }
  const badWitness=structuredClone(w);
  badWitness[3].proposedReach.serverTick=200;
  assert.throws(()=>verifyNativeRackPeerConsensus(views,badWitness,slots),
    /native rack peer consensus/);
  assert.throws(()=>verifyNativeRackPeerConsensus(views,w,slots.slice(1)),
    /native rack peer consensus/);
});
