import test from "node:test";
import assert from "node:assert/strict";
import {createProposedCurrentRackVisualStream,CURRENT_RACK_VISUAL_PROPOSAL}
 from "../src/browser/armory-current-rack-visual-stream.mjs";
const worldArmory={
 id:"greyhaven-smith-open-front",buildingId:"smith",
 layout:"outdoor-open-front",requiresZoneTransfer:false,
 hasImplicitInventory:false,mapId:"moonvale-overworld",
 rackSockets:[3740,3780,3820,3860].map((x,i)=>({
  socketId:"greyhaven-rack-"+(i+1),x,y:4038,
  displayCategory:"sword",mapId:"moonvale-overworld",
  approach:{x,y:4088}
 }))
};
const authoredMap={id:"moonvale-overworld",buildings:[{
 id:"smith",kind:"smith",x:3710,y:3850,w:182,h:162
}]};
const scopeKey="ART-ONLY-FIXTURE-NOT-CORE-WIRE";
const make=()=>createProposedCurrentRackVisualStream({
 worldArmory,authoredMap,layoutVersion:1,camera:{x:3800,y:4038},scopeKey
});
const slot=(index,mutation="1")=>({
 socketId:"greyhaven-rack-"+(index+1),
 itemId:"ART-ONLY-NO-SERVER-"+index,
 groundEntityId:"ART-ONLY-NO-GROUND-"+index,
 itemMutationSequence:mutation
});
const snapshot=(journalSequence,slots)=>({scopeKey,journalSequence,slots});
const initial=()=>snapshot("1",[slot(0),slot(1),slot(2),slot(3)]);

test("P0 read-only Core C3u candidate-style four slot projection: 4 → 3 → 0 → 4 independently visible swords",()=>{
 const stream=make();
 assert.equal(stream.getView(),null);
 assert.deepEqual(stream.worldAuthoredSockets,
  ["greyhaven-rack-1","greyhaven-rack-2","greyhaven-rack-3","greyhaven-rack-4"]);
 let result=stream.apply(initial());
 assert.equal(result.status,"accepted");
 assert.equal(result.view.plan.swords.length,4);
 assert.equal(result.view.plan.rack.kind,"rack");
 assert.deepEqual(result.view.visibleIds,[0,1,2,3].map(i=>"ART-ONLY-NO-SERVER-"+i));
 assert.equal(result.view.actualAuthoritativeItemsVerified,false);
 assert.equal(result.sourceAuthenticated,false);
 const first=result.view.plan;
 result=stream.apply(snapshot("2",[null,slot(1),slot(2),slot(3)]));
 assert.equal(result.status,"accepted");
 assert.equal(result.view.plan.swords.length,3);
 assert.deepEqual(result.view.visibleIds,[1,2,3].map(i=>"ART-ONLY-NO-SERVER-"+i));
 assert.equal(first.count,4);
 result=stream.apply(snapshot("3",[null,null,null,null]));
 assert.equal(result.status,"accepted");
 assert.equal(result.view.plan.count,0);
 assert.deepEqual(result.view.visibleIds,[]);
 assert.equal(result.view.plan.rack.kind,"rack");
 result=stream.apply(snapshot("4",[slot(0,"4"),slot(1,"4"),slot(2,"4"),slot(3,"4")]));
 assert.equal(result.status,"accepted");
 assert.equal(result.view.plan.count,4);
 assert.equal(result.view.plan.swords.find(s=>s.id==="ART-ONLY-NO-SERVER-0").revision,4);
 assert.equal(result.view.plan.sourceWorldHeadExpected,
  "07060f981b8a1dac89184b621b6893dd970a08ae");
 assert.equal(CURRENT_RACK_VISUAL_PROPOSAL.networkEnvelopeDefined,false);
 assert.equal(CURRENT_RACK_VISUAL_PROPOSAL.realServerDataConnected,false);
 assert.equal(stream.productionApproved,false);
});

