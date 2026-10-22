import test from "node:test";
import assert from "node:assert/strict";
import {
  ProposedSharedSourceGestureAllocator,
} from "../src/network/prealpha-shared-source-allocator-proposal.mjs";
import {
  decodeProposedTypedGestureEvent, decodeProposedGestureEvent,
  PROPOSED_GESTURE_SOURCE as S, GESTURE_ACTION as A,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const lease = () => Object.freeze({});
const make = trustedLease =>
  new ProposedSharedSourceGestureAllocator({reviewVersion:2, trustedLease});
const parsed = event => decodeProposedTypedGestureEvent(event.bytes);

test("one lease uses ONE sequence and gesture allocator for overlapping LMB and KeyE",()=>{
  const q=make(lease());
  const lmb=q.begin(S.LMB,42);
  const key=q.begin(S.KEY_E,43);
  const keyUp=q.release(S.KEY_E,44);
  const upgrade=q.upgrade(45);
  const lmbUp=q.release(S.LMB,46);
  assert.deepEqual([lmb,key,keyUp,upgrade,lmbUp].map(e=>e.sequence),[1,2,3,4,5]);
  assert.deepEqual([lmb,key,keyUp,upgrade,lmbUp].map(e=>e.gestureId),[1,2,2,1,1]);
  assert.deepEqual([lmb,key,keyUp,upgrade,lmbUp].map(e=>e.source),[0,1,1,0,0]);
  assert.deepEqual([lmb,key,keyUp,upgrade,lmbUp].map(parsed).map(x=>x.sequence),[1,2,3,4,5]);
  for(const e of [key,keyUp]) {
    assert.throws(()=>decodeProposedGestureEvent(e.bytes),/reserved/i,
      "the unchanged old codec must still deny KeyE");
  }
  assert.deepEqual(q.snapshot,{
    nextSequence:6,nextGestureId:3,activeSources:[],closed:false,
  });
  assert.equal(q.receiveAck,undefined,"allocator cannot settle an ACK");
  assert.equal(q.nextSendBatch,undefined,"allocator cannot claim a packet sent");
  assert.equal(q.combatCommitted,undefined,"allocator never grants HIT");
});

test("early KeyE release is one lifecycle edge, not a second heavy trigger",()=>{
  const q=make(lease());
  const p=q.begin(S.KEY_E,15);
  const u=q.release(S.KEY_E,15);
  assert.equal(p.action,A.PRESS);
  assert.equal(u.action,A.RELEASE);
  assert.equal(p.gestureId,u.gestureId);
  assert.equal(u.sequence,p.sequence+1);
  assert.throws(()=>q.release(S.KEY_E,15),/no active/);
  assert.throws(()=>q.upgrade(15),/active LMB/);
  assert.equal(q.snapshot.nextGestureId,2);
});

test("two simultaneous sources may cancel without crossing gesture identities",()=>{
  const q=make(lease());
  const e=q.begin(S.KEY_E,55);
  const l=q.begin(S.LMB,55);
  assert.equal(q.cancel(S.LMB,56).gestureId,l.gestureId);
  assert.equal(q.cancel(S.KEY_E,56).gestureId,e.gestureId);
  assert.throws(()=>q.cancel(S.KEY_E,56),/no active/);
  assert.deepEqual(q.snapshot.activeSources,[]);
  assert.deepEqual(q.snapshot,{nextSequence:5,nextGestureId:3,activeSources:[],closed:false});
});

test("invalid source, tick and duplicate start do not advance global counters",()=>{
  const q=make(lease());
  assert.throws(()=>q.begin(2,1),/unknown typed/);
  assert.throws(()=>q.begin(S.LMB,-1),/diagnostic clientTick/);
  assert.throws(()=>q.begin(S.KEY_E,2**32),/diagnostic clientTick/);
  const first=q.begin(S.LMB,0);
  assert.equal(first.sequence,1);
  assert.throws(()=>q.begin(S.LMB,0),/must terminate/);
  assert.throws(()=>q.upgrade(-1),/diagnostic clientTick/);
  assert.equal(q.snapshot.nextSequence,2);
  assert.equal(q.snapshot.nextGestureId,2);
  assert.equal(q.release(S.LMB,0).sequence,2);
});

test("retired lease denies stale source events even when new lease reuses numeric IDs",()=>{
  const old=make(lease());
  const oldPress=old.begin(S.LMB,0);
  old.retire();
  assert.equal(old.snapshot.closed,true);
  for(const fn of [()=>old.begin(S.KEY_E,1),()=>old.upgrade(1),
    ()=>old.cancel(S.LMB,1),()=>old.release(S.LMB,1)])
    assert.throws(fn,/retired/);
  const fresh=make(lease());
  const p=fresh.begin(S.LMB,0);
  assert.equal(oldPress.sequence,p.sequence,"distinct leases may both start seq1");
  assert.equal(oldPress.gestureId,p.gestureId,"distinct leases may both start gesture1");
  assert.notEqual(fresh,old);
  // This test asserts lifetime-local IDs; it cannot validate QUIC admission.
});

test("four independently scoped actor fixtures reuse identical bytes safely",()=>{
  const q=[make(lease()),make(lease()),make(lease()),make(lease())];
  const press=q.map(x=>x.begin(S.KEY_E,999));
  assert.deepEqual(press.map(x=>[x.sequence,x.gestureId]),[[1,1],[1,1],[1,1],[1,1]]);
  assert.deepEqual(press.map(x=>Array.from(x.bytes)),[
    ...Array.from({length:4},()=>Array.from(press[0].bytes)),
  ]);
  q[1].retire();
  assert.throws(()=>q[1].cancel(S.KEY_E,1000),/retired/);
  const a=q[0].release(S.KEY_E,1000);
  const b=q[2].cancel(S.KEY_E,1000);
  assert.equal(a.sequence,2);
  assert.equal(b.sequence,2);
  assert.equal(q[3].snapshot.nextSequence,2);
  assert.deepEqual(q[3].snapshot.activeSources,[S.KEY_E]);
});

test("creation is explicitly review-only and never asserts QUIC authentication",()=>{
  assert.throws(()=>new ProposedSharedSourceGestureAllocator(),/review version/i);
  assert.throws(()=>make(null),/lease object/);
  assert.throws(()=>make("client-provided-claim"),/lease object/);
  assert.throws(()=>new ProposedSharedSourceGestureAllocator({
    reviewVersion:1,trustedLease:lease(),
  }),/review version/i);
});

test("near-u32 KEY_E admission denies under-reserved LMB UPGRADE but preserves old gesture",()=>{
  const max=0xffff_ffff;
  const q=new ProposedSharedSourceGestureAllocator({
    reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:max-3,
  });
  const lmb=q.begin(S.LMB,1);
  assert.equal(lmb.sequence,max-3);
  const before=q.snapshot;
  // Only three valid sequence numbers remain. A new KeyE PRESS/terminal
  // PLUS this existing unupgraded LMB UPGRADE/terminal requires FOUR.
  // Previous source calculation counted only three and let KeyE strand
  // the already legitimate LMB heavy charge at the boundary.
  assert.throws(()=>q.begin(S.KEY_E,2),/sequence capacity exhausted/);
  assert.deepEqual(q.snapshot,before,
    "denied second-source PRESS cannot burn sequence/gesture IDs or retire LMB");
  const upgraded=q.upgrade(3);
  const release=q.release(S.LMB,4);
  assert.deepEqual([upgraded.sequence,release.sequence],[max-2,max-1]);
  assert.equal(upgraded.gestureId,lmb.gestureId);
  assert.equal(release.gestureId,lmb.gestureId);
  assert.deepEqual(q.snapshot.activeSources,[]);
  assert.equal(q.snapshot.closed,false);
});

test("near-u32 exact four remaining edges admit KeyE while LMB can still upgrade and terminate",()=>{
  const max=0xffff_ffff;
  const q=new ProposedSharedSourceGestureAllocator({
    reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:max-4,
  });
  const lmb=q.begin(S.LMB,100);
  const key=q.begin(S.KEY_E,101);
  // The order stresses reserving the other source's optional upgrade
  // even when KeyE closes BEFORE LMB upgrades.
  const keyUp=q.release(S.KEY_E,102);
  const upgraded=q.upgrade(103);
  const lmbUp=q.release(S.LMB,104);
  assert.deepEqual([lmb,key,keyUp,upgraded,lmbUp].map(x=>x.sequence),
    [max-4,max-3,max-2,max-1,max]);
  assert.deepEqual([lmb,key,keyUp,upgraded,lmbUp].map(x=>x.gestureId),
    [1,2,2,1,1]);
  assert.deepEqual([lmb,key,keyUp,upgraded,lmbUp].map(parsed).map(x=>x.sequence),
    [max-4,max-3,max-2,max-1,max]);
  assert.equal(q.snapshot.nextSequence,max+1,
    "nonwrapping exhausted u32 counter is allowed as an internal sentinel only");
  assert.deepEqual(q.snapshot.activeSources,[]);
  assert.throws(()=>q.begin(S.LMB,105),/sequence capacity exhausted/);
  assert.equal(q.snapshot.closed,true);
});

test("test-only counter seam refuses invalid values and never grants authorization",()=>{
  for(const value of [0,-1,2**32,1.5,"123",NaN]){
    assert.throws(()=>new ProposedSharedSourceGestureAllocator({
      reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:value,
    }),/test-only initial sequence/);
  }
  const q=new ProposedSharedSourceGestureAllocator({
    reviewVersion:2,trustedLease:lease(),testOnlyInitialSequence:0xffff_ffff,
  });
  assert.throws(()=>q.begin(S.KEY_E,1),/sequence capacity exhausted/,
    "starting KeyE requires PRESS and terminal, not just one last sequence");
  assert.equal(q.snapshot.nextSequence,0xffff_ffff);
  assert.equal(q.snapshot.nextGestureId,1);
  assert.equal(q.snapshot.closed,true,
    "no active source remains: an exhausted lease retires rather than wraps");
  assert.equal(q.receiveAck,undefined);
});
