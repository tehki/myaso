import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../assets/environment/greyhaven/armory-p0/current-rack-review/",import.meta.url);
const read=name=>readFileSync(new URL(name,base));
const r=JSON.parse(read("armory_p0_world521_ui503_native_report.json").toString("utf8"));
test("P0 normalized current rack candidate QA loads real World #521, original Blender and UI #503 source",()=>{
 assert.equal(r.sourceHeads.world,"3178b9aad8757ceb3594ff04b9e3099dced6b729");
 assert.equal(r.sourceHeads.ui,"8d500d8ddeb4058f15dbc704bf78d685d1ca31ef");
 assert.equal(r.consolidatedWorld521Candidate,true);
 assert.equal(r.allSourcesUnchanged,true);
 assert.equal(r.realGameClientExecuted,false);
 assert.equal(r.realMultiplayerUsers,0);
 assert.equal(r.realServerTryPickup,false);
 assert.equal(r.productionApproved,false);
 assert.equal(r.browserResults.length,2);
});
test("P0 genuine Chrome and Firefox preserve 4→3→0→4 original Blender rack swords in actual completed Canvas",()=>{
 for(const engine of ["chrome","firefox"]){
  const b=r.browserResults.find(v=>v.engine===engine);
  assert.ok(b);
  assert.match(b.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\/153/);
  assert.deepEqual(b.errors,[]);
  const steps=b.proposedJournalVisualTimeline;
  assert.equal(steps.length,4);
  assert.deepEqual(steps.map(s=>s.sequence),["1","2","3","4"]);
  assert.deepEqual(steps.map(s=>s.status),["accepted","accepted","accepted","accepted"]);
  assert.deepEqual(steps.map(s=>s.displayedCount),[4,3,0,4]);
  assert.deepEqual(steps.map(s=>s.journal),["1","2","3","4"]);
  assert.deepEqual(steps.map(s=>s.visibleIds),
    [["ART-ONLY-NO-SERVER-0","ART-ONLY-NO-SERVER-1","ART-ONLY-NO-SERVER-2","ART-ONLY-NO-SERVER-3"],
     ["ART-ONLY-NO-SERVER-1","ART-ONLY-NO-SERVER-2","ART-ONLY-NO-SERVER-3"],
     [],
     ["ART-ONLY-NO-SERVER-0","ART-ONLY-NO-SERVER-1","ART-ONLY-NO-SERVER-2","ART-ONLY-NO-SERVER-3"]]);
  assert.equal(b.proposedJournalStaleRejection.status,"stale");
  assert.equal(b.proposedJournalStaleRejection.frameId,steps[1].frameId);
  assert.equal(b.postReserved.cancelled,4);
  assert.equal(b.postReserved.combatFallback,1);
  assert.equal(b.postReserved.visualIntents.length,10);
  assert.equal(b.afterEmpty.combatFallback,2);
  assert.equal(b.afterEmpty.drawnRackCount,1);
  assert.equal(b.afterEmpty.drawnSwordCount,0);
  assert.equal(b.afterRestore.visualIntents.length,11);
  assert.equal(b.afterRestore.visualIntents.at(-1),"ART-ONLY-NO-SERVER-0");
  assert.equal(b.afterRestore.swordRects.find(s=>s.id==="ART-ONLY-NO-SERVER-0").revision,4);
  assert.equal(b.afterRestore.actualServerEvents,0);
  assert.equal(b.actualCore577ReaderInvoked,false);
  assert.equal(b.actualCanonicalItemNetworkPackets,0);
  assert.equal(b.journalScreenshots.length,4);
  for(const name of b.journalScreenshots){
   assert.match(name,/^armory_current_world521_/);
   const png=read(name);
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.ok(png.length>70000);
  }
 }
});
test("P0 normalized local candidate stream never exposes itself as an authenticated Core/Items writer or online game path",()=>{
 const local=name=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
 const script=local("web/armory-p0-world493-ui-review.mjs");
 const runner=local("tools/art/verify_armory_world493_ui503.mjs");
 assert.match(script,/createProposedCurrentRackVisualStream/);
 assert.match(script,/ART-ONLY-LOCAL-JOURNAL-FIXTURE/);
 assert.match(runner,/actualCore577ReaderInvoked:false/);
 assert.match(runner,/realPickupCommitted:false/);
 assert.doesNotMatch(local("web/online-game.mjs"),/armory-current-rack-visual-stream/);
});
