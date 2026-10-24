import test from "node:test";
import assert from "node:assert/strict";
import {ProposedSharedSourceGestureAllocator} from "../src/network/prealpha-shared-source-allocator-proposal.mjs";
import {decodeProposedTypedGestureEvent,
  PROPOSED_GESTURE_SOURCE as S, GESTURE_ACTION as A,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
const lease=()=>Object.freeze({});
const make=trustedLease=>new ProposedSharedSourceGestureAllocator({reviewVersion:2,trustedLease});

test("one LMB lease allocates PRESS, upgrade and terminal without keyboard Combat",()=>{
  const q=make(lease()), p=q.begin(S.LMB,42), u=q.upgrade(43), r=q.release(S.LMB,44);
  assert.deepEqual([p,u,r].map(e=>e.action),[A.PRESS,A.UPGRADE,A.RELEASE]);
  assert.deepEqual([p,u,r].map(e=>e.sequence),[1,2,3]);
  assert.deepEqual([p,u,r].map(e=>e.gestureId),[1,1,1]);
  assert.deepEqual([p,u,r].map(e=>e.source),[S.LMB,S.LMB,S.LMB]);
  assert.deepEqual([p,u,r].map(e=>decodeProposedTypedGestureEvent(e.bytes).sequence),[1,2,3]);
  assert.deepEqual(q.snapshot,{nextSequence:4,nextGestureId:2,activeSources:[],closed:false});
  assert.equal(q.receiveAck,undefined);
  assert.equal(q.nextSendBatch,undefined);
  assert.equal(q.combatCommitted,undefined);
});

test("retired source1 Key E cannot open, terminate, or steal a live LMB",()=>{
  const q=make(lease()), p=q.begin(S.LMB,15), before=q.snapshot;
  for(const op of [()=>q.begin(S.KEY_E,16),()=>q.release(S.KEY_E,16),
    ()=>q.cancel(S.KEY_E,16)]) assert.throws(op,/only the physical LMB/);
  assert.deepEqual(q.snapshot,before,"rejected E cannot consume sequence or gesture identity");
  const r=q.release(S.LMB,17);
  assert.equal(r.gestureId,p.gestureId);
  assert.equal(r.sequence,2);
});

test("only current physical LMB may CANCEL; old terminal cannot replay",()=>{
  const q=make(lease()), p=q.begin(S.LMB,55), c=q.cancel(S.LMB,56);
  assert.equal(c.gestureId,p.gestureId);
  assert.equal(c.action,A.CANCEL);
  assert.throws(()=>q.release(S.LMB,57),/no active/);
  assert.throws(()=>q.cancel(S.LMB,57),/no active/);
  assert.deepEqual(q.snapshot.activeSources,[]);
});

test("invalid source, tick and duplicate PRESS cannot advance counters",()=>{
  const q=make(lease());
  assert.throws(()=>q.begin(2,1),/only the physical LMB/);
  assert.throws(()=>q.begin(S.KEY_E,1),/only the physical LMB/);
  assert.throws(()=>q.begin(S.LMB,-1),/diagnostic clientTick/);
  assert.throws(()=>q.begin(S.LMB,2**32),/diagnostic clientTick/);
  const p=q.begin(S.LMB,0);
  assert.equal(p.sequence,1);
  assert.throws(()=>q.begin(S.LMB,0),/must terminate/);
  assert.throws(()=>q.upgrade(-1),/diagnostic clientTick/);
  assert.equal(q.snapshot.nextSequence,2);
  assert.equal(q.snapshot.nextGestureId,2);
  assert.equal(q.release(S.LMB,0).sequence,2);
});

test("retirement fences stale keyboard and pointer events, fresh incarnation owns new IDs",()=>{
  const old=make(lease()), p=old.begin(S.LMB,0);
  old.retire();
  for(const op of [()=>old.begin(S.KEY_E,1),()=>old.begin(S.LMB,1),
    ()=>old.upgrade(1),()=>old.cancel(S.LMB,1),()=>old.release(S.LMB,1)])
    assert.throws(op,/retired/);
  assert.equal(old.snapshot.closed,true);
  const fresh=make(lease()), again=fresh.begin(S.LMB,0);
  assert.equal(again.sequence,p.sequence);
  assert.equal(again.gestureId,p.gestureId);
  assert.notEqual(fresh,old);
});

test("four independently scoped actors use only source0; one retired actor cannot affect peers",()=>{
  const qs=[make(lease()),make(lease()),make(lease()),make(lease())];
  const presses=qs.map(q=>q.begin(S.LMB,999));
  assert.deepEqual(presses.map(e=>[e.source,e.sequence,e.gestureId]),
    Array.from({length:4},()=>[S.LMB,1,1]));
  assert.deepEqual(presses.map(e=>Array.from(e.bytes)),
    Array.from({length:4},()=>Array.from(presses[0].bytes)));
  qs[1].retire();
  assert.throws(()=>qs[1].release(S.LMB,1000),/retired/);
  assert.equal(qs[0].release(S.LMB,1000).sequence,2);
  assert.equal(qs[2].cancel(S.LMB,1000).sequence,2);
  assert.deepEqual(qs[3].snapshot.activeSources,[S.LMB]);
});

test("review allocator is not live QUIC authentication or a HIT writer",()=>{
  assert.throws(()=>new ProposedSharedSourceGestureAllocator(),/review version/i);
  assert.throws(()=>make(null),/lease object/);
  assert.throws(()=>make("client-provided-claim"),/lease object/);
  assert.throws(()=>new ProposedSharedSourceGestureAllocator({
    reviewVersion:1,trustedLease:lease()}),/review version/i);
});

test("near-u32 rejecting Key E preserves exact LMB upgrade and release reservation",()=>{
  const max=0xffff_ffff;
  const q=new ProposedSharedSourceGestureAllocator({
    reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:max-3});
  const p=q.begin(S.LMB,1), before=q.snapshot;
  assert.throws(()=>q.begin(S.KEY_E,2),/only the physical LMB/);
  assert.deepEqual(q.snapshot,before);
  const u=q.upgrade(3), r=q.release(S.LMB,4);
  assert.deepEqual([p.sequence,u.sequence,r.sequence],[max-3,max-2,max-1]);
  assert.equal(u.gestureId,p.gestureId);
  assert.equal(r.gestureId,p.gestureId);
  assert.equal(q.snapshot.closed,false);
});

test("exact three sequence slots suffice for LMB, and lease never wraps at u32",()=>{
  const max=0xffff_ffff;
  const q=new ProposedSharedSourceGestureAllocator({
    reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:max-2});
  const p=q.begin(S.LMB,100);
  assert.throws(()=>q.begin(S.KEY_E,101),/only the physical LMB/);
  const u=q.upgrade(102), r=q.release(S.LMB,103);
  assert.deepEqual([p.sequence,u.sequence,r.sequence],[max-2,max-1,max]);
  assert.equal(q.snapshot.nextSequence,max+1);
  assert.deepEqual(q.snapshot.activeSources,[]);
  assert.throws(()=>q.begin(S.LMB,104),/sequence capacity exhausted/);
  assert.equal(q.snapshot.closed,true);
});

test("test-only counter seam rejects malformed IDs and source1 cannot exhaust lease",()=>{
  for(const value of [0,-1,2**32,1.5,"123",NaN])
    assert.throws(()=>new ProposedSharedSourceGestureAllocator({
      reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:value}),
    /test-only initial sequence/);
  const q=new ProposedSharedSourceGestureAllocator({
    reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:0xffff_ffff});
  assert.throws(()=>q.begin(S.KEY_E,1),/only the physical LMB/);
  assert.equal(q.snapshot.nextSequence,0xffff_ffff);
  assert.equal(q.snapshot.closed,false);
  assert.throws(()=>q.begin(S.LMB,1),/sequence capacity exhausted/);
  assert.equal(q.snapshot.closed,true);
  assert.equal(q.receiveAck,undefined);
});