test("P0 old snapshot and byte-identical equal journal head never restore a picked-up visual sword",()=>{
 const stream=make();
 stream.apply(initial());
 const accepted=stream.apply(snapshot("2",[null,slot(1),slot(2),slot(3)]));
 const stale=stream.apply(initial());
 assert.equal(stale.status,"stale");
 assert.equal(stale.view,accepted.view);
 assert.equal(stream.getView().plan.count,3);
 const duplicate=stream.apply(snapshot("2",[null,slot(1),slot(2),slot(3)]));
 assert.equal(duplicate.status,"duplicate");
 assert.equal(duplicate.view,accepted.view);
 assert.throws(()=>stream.apply(snapshot("2",[slot(0),slot(1),slot(2),slot(3)])),
  /inconsistent/);
 assert.equal(stream.getView().plan.count,3);
});

test("P0 ghost reappearance without NEW item mutation sequence fails closed",()=>{
 const stream=make();
 stream.apply(initial());
 stream.apply(snapshot("2",[null,slot(1),slot(2),slot(3)]));
 assert.throws(()=>stream.apply(snapshot("3",[slot(0,"1"),slot(1),slot(2),slot(3)])),
  /ghost-returned/);
 assert.equal(stream.getView().plan.count,3);
 assert.equal(stream.apply(snapshot("3",[slot(0,"3"),slot(1),slot(2),slot(3)])).status,"accepted");
 assert.equal(stream.getView().plan.count,4);
 assert.throws(()=>stream.apply(snapshot("4",[slot(0,"2"),slot(1),slot(2),slot(3)])),
  /regressed/);
});

test("P0 do not truncate u64 journal/mutation sequences into JS number IDs",()=>{
 const stream=make();
 const huge="18446744073709551615";
 const accepted=stream.apply(snapshot(huge,[null,null,null,null]));
 assert.equal(accepted.status,"accepted");
 assert.equal(accepted.view.journalSequence,huge);
 assert.equal(stream.apply(initial()).status,"stale");
 for(const invalid of ["01","-1","2.1","1e5","18446744073709551616",1,0,null,""]) {
  const s=make();
  assert.throws(()=>s.apply(snapshot(invalid,[null,null,null,null])));
 }
 const s=make();
 assert.throws(()=>s.apply(snapshot(huge,[slot(0,huge),null,null,null])),
  /cannot represent full u64/);
});

test("P0 reject mixed scopes, false socket, duplicate ground or item, mutation-after-journal and illegitimate source shape",()=>{
 const cases=[
  {scopeKey:"foreign",journalSequence:"2",slots:[null,null,null,null]},
  snapshot("2",[slot(1),null,null,null]),
  snapshot("2",[slot(0),slot(0),null,null]),
  snapshot("2",[slot(0),{...slot(1),groundEntityId:slot(0).groundEntityId},null,null]),
  snapshot("2",[slot(0,"3"),null,null,null]),
  snapshot("2",[null,null,null]),
  snapshot("2",[{},null,null,null]),
 ];
 for(const bad of cases){
  const stream=make();
  assert.throws(()=>stream.apply(bad));
  assert.equal(stream.getView(),null);
 }
 for(const invalid of [null,{}, {worldArmory,authoredMap,layoutVersion:9,camera:{x:3800,y:4038},scopeKey}]){
  assert.throws(()=>createProposedCurrentRackVisualStream(invalid));
 }
});

test("P0 visual proposal never creates server-equipment or TryPickup wire authority",()=>{
 assert.equal(CURRENT_RACK_VISUAL_PROPOSAL.writerAuthorization,false);
 assert.equal(CURRENT_RACK_VISUAL_PROPOSAL.epochOrZoneScaleApproved,false);
 assert.equal(CURRENT_RACK_VISUAL_PROPOSAL.productionApproved,false);
 assert.equal(make().getView(),null);
});
