import test from "node:test";
import assert from "node:assert/strict";
import {
  ProposedSharedTypedGestureOutbox,
} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_SOURCE as S,
  GESTURE_ACTION as A,
  decodeProposedTypedGestureEvent,
  decodeProposedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {encodeReviewAck, REVIEW_ACK as ACK} from "./fixtures/core8a-one-v2-gesture-wire-review.mjs";

const lease=()=>Object.freeze({});
const newQueue=(token, extras={})=>
  new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:token,...extras});
const ack=(event,status=ACK.ACCEPTED)=>encodeReviewAck({
  status,sequence:event.sequence,gestureId:event.gestureId,serverTick:77,
});

test("two LMB edges inside one 30Hz client tick survive actual typed queue and old codec",()=>{
  const token=lease(),q=newQueue(token);
  const press=q.begin(S.LMB,42);
  const up=q.release(S.LMB,42);
  assert.deepEqual([press.sequence,up.sequence],[1,2]);
  const offered=q.nextSendBatch();
  assert.deepEqual(offered.map(e=>e.sequence),[1,2]);
  assert.deepEqual(offered.map(e=>e.gestureId),[1,1]);
  assert.deepEqual(offered.map(e=>decodeProposedGestureEvent(e.bytes).action),[A.PRESS,A.RELEASE]);
  for(const event of offered) {
    const receipt=q.receiveAck(ack(event),token);
    assert.equal(receipt.transportSettled,true);
    assert.equal(receipt.combatCommitted,false);
  }
  assert.equal(q.snapshot.pending,0);
  assert.equal(q.snapshot.reservedTerminalCapacity,0);
  assert.throws(()=>q.receiveAck(ack(press),token),/replayed/);
});

test("one sequence/gesture namespace spans interleaved LMB and KeyE, ACK source inferred only from pending",()=>{
  const token=lease(),q=newQueue(token);
  const events=[
    q.begin(S.LMB,50),
    q.begin(S.KEY_E,50),
    q.release(S.KEY_E,50),
    q.upgrade(50),
    q.release(S.LMB,51),
  ];
  assert.deepEqual(events.map(e=>e.sequence),[1,2,3,4,5]);
  assert.deepEqual(events.map(e=>e.gestureId),[1,2,2,1,1]);
  const all=q.nextSendBatch(5);
  assert.deepEqual(all.map(e=>e.source),[0,1,1,0,0]);
  assert.deepEqual(all.map(e=>decodeProposedTypedGestureEvent(e.bytes).action),[1,1,3,2,3]);
  assert.throws(()=>decodeProposedGestureEvent(all[1].bytes),/reserved/,
    "old live-disabled codec must still refuse KeyE");
  assert.equal(q.receiveAck(ack(events[3]),token).source,S.LMB);
  assert.equal(q.receiveAck(ack(events[2]),token).source,S.KEY_E);
  for(const e of [events[0],events[1],events[4]]) q.receiveAck(ack(e),token);
  assert.equal(q.snapshot.pending,0);
  assert.deepEqual(q.snapshot.activeSources,[]);
});

test("first-send fairness reserves a fast RELEASE while older PRESS is unACKed",()=>{
  const token=lease(),q=newQueue(token,{maxPending:4,maxAttempts:3});
  const p=q.begin(S.LMB,700);
  assert.deepEqual(q.nextSendBatch(1).map(e=>e.sequence),[p.sequence]);
  const release=q.release(S.LMB,700);
  const batch=q.nextSendBatch(1);
  assert.deepEqual(batch.map(e=>e.sequence),[release.sequence],
    "fresh terminal must not starve behind earlier press retry");
  assert.equal(batch[0].attempt,1);
  assert.equal(q.receiveAck(ack(release),token).transportSettled,true);
  const retry=q.nextSendBatch(1);
  assert.equal(retry[0].sequence,p.sequence);
  assert.equal(retry[0].attempt,2);
  assert.equal(q.receiveAck(ack(p,ACK.DUPLICATE),token).combatCommitted,false);
});

