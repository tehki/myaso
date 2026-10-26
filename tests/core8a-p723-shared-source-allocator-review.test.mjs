// Core8A P0 one selected typed Combat source. Owner retired KeyE source1.
// Preserve the old per-connection seq/gesture/replay and u32 saturation gates.
import test from "node:test";
import assert from "node:assert/strict";
import {ProposedSharedSourceGestureAllocator as Allocator}
  from "../src/network/prealpha-shared-source-allocator-proposal.mjs";
import {
  decodeProposedTypedGestureEvent as decode,
  PROPOSED_GESTURE_SOURCE as S,
  GESTURE_ACTION as A,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const token=()=>Object.freeze({});
const make=(trustedLease,first=1)=>new Allocator({
  reviewVersion:2,trustedLease,testOnlyInitialSequence:first,
});
const parsed=e=>decode(e.bytes);
const denied=fn=>assert.throws(fn,/Combat permits only the physical LMB gesture source/);

test("one lease allocates monotonic LMB PRESS/UPGRADE/RELEASE; denied KeyE has no ID",()=>{
  const q=make(token());
  const p=q.begin(S.LMB,42);
  const before=q.snapshot;
  for(const fn of [
    ()=>q.begin(S.KEY_E,43),()=>q.release(S.KEY_E,44),
    ()=>q.cancel(S.KEY_E,44),()=>q.begin(2,43),
  ]) {
    denied(fn);
    assert.deepEqual(q.snapshot,before,"retired source must never consume LMB ownership");
  }
  const up=q.upgrade(45),end=q.release(S.LMB,46);
  assert.deepEqual([p,up,end].map(x=>x.sequence),[1,2,3]);
  assert.deepEqual([p,up,end].map(x=>x.gestureId),[1,1,1]);
  assert.deepEqual([p,up,end].map(x=>x.source),[0,0,0]);
  assert.deepEqual([p,up,end].map(parsed).map(x=>x.action),
    [A.PRESS,A.UPGRADE,A.RELEASE]);
  assert.deepEqual(q.snapshot,{
    nextSequence:4,nextGestureId:2,activeSources:[],closed:false,
  });
  assert.equal(q.receiveAck,undefined);
  assert.equal(q.nextSendBatch,undefined);
  assert.equal(q.combatCommitted,undefined);
});

test("KeyE during LMB hold/charge cannot steal, release, upgrade or cancel it",()=>{
  const q=make(token());
  const p=q.begin(S.LMB,5);
  const before=q.snapshot;
  denied(()=>q.begin(S.KEY_E,6));
  denied(()=>q.release(S.KEY_E,6));
  denied(()=>q.cancel(S.KEY_E,6));
  assert.deepEqual(q.snapshot,before);
  assert.equal(q.upgrade(7).gestureId,p.gestureId);
  denied(()=>q.begin(S.KEY_E,8));
  assert.equal(q.cancel(S.LMB,9).sequence,3);
  assert.deepEqual(q.snapshot.activeSources,[]);
  assert.equal(q.begin(S.LMB,10).gestureId,2,
    "new legitimate LMB receives next gesture, not one consumed by E");
});

test("invalid source/tick/duplicate begin never advances source0 counters",()=>{
  const q=make(token());
  denied(()=>q.begin(2,1));
  denied(()=>q.begin(S.KEY_E,2**32));
  assert.throws(()=>q.begin(S.LMB,-1),/diagnostic clientTick/);
  const p=q.begin(S.LMB,0);
  assert.equal(p.sequence,1);
  assert.throws(()=>q.begin(S.LMB,0),/must terminate/);
  assert.throws(()=>q.upgrade(-1),/diagnostic clientTick/);
  assert.deepEqual(q.snapshot.activeSources,[S.LMB]);
  assert.equal(q.snapshot.nextSequence,2);
  assert.equal(q.snapshot.nextGestureId,2);
  assert.equal(q.release(S.LMB,0).sequence,2);
});

test("old lease cannot revive its active LMB and new actor reuses scoped IDs",()=>{
  const old=make(token());
  const p=old.begin(S.LMB,0);
  old.retire();
  assert.equal(old.snapshot.closed,true);
  for(const fn of [
    ()=>old.begin(S.LMB,1),()=>old.begin(S.KEY_E,1),
    ()=>old.upgrade(1),()=>old.cancel(S.LMB,1),
    ()=>old.release(S.LMB,1),
  ])assert.throws(fn,/retired/);
  const fresh=make(token()),q=fresh.begin(S.LMB,0);
  assert.deepEqual([p.sequence,p.gestureId],[q.sequence,q.gestureId]);
  assert.notEqual(fresh,old);
  assert.equal(fresh.combatCommitted,undefined);
});

test("four independent actor review leases reuse LMB bytes without cross-actor state",()=>{
  const queues=Array.from({length:4},()=>make(token()));
  const presses=queues.map(q=>q.begin(S.LMB,999));
  assert.deepEqual(presses.map(x=>[x.sequence,x.gestureId]),
    [[1,1],[1,1],[1,1],[1,1]]);
  const golden=Array.from(presses[0].bytes);
  assert.ok(presses.every(x=>JSON.stringify(Array.from(x.bytes))===JSON.stringify(golden)));
  queues[1].retire();
  assert.throws(()=>queues[1].cancel(S.LMB,1000),/retired/);
  assert.equal(queues[0].release(S.LMB,1000).sequence,2);
  assert.equal(queues[2].cancel(S.LMB,1000).sequence,2);
  assert.deepEqual(queues[3].snapshot.activeSources,[S.LMB]);
  denied(()=>queues[3].begin(S.KEY_E,1001));
});

test("allocator is explicitly review-only, not a trusted QUIC admission",()=>{
  assert.throws(()=>new Allocator(),/review version/i);
  assert.throws(()=>make(null),/lease object/);
  assert.throws(()=>make("self-declared actor"),/lease object/);
  assert.throws(()=>new Allocator({reviewVersion:1,trustedLease:token()}),/review version/i);
});

test("near-u32 rejected KeyE cannot consume reserved LMB UPGRADE/terminal",()=>{
  const max=0xffff_ffff;
  const q=make(token(),max-3);
  const press=q.begin(S.LMB,1);
  const before=q.snapshot;
  denied(()=>q.begin(S.KEY_E,2));
  denied(()=>q.release(S.KEY_E,2));
  denied(()=>q.cancel(S.KEY_E,2));
  assert.deepEqual(q.snapshot,before);
  const up=q.upgrade(3),terminal=q.release(S.LMB,4);
  assert.deepEqual([press.sequence,up.sequence,terminal.sequence],
    [max-3,max-2,max-1]);
  assert.equal(press.gestureId,terminal.gestureId);
  assert.equal(q.snapshot.closed,false);
});

test("at u32 boundary only legitimate LMB consumes nonwrapping sequence capacity",()=>{
  const max=0xffff_ffff;
  const q=make(token(),max-2);
  const p=q.begin(S.LMB,100);
  denied(()=>q.begin(S.KEY_E,101));
  assert.equal(q.upgrade(102).sequence,max-1);
  assert.equal(q.release(S.LMB,103).sequence,max);
  assert.equal(q.snapshot.nextSequence,max+1);
  assert.deepEqual(q.snapshot.activeSources,[]);
  assert.throws(()=>q.begin(S.LMB,104),/sequence capacity exhausted/);
  assert.equal(q.snapshot.closed,true);
});

test("exhausted or malformed test-only source budget does not grant combat authority",()=>{
  for(const v of [0,-1,2**32,1.5,"123",NaN])
    assert.throws(()=>make(token(),v),/test-only initial sequence/);
  const q=make(token(),0xffff_ffff);
  denied(()=>q.begin(S.KEY_E,1));
  assert.equal(q.snapshot.nextSequence,0xffff_ffff);
  assert.equal(q.snapshot.nextGestureId,1);
  assert.equal(q.snapshot.closed,false,"retired E must not exhaust the valid LMB lease");
  assert.throws(()=>q.begin(S.LMB,1),/sequence capacity exhausted/);
  assert.equal(q.snapshot.closed,true,"true LMB capacity exhaustion retires the lease");
});
