import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createSilverMainHandRevisionGuard} from "../src/browser/silver-mainhand-revision-guard.mjs";
const anchors=JSON.parse(readFileSync(new URL("../web/assets/knights/silver_hand_anchors_p0.json",import.meta.url)));
const actor="confirmed-char-202-not-a-real-account";
const sword=(id="TEST-ITEM-A",seq=1)=>({slot:"MainHand",location:"equipped",
  visualKind:"sword",itemId:id,ownerActorKey:actor,revision:seq,committedSequence:seq});
const make=(rev,hand,epoch=1,tick=rev*10)=>({
  provenance:"core-items-committed-snapshot",
  actorKey:actor,sessionEpoch:epoch,
  snapshotRevision:rev,serverTick:tick,mainHand:hand
});
const props=s=>({actorKind:"player",actorKey:actor,equipmentSnapshot:s,
  clip:"silver_idle",frame:0,direction:0,anchors});
test("after drop, delayed real-looking sword equip cannot resurrect a visible blade",()=>{
 const g=createSilverMainHandRevisionGuard();
 const before=make(10,sword("A",10));
 assert.equal(g.plan(props(before))?.itemId,"A");
 const dropped=make(11,null);
 assert.equal(g.plan(props(dropped)),null);
 assert.deepEqual(g.audit(actor),{sessionEpoch:1,snapshotRevision:11,
  serverTick:110,armed:false,quarantined:false});
 assert.equal(g.plan(props(before)),null);
 assert.equal(g.ingest(before,actor).reason,"stale-revision-or-tick");
 assert.equal(g.plan(props(make(11,null,1,111))),null,
   "newer tick with same revision and same empty MainHand remains empty");
 assert.equal(g.plan(props(make(12,sword("B",12))))?.itemId,"B");
 assert.equal(g.plan(props(before)),null);
});
test("same-revision contradictions quarantine both sword and empty hand",()=>{
 const g=createSilverMainHandRevisionGuard();
 const first=make(5,sword("A",5),1,50);
 assert.equal(g.plan(props(first))?.itemId,"A");
 const altered=make(5,sword("B",5),1,51);
 assert.equal(g.plan(props(altered)),null);
 assert.equal(g.audit(actor).quarantined,true);
 assert.equal(g.plan(props(first)),null);
 assert.equal(g.plan(props(make(5,sword("A",5),1,51))),null);
 assert.equal(g.plan(props(make(6,null,1,52))),null);
 assert.equal(g.audit(actor).quarantined,false);
 assert.equal(g.plan(props(make(7,sword("B",7),1,53)))?.itemId,"B");
});
test("stale session generation loses against reconnect and ABA item transfer",()=>{
 const g=createSilverMainHandRevisionGuard();
 assert.equal(g.plan(props(make(200,sword("A",100),1,1400)))?.itemId,"A");
 assert.equal(g.plan(props(make(201,null,2,1410))),null);
 assert.equal(g.ingest(make(999,sword("A",999),1,9999),actor).reason,"stale-session",
   "ancient writer cannot revive blade even with inflated item revision");
 assert.equal(g.plan(props(make(200,sword("A",100),3,1420))),null,
   "new generation is not allowed to roll back durable actor revision");
 assert.equal(g.plan(props(make(202,sword("B",101),3,1420)))?.itemId,"B");
 assert.equal(g.plan(props(make(202,null,2,1430))),null,
   "late earlier generation cannot clear or change newer snapshot");
 assert.equal(g.audit(actor).sessionEpoch,3);
});
test("missing, pending, wrong-actor, malformed or client-predicted shapes fail closed",()=>{
 const g=createSilverMainHandRevisionGuard();
 const examples=[
 null,undefined,{},make(1,{...sword(),location:"rack"}),
 {...make(1,sword()),provenance:"user-clicked-world-sword"},
 {...make(1,sword()),mainHand:{...sword(),ownerActorKey:"hacker"}},
 {...make(1,sword()),actorKey:"different"},
 {...make(1,sword()),sessionEpoch:0},
 {...make(1,sword()),snapshotRevision:-1},
 {...make(1,sword()),serverTick:1.5},
 {...make(1,sword()),mainHand:undefined},
 {...make(1,sword()),mainHand:{...sword(),itemId:""}},
 {...make(1,sword()),mainHand:{...sword(),committedSequence:0}}
 ];
 for(const e of examples){
  assert.equal(g.plan(props(e)),null,JSON.stringify(e));
  assert.equal(g.size(),0,"invalid payload must not consume actor slot");
 }
 assert.equal(g.plan({...props(make(1,sword())),actorKind:"npc"}),null);
 assert.equal(g.size(),0);
});
test("finite bounded cache rejects new actors; cannot evict revision history to revive stale sword",()=>{
 const g=createSilverMainHandRevisionGuard({maxActors:1});
 assert.equal(g.plan(props(make(5,null))),null);
 assert.equal(g.size(),1);
 const other="confirmed-char-303";
 const snapshot={...make(7,sword("B",7)),actorKey:other,
  mainHand:{...sword("B",7),ownerActorKey:other}};
 assert.equal(g.ingest(snapshot,other).reason,"bounded-cache-full");
 assert.equal(g.plan({...props(snapshot),actorKey:other}),null);
 assert.equal(g.size(),1);
 assert.equal(g.plan(props(make(4,sword("A",4)))),null);
 assert.throws(()=>createSilverMainHandRevisionGuard({maxActors:0}),RangeError);
 assert.throws(()=>createSilverMainHandRevisionGuard({maxActors:300}),RangeError);
});
test("external mutation cannot rewrite stored revision or quarantine",()=>{
 const g=createSilverMainHandRevisionGuard();
 const initial=make(20,null);
 assert.equal(g.plan(props(initial)),null);
 initial.snapshotRevision=0;
 initial.mainHand=sword("A",1);
 assert.equal(g.plan(props(initial)),null);
 assert.equal(g.audit(actor).snapshotRevision,20);
 const audit=g.audit(actor);
 assert.ok(Object.isFrozen(audit));
 assert.throws(()=>{audit.armed=true},TypeError);
});

test("cross-epoch same-revision item contradiction stays quarantined until new writer revision",()=>{
 const g=createSilverMainHandRevisionGuard();
 assert.equal(g.plan(props(make(40,sword("A",39),1,800)))?.itemId,"A");
 assert.equal(g.plan(props(make(40,sword("B",39),2,801))),null);
 assert.equal(g.audit(actor).quarantined,true);
 assert.equal(g.audit(actor).sessionEpoch,2);
 assert.equal(g.plan(props(make(40,sword("A",39),2,802))),null);
 assert.equal(g.plan(props(make(41,null,2,803))),null);
 assert.equal(g.audit(actor).quarantined,false);
 assert.equal(g.plan(props(make(42,sword("B",42),2,804)))?.itemId,"B");
});
test("later revision with earlier tick cannot revive weapon within same session",()=>{
 const g=createSilverMainHandRevisionGuard();
 assert.equal(g.plan(props(make(10,null,1,100))),null);
 assert.equal(g.ingest(make(11,sword("A",11),1,99),actor).reason,"stale-tick");
 assert.equal(g.plan(props(make(12,sword("B",12),1,110)))?.itemId,"B");
});