test("one bounded queue reserves OTHER active source terminals even at maxPending",()=>{
  const token=lease(),q=newQueue(token,{maxPending:5});
  const p=q.begin(S.LMB,100);
  const key=q.begin(S.KEY_E,101);
  assert.equal(q.snapshot.pending,2);
  assert.equal(q.snapshot.reservedTerminalCapacity,3);
  assert.throws(()=>q.begin(S.KEY_E,102),/already owns/);
  q.release(S.KEY_E,103);
  const up=q.upgrade(104);
  const last=q.release(S.LMB,105);
  assert.deepEqual([p,key,up,last].map(e=>e.sequence),[1,2,4,5]);
  assert.equal(q.snapshot.pending,5);
  assert.equal(q.snapshot.reservedTerminalCapacity,0);
  assert.throws(()=>q.begin(S.LMB,106),/terminal capacity/,
    "a new press must not invalidate already queued terminal edges");
  assert.equal(q.snapshot.closed,false,
    "rejecting a new press cannot invalidate valid pending source histories");
});

test("ACK requires actual prior scheduling, same token and valid original 0x12 reserved byte",()=>{
  const token=lease(),q=newQueue(token);
  const p=q.begin(S.KEY_E,11);
  const u=q.release(S.KEY_E,12);
  assert.throws(()=>q.receiveAck(ack(p),token),/unscheduled/);
  assert.equal(q.snapshot.pending,2);
  q.nextSendBatch(1);
  assert.throws(()=>q.receiveAck(ack(p),lease()),/foreign connection/);
  assert.throws(()=>q.receiveAck(ack(u),token),/unscheduled/);
  const wrongGesture=encodeReviewAck({
    status:ACK.ACCEPTED,sequence:p.sequence,gestureId:p.gestureId+1,serverTick:15,
  });
  assert.throws(()=>q.receiveAck(wrongGesture,token),/does not identify/);
  const malformed=ack(p);malformed[3]=1;
  assert.throws(()=>q.receiveAck(malformed,token),/reserved/);
  assert.equal(q.snapshot.pending,2);
  const result=q.receiveAck(ack(p),token);
  assert.equal(result.source,S.KEY_E);
  assert.equal(result.combatCommitted,false);
});

test("copy mutation, finite retries and stale/rejected ACK always fail closed without hit",()=>{
  const token=lease(),q=newQueue(token,{maxAttempts:2});
  const p=q.begin(S.KEY_E,12);
  const first=q.nextSendBatch(1)[0];
  const golden=Array.from(first.bytes);
  first.bytes.fill(0);
  const second=q.nextSendBatch(1)[0];
  assert.deepEqual(Array.from(second.bytes),golden,
    "mutable returned copy cannot alter original pending packet");
  assert.throws(()=>q.nextSendBatch(1),/retransmission attempts exhausted/);
  assert.equal(q.snapshot.closed,true);
  assert.equal(q.snapshot.pending,0);
  assert.throws(()=>q.receiveAck(ack(p),token),/closed/);

  const validToken=lease(),stale=newQueue(validToken);
  const p2=stale.begin(S.LMB,13);
  stale.nextSendBatch(1);
  const status=stale.receiveAck(ack(p2,ACK.STALE),validToken);
  assert.equal(status.transportSettled,false);
  assert.equal(status.combatCommitted,false);
  assert.equal(stale.snapshot.closed,true);
  assert.equal(stale.snapshot.pending,0);
});

test("retired same-number lease cannot settle another lease's identical wire bytes",()=>{
  const a=lease(),b=lease();
  const old=newQueue(a),newer=newQueue(b);
  const x=old.begin(S.KEY_E,123),y=newer.begin(S.KEY_E,123);
  assert.equal(x.sequence,y.sequence);
  assert.equal(x.gestureId,y.gestureId);
  const oldPacket=old.nextSendBatch(1)[0];
  const newerPacket=newer.nextSendBatch(1)[0];
  assert.deepEqual(oldPacket.bytes,newerPacket.bytes);
  old.retire();
  assert.throws(()=>newer.receiveAck(ack(x),a),/foreign connection/);
  assert.equal(newer.snapshot.pending,1);
  assert.equal(newer.receiveAck(ack(y),b).transportSettled,true);
  assert.throws(()=>old.receiveAck(ack(x),a),/closed/);
});

