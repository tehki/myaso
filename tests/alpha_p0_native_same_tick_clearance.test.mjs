import test from "node:test";
import assert from "node:assert/strict";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS as slots}
  from "../src/world/alpha-armory.mjs";
import {assessNativeSameTickRackClearance}
  from "../scripts/alpha_p0_native_same_tick_clearance.mjs";

function snapshots(ids=[1,2,3,4]){
  const coordinates=new Map([[1,3740],[2,3780],[3,3820],[4,3860],[5,3780]]);
  return ids.map((id,index)=>({
    id,tick:901+index,
    fighters:ids.map(netId=>({netId,x:coordinates.get(netId),y:4068})),
    scoreboard:ids.map(netId=>"#"+netId+" 0"),
  }));
}
test("one genuine-shape Rust frame contains four separate radius18 players",()=>{
  for(const phase of ["initial","after-replacement"]){
    const ids=phase==="initial"?[1,2,3,4]:[1,3,4,5];
    const evidence=assessNativeSameTickRackClearance(snapshots(ids),slots,phase);
    assert.equal(evidence.ok,true);
    assert.equal(evidence.pairs.length,6);
    assert.equal(evidence.minimumCenterDistance,36);
    assert.equal(evidence.sourceViewerId,ids[3]);
    assert.equal(evidence.serverTick,904);
    assert.equal(evidence.maxObserverDrift,0);
    assert.equal(evidence.realPhysicalSwordsProven,false);
    assert.equal(evidence.releaseApproval,false);
  }
});
test("four different player arrival successes can COLLIDE in one authoritative tick",()=>{
  const views=snapshots();
  // Both overlap (8 units between centers) but remain individually inside
  // their own 18-unit arrival disk and the prototype 56 item reach radius.
  for(const v of views){
    v.fighters[0].x+=16;
    v.fighters[1].x-=16;
  }
  const evidence=assessNativeSameTickRackClearance(views,slots,"initial");
  assert.equal(evidence.ok,false);
  assert.match(evidence.reason,/overlap/);
  assert.equal(evidence.maxObserverDrift,0);
  assert(evidence.pairs.some(pair=>pair.a===1&&pair.b===2
    &&pair.distance===8&&!pair.clear));
});
test("four real-browser evidence must be one coherent authoritative roster with no ghosts",()=>{
  const base=snapshots();
  const cases=[
    v=>{v[0].fighters[0].x=NaN},
    v=>{v[2].fighters[3].netId=5}, // unexpected actor
    v=>{v[1].fighters[1].x+=20}, // another viewer disagrees
    v=>{v[3].fighters.pop()}, // incomplete single frame
    v=>{v[2].id=1}, // duplicate browser view
    v=>{v[1].tick=0},
    v=>{v[0].fighters[2].x=3900}, // wrong physical rack
    v=>{v[0].scoreboard.push("#5 late ghost")},
  ];
  for(const mutate of cases){
    const data=structuredClone(base);mutate(data);
    const result=assessNativeSameTickRackClearance(data,slots,"initial");
    assert.equal(result.ok,false);
  }
  assert.equal(assessNativeSameTickRackClearance(base,slots.slice(1),"initial").ok,false);
  assert.equal(assessNativeSameTickRackClearance(base,slots,"unknown").ok,false);
  const recovered=snapshots([1,3,4,5]);
  recovered[3].scoreboard.push("#2 stale dead fighter");
  assert.equal(assessNativeSameTickRackClearance(recovered,slots,"after-replacement").ok,false);
});
