import test from "node:test";
import assert from "node:assert/strict";
import { createDormantPrecontactHoldReview } from "../src/browser/combat4-precontact-hold-review.mjs";
import { createDormantPrealphaLmbDomGate } from "../src/browser/prealpha-lmb-dom-gesture-review.mjs";
import { ProposedLmbGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { GESTURE_ACTION, decodeProposedGestureEvent } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const canvas = {};
const event=(pointerId=7,buttons=1)=>({
  pointerType:"mouse",pointerId,button:0,buttons,target:canvas,
});
function fixture() {
  const lease=Object.freeze({});
  const outbox=new ProposedLmbGestureOutbox({
    negotiatedVersion:2,trustedLease:lease,maxPending:16,
  });
  let ms=0,tick=1,jump=false;
  const gate=createDormantPrealphaLmbDomGate({
    outbox,getClientTick:()=>tick,acceptedPressNow:()=>ms,
    isCanvasTarget:e=>e.target===canvas,
    isJumpAttackChord:()=>jump,
  });
  const make=(options={})=>createDormantPrecontactHoldReview({
    gate,now:()=>ms,requestAfterMs:48,expireAfterMs:96,
    explicitReview:true,...options,
  });
  const edges=()=>outbox.nextSendBatch(16).map(x=>decodeProposedGestureEvent(x.bytes));
  return {gate,outbox,make,edges,at:t=>{ms=t;tick=Math.floor(ms/8)+1;},jump:v=>{jump=v;}};
}
test("no public activation: requires deliberate review and an approved nonzero precontact interval",()=>{
 const f=fixture();
 assert.throws(()=>f.make({explicitReview:false}),/explicit review/);
 for(const [requestAfterMs,expireAfterMs] of [
  [0,96],[96,96],[120,140],[-1,80],[NaN,50],[48,135],
 ]) assert.throws(()=>f.make({requestAfterMs,expireAfterMs}),/strictly before/);
});
test("one real gate-owned down, held through reviewed early threshold, queues one authenticated same-gesture UPGRADE",()=>{
 const f=fixture(),review=f.make();
 assert.equal(f.gate.pointerDown(event()),true);
 assert.equal(review.arm(7),true);
 f.at(47);
 assert.equal(review.poll(),"waiting");
 f.at(48);
 assert.equal(review.poll(),"submitted");
 assert.equal(review.poll(),"inactive","no second upgrade event on additional render frames");
 f.at(330);
 assert.equal(f.gate.pointerUp(event(7,0)),true);
 assert.deepEqual(f.edges().map(e=>e.action),[
   GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE,
 ]);
 assert.equal(new Set(f.edges().map(e=>e.gestureId)).size,1);
 assert.equal(f.outbox.snapshot.pending,3);
});
test("early genuine release produces PRESS+RELEASE only, and a delayed sampler never manufactures late UPGRADE",()=>{
 const a=fixture(),ar=a.make();
 a.gate.pointerDown(event());ar.arm(7);
 a.at(18);a.gate.pointerUp(event(7,0));
 assert.equal(ar.poll(),"retired");
 assert.deepEqual(a.edges().map(e=>e.action),[GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
 const b=fixture(),br=b.make();
 b.gate.pointerDown(event());br.arm(7);b.at(160);
 assert.equal(br.poll(),"expired","World may have landed Light at 135ms");
 assert.equal(br.poll(),"inactive","a late frame cannot send a retroactive upgrade");
 b.gate.pointerUp(event(7,0));
 assert.deepEqual(b.edges().map(e=>e.action),[GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
});
test("canceled or disconnected lease refuses upgrade and never adds phantom hit/release",()=>{
 for(const reason of ["blur","hidden","closeLease"]){
  const f=fixture(),review=f.make();
  f.gate.pointerDown(event());
  review.arm(7);
  f.at(50);f.gate[reason]();
  assert.equal(review.poll(),"retired");
  assert.equal(f.gate.pointerUp(event(7,0)),false);
  if(reason==="closeLease") {
   assert.equal(f.outbox.snapshot.closed,true);
   assert.throws(()=>f.edges(),/closed/,"old lease cannot resend stale queued events");
  } else assert.deepEqual(f.edges().map(e=>e.action),
    [GESTURE_ACTION.PRESS,GESTURE_ACTION.CANCEL]);
 }
});
test("foreign/stale pointer cannot arm or hijack, and rollover of local clock fails closed",()=>{
 const f=fixture(),review=f.make();
 f.gate.pointerDown(event(7));
 assert.equal(review.arm(11),false);
 assert.equal(review.arm(7),true);
 f.at(49);
 assert.equal(review.poll(),"submitted");
 f.at(30);
 assert.equal(review.poll(),"inactive");
 assert.deepEqual(f.edges().map(e=>e.action),
  [GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE]);
});
test("Space+LMB jump review never also creates a Heavy upgrade",()=>{
 const f=fixture();f.jump(true);
 assert.equal(f.gate.pointerDown(event()),false,"jump requires separately negotiated review opt-in");
 const r=f.make();assert.equal(r.arm(7),false);
 assert.deepEqual(f.edges(),[]);
});
test("bad monotonic clock produces no upgrade and cannot be recovered by a later poll",()=>{
 const f=fixture(),r=f.make();
 f.at(60);f.gate.pointerDown(event());r.arm(7);
 f.at(40);
 assert.equal(r.poll(),"invalid-clock");
 f.at(90);
 assert.equal(r.poll(),"inactive");
 f.gate.pointerUp(event(7,0));
 assert.deepEqual(f.edges().map(e=>e.action),[GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
});

test("one lease may handle a new legitimate gesture only after retiring the previous observation",()=>{
 const f=fixture(),r=f.make();
 f.gate.pointerDown(event());assert.equal(r.arm(7),true);
 f.at(49);assert.equal(r.poll(),"submitted");
 f.at(52);f.gate.pointerUp(event(7,0));
 assert.equal(f.gate.pointerDown(event()),true);
 assert.equal(r.arm(7),false,"must not inherit stale ownership from prior gesture");
 r.retire();
 assert.equal(r.arm(7),true);
 f.at(103);assert.equal(r.poll(),"submitted");
 f.gate.pointerUp(event(7,0));
 const es=f.edges();
 assert.deepEqual(es.map(e=>e.action),[
   GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE,
   GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE,
 ]);
 assert.deepEqual(es.map(e=>e.gestureId),[1,1,1,2,2,2]);
});

test("delayed browser arm() cannot restart the physical DOWN-to-contact clock or revive a late upgrade",()=>{
  const expired=fixture();
  assert.equal(expired.gate.pointerDown(event()),true);
  assert.equal(expired.gate.snapshot.pressMs,0);
  expired.at(112);
  const r=expired.make();
  assert.equal(r.arm(7),true,"must preserve real physical identity while held");
  assert.equal(r.poll(),"expired","elapsed physical hold already exceeds pre-contact budget");
  expired.gate.pointerUp(event(7,0));
  assert.deepEqual(expired.edges().map(e=>e.action),
    [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE],
    "late arm MUST NOT produce upgraded Heavy");

  const early=fixture();
  early.gate.pointerDown(event());
  early.at(43);
  const e=early.make();
  assert.equal(e.arm(7),true);
  early.at(50);
  assert.equal(e.poll(),"submitted","upgrade threshold measured from DOWN, not delayed arm()");
  early.gate.pointerUp(event(7,0));
  assert.deepEqual(early.edges().map(x=>x.action),
    [GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE]);
});
test("review physical press clock invalidity denies the original dormant edge before enqueue",()=>{
 const outbox=new ProposedLmbGestureOutbox({
  negotiatedVersion:2,trustedLease:Object.freeze({}),maxPending:16,
 });
 const gate=createDormantPrealphaLmbDomGate({
  outbox, getClientTick:()=>1,isCanvasTarget:e=>e.target===canvas,
  acceptedPressNow:()=>Number.NaN,
 });
 assert.equal(gate.pointerDown(event()),false);
 assert.equal(gate.snapshot.active,false);
 assert.equal(outbox.snapshot.pending,0);
});