test("four independent typed outboxes can emit identical KeyE bytes with no cross-account ACK",()=>{
  const tokens=Array.from({length:4},()=>lease());
  const queues=tokens.map(t=>newQueue(t));
  const edge=queues.map(q=>q.begin(S.KEY_E,999));
  const packets=queues.map(q=>q.nextSendBatch(1)[0].bytes);
  assert.deepEqual(packets.slice(1),[packets[0],packets[0],packets[0]]);
  for(let i=0;i<4;i++){
    const foreign=tokens[(i+1)%4];
    assert.throws(()=>queues[i].receiveAck(ack(edge[i]),foreign),/foreign/);
    assert.equal(queues[i].receiveAck(ack(edge[i]),tokens[i]).transportSettled,true);
  }
});

test("reject invalid version, forged lease and unknown source without mutating queue",()=>{
  const token=lease(),q=newQueue(token);
  assert.throws(()=>q.begin(2,0),/unknown typed/);
  assert.throws(()=>q.begin(S.LMB,-1),/diagnostic/);
  assert.equal(q.snapshot.pending,0);
  assert.throws(()=>new ProposedSharedTypedGestureOutbox({
    reviewVersion:1,trustedLease:token,
  }),/review version 2/);
  assert.throws(()=>new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:"self-declared",
  }),/opaque current review lease/);
  assert.equal(q.transportSend,undefined);
  assert.equal(q.combatCommitted,undefined);
});

test("late same-lease ACK for already-settled retried KeyE PRESS must not strand authentic RELEASE",()=>{
  const token=lease(),q=newQueue(token);
  const press=q.begin(S.KEY_E,5);
  assert.equal(q.nextSendBatch(1)[0].attempt,1);
  assert.equal(q.nextSendBatch(1)[0].attempt,2,
    "real Core8A bounded retry retransmits original PRESS before first ACK arrives");
  const original=q.receiveAck(ack(press,ACK.ACCEPTED),token);
  assert.equal(original.transportSettled,true);
  assert.equal(original.combatCommitted,false);
  const delayed=q.receiveAck(ack(press,ACK.DUPLICATE),token);
  assert.equal(delayed.transportSettled,true,
    "same-lease ACK for an authenticated already-settled edge cannot retire active KeyE");
  assert.equal(delayed.alreadySettled,true,"idempotent duplicate ACK is not new World admission");
  assert.equal(delayed.combatCommitted,false);
  assert.equal(q.snapshot.closed,false);
  const physicalRelease=q.release(S.KEY_E,30);
  assert.equal(q.nextSendBatch(1)[0].action,A.RELEASE);
  assert.equal(q.receiveAck(ack(physicalRelease),token).transportSettled,true);
  assert.equal(q.snapshot.pending,0);
});

test("settled ACK replay scope rejects forged IDs, stale status, and cross-lease ACK",()=>{
  const token=lease(),q=newQueue(token);
  const p=q.begin(S.KEY_E,1);
  q.nextSendBatch(1);
  q.receiveAck(ack(p),token);
  assert.throws(()=>q.receiveAck(ack(p),lease()),/foreign connection/);
  assert.throws(()=>q.receiveAck(ack({...p,gestureId:p.gestureId+42}),token),/gesture|identify|replayed/i);
  assert.throws(()=>q.receiveAck(ack({...p,sequence:p.sequence+999}),token),/replayed|unexpected/);
  assert.throws(()=>q.receiveAck(ack(p,ACK.STALE),token),/stale|replay|unexpected|status/i);
  assert.throws(()=>q.receiveAck(ack(p,ACK.REJECTED),token),/reject|replay|unexpected|status/i);
  assert.equal(q.snapshot.closed,false,
    "invalid second receipt must not authorize damage or erase existing active KeyE");
  const r=q.release(S.KEY_E,10);
  q.nextSendBatch(1);
  assert.equal(q.receiveAck(ack(r),token).transportSettled,true);
});
