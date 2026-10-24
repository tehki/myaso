// Core8A P0 selected source0 Combat transport. Retired source1 KeyE must
// neither allocate an edge nor consume an active physical LMB's reservations.
// No test-side ACK may authorize World damage or public QUIC activation.
import test from "node:test";
import assert from "node:assert/strict";
import {ProposedSharedTypedGestureOutbox as Outbox}
  from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_SOURCE as S, GESTURE_ACTION as A,
  decodeProposedTypedGestureEvent as decode,
  decodeProposedGestureEvent as legacyDecode,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {encodeReviewAck,REVIEW_ACK as ACK}
  from "./fixtures/core8a-one-v2-gesture-wire-review.mjs";

const lease=()=>Object.freeze({});
const queue=(token,extra={})=>new Outbox({reviewVersion:2,trustedLease:token,...extra});
const ack=(e,status=ACK.ACCEPTED)=>encodeReviewAck({
  status,sequence:e.sequence,gestureId:e.gestureId,serverTick:77,
});
const denied=fn=>assert.throws(fn,/Combat permits only physical LMB/);

test("short LMB PRESS/RELEASE in one 30Hz tick preserves two ordered typed edges and transport ACK only",()=>{
  const t=lease(),q=queue(t);
  const p=q.begin(S.LMB,42),u=q.release(S.LMB,42);
  denied(()=>q.begin(S.KEY_E,43));
  assert.deepEqual([p.sequence,u.sequence],[1,2]);
  const offered=q.nextSendBatch();
  assert.deepEqual(offered.map(x=>x.sequence),[1,2]);
  assert.deepEqual(offered.map(x=>x.gestureId),[1,1]);
  assert.deepEqual(offered.map(x=>legacyDecode(x.bytes).action),[A.PRESS,A.RELEASE]);
  for(const edge of offered){
    const receipt=q.receiveAck(ack(edge),t);
    assert.equal(receipt.transportSettled,true);
    assert.equal(receipt.combatCommitted,false);
  }
  assert.equal(q.snapshot.pending,0);
  assert.equal(q.snapshot.reservedTerminalCapacity,0);
  assert.equal(q.receiveAck(ack(p),t).alreadySettled,true);
});

test("E is denied before the LMB outbox spends sequence or reserves capacity",()=>{
  const t=lease(),q=queue(t,{maxPending:4});
  const p=q.begin(S.LMB,50),before=q.snapshot;
  denied(()=>q.begin(S.KEY_E,51));
  assert.throws(()=>q.cancel(S.KEY_E,51),/terminal requires an active/);
  assert.throws(()=>q.release(S.KEY_E,52),/terminal requires an active/);
  denied(()=>q.begin(2,51));
  assert.deepEqual(q.snapshot,before);
  const u=q.upgrade(53),end=q.release(S.LMB,54);
  assert.deepEqual([p,u,end].map(x=>x.sequence),[1,2,3]);
  assert.deepEqual([p,u,end].map(x=>x.gestureId),[1,1,1]);
  assert.deepEqual(q.nextSendBatch(3,{onlyUnsent:true}).map(x=>x.action),
    [A.PRESS,A.UPGRADE,A.RELEASE]);
  assert.equal(q.snapshot.closed,false);
  assert.deepEqual(q.snapshot.activeSources,[]);
});

test("first-send priority retains fast LMB RELEASE before older unACKed PRESS retry",()=>{
  const t=lease(),q=queue(t,{maxPending:4,maxAttempts:3});
  const press=q.begin(S.LMB,700);
  assert.equal(q.nextSendBatch(1)[0].sequence,press.sequence);
  const release=q.release(S.LMB,700);
  const fresh=q.nextSendBatch(1);
  assert.equal(fresh[0].sequence,release.sequence);
  assert.equal(fresh[0].attempt,1);
  assert.equal(q.receiveAck(ack(release),t).transportSettled,true);
  const retry=q.nextSendBatch(1);
  assert.equal(retry[0].sequence,press.sequence);
  assert.equal(retry[0].attempt,2);
  assert.equal(q.receiveAck(ack(press,ACK.DUPLICATE),t).combatCommitted,false);
});

test("terminal capacity remains reserved for genuine LMB even when E floods a full queue",()=>{
  const t=lease(),q=queue(t,{maxPending:4});
  const p=q.begin(S.LMB,100);
  for(let i=0;i<40;i++)denied(()=>q.begin(S.KEY_E,101+i));
  assert.equal(q.snapshot.pending,1);
  assert.equal(q.snapshot.reservedTerminalCapacity,2);
  const up=q.upgrade(141),last=q.release(S.LMB,142);
  assert.deepEqual([p,up,last].map(x=>x.sequence),[1,2,3]);
  assert.equal(q.snapshot.reservedTerminalCapacity,0);
  assert.equal(q.snapshot.closed,false);
  assert.throws(()=>q.begin(S.LMB,143),/terminal capacity/);
  assert.equal(q.snapshot.closed,false,"new source denial must not evict queued terminal");
});

test("ACK requires prior scheduling, exact same private lease and authentic 0x12 reserved byte",()=>{
  const t=lease(),q=queue(t),p=q.begin(S.LMB,11),u=q.release(S.LMB,12);
  assert.throws(()=>q.receiveAck(ack(p),t),/unscheduled/);
  assert.equal(q.snapshot.pending,2);
  q.nextSendBatch(1);
  assert.throws(()=>q.receiveAck(ack(p),lease()),/foreign connection/);
  assert.throws(()=>q.receiveAck(ack(u),t),/unscheduled/);
  const wrong=encodeReviewAck({
    status:ACK.ACCEPTED,sequence:p.sequence,gestureId:p.gestureId+1,serverTick:15,
  });
  assert.throws(()=>q.receiveAck(wrong,t),/does not identify/);
  const bad=ack(p);bad[3]=1;
  assert.throws(()=>q.receiveAck(bad,t),/reserved/);
  assert.equal(q.snapshot.pending,2);
  assert.equal(q.receiveAck(ack(p),t).source,S.LMB);
});

test("packet copies never mutate retry bytes; retry exhausts fail closed without Combat HIT",()=>{
  const t=lease(),q=queue(t,{maxAttempts:2});
  const p=q.begin(S.LMB,12);
  const first=q.nextSendBatch(1)[0],golden=Array.from(first.bytes);
  first.bytes.fill(0);
  const second=q.nextSendBatch(1)[0];
  assert.deepEqual(Array.from(second.bytes),golden);
  assert.throws(()=>q.nextSendBatch(1),/retransmission attempts exhausted/);
  assert.equal(q.snapshot.closed,true);
  assert.equal(q.snapshot.pending,0);
  assert.throws(()=>q.receiveAck(ack(p),t),/closed/);
  const t2=lease(),stale=queue(t2),p2=stale.begin(S.LMB,13);
  stale.nextSendBatch(1);
  const result=stale.receiveAck(ack(p2,ACK.STALE),t2);
  assert.equal(result.transportSettled,false);
  assert.equal(result.combatCommitted,false);
  assert.equal(stale.snapshot.closed,true);
});

test("retired actor lease cannot settle same numeric sequence/gesture on new actor",()=>{
  const a=lease(),b=lease(),old=queue(a),fresh=queue(b);
  const x=old.begin(S.LMB,123),y=fresh.begin(S.LMB,123);
  assert.deepEqual([x.sequence,x.gestureId],[y.sequence,y.gestureId]);
  const oldPacket=old.nextSendBatch(1)[0],newPacket=fresh.nextSendBatch(1)[0];
  assert.deepEqual(oldPacket.bytes,newPacket.bytes);
  old.retire();
  assert.throws(()=>fresh.receiveAck(ack(x),a),/foreign connection/);
  assert.equal(fresh.snapshot.pending,1);
  assert.equal(fresh.receiveAck(ack(y),b).transportSettled,true);
  assert.throws(()=>old.receiveAck(ack(x),a),/closed/);
});

test("four independent actor queues may emit identical LMB bytes but never share ACK scope",()=>{
  const tokens=Array.from({length:4},lease),queues=tokens.map(t=>queue(t));
  const edges=queues.map(q=>q.begin(S.LMB,999));
  const writes=queues.map(q=>q.nextSendBatch(1)[0].bytes);
  assert.deepEqual(writes.slice(1),[writes[0],writes[0],writes[0]]);
  for(let i=0;i<4;i++){
    assert.throws(()=>queues[i].receiveAck(ack(edges[i]),tokens[(i+1)%4]),/foreign/);
    assert.equal(queues[i].receiveAck(ack(edges[i]),tokens[i]).transportSettled,true);
  }
});

test("invalid source/version/lease/tick cannot claim capacity or forge authorization",()=>{
  const t=lease(),q=queue(t);
  denied(()=>q.begin(2,0));
  denied(()=>q.begin(S.KEY_E,1));
  assert.throws(()=>q.begin(S.LMB,-1),/diagnostic/);
  assert.equal(q.snapshot.pending,0);
  assert.throws(()=>new Outbox({reviewVersion:1,trustedLease:t}),/review version 2/);
  assert.throws(()=>new Outbox({reviewVersion:2,trustedLease:"claimed actor"}),/lease/);
  assert.equal(q.transportSend,undefined);
  assert.equal(q.combatCommitted,undefined);
});

test("delayed authentic duplicate ACK for already-settled LMB PRESS cannot strand RELEASE",()=>{
  const t=lease(),q=queue(t),p=q.begin(S.LMB,5);
  assert.equal(q.nextSendBatch(1)[0].attempt,1);
  assert.equal(q.nextSendBatch(1)[0].attempt,2);
  assert.equal(q.receiveAck(ack(p),t).transportSettled,true);
  const dup=q.receiveAck(ack(p,ACK.DUPLICATE),t);
  assert.equal(dup.transportSettled,true);
  assert.equal(dup.alreadySettled,true);
  assert.equal(dup.combatCommitted,false);
  assert.equal(q.snapshot.closed,false);
  const up=q.release(S.LMB,30);
  assert.equal(q.nextSendBatch(1)[0].action,A.RELEASE);
  assert.equal(q.receiveAck(ack(up),t).transportSettled,true);
  assert.equal(q.snapshot.pending,0);
});

test("settled ACK journal fails closed on forged identities, unexpected or negative status",()=>{
  const t=lease(),q=queue(t),p=q.begin(S.LMB,1);
  q.nextSendBatch(1);q.receiveAck(ack(p),t);
  assert.throws(()=>q.receiveAck(ack(p),lease()),/foreign connection/);
  assert.throws(()=>q.receiveAck(ack({...p,gestureId:p.gestureId+42}),t),/identify/);
  assert.throws(()=>q.receiveAck(ack({...p,sequence:p.sequence+999}),t),/replayed|unexpected/);
  assert.throws(()=>q.receiveAck(ack(p,ACK.STALE),t),/status rejected/);
  assert.throws(()=>q.receiveAck(ack(p,ACK.REJECTED),t),/status rejected/);
  assert.equal(q.snapshot.closed,false);
  const end=q.release(S.LMB,10);
  q.nextSendBatch(1);
  assert.equal(q.receiveAck(ack(end),t).transportSettled,true);
});

test("bounded ACK journal evicts stale sequences and clears all after lease retirement",()=>{
  const t=lease(),q=queue(t);let oldest,latest;
  for(let i=0;i<72;i++){
    const p=q.begin(S.LMB,i*2);
    if(i===0)oldest=p;
    q.nextSendBatch(1);
    assert.equal(q.receiveAck(ack(p),t).transportSettled,true);
    const terminal=q.release(S.LMB,i*2+1);
    q.nextSendBatch(1);
    assert.equal(q.receiveAck(ack(terminal),t).transportSettled,true);
    latest=terminal;
    assert.ok(q.snapshot.settledReceipts<=64);
  }
  assert.equal(q.snapshot.settledReceipts,64);
  assert.throws(()=>q.receiveAck(ack(oldest,ACK.DUPLICATE),t),/replayed/);
  assert.equal(q.receiveAck(ack(latest),t).alreadySettled,true);
  q.retire();
  assert.equal(q.snapshot.settledReceipts,0);
  assert.throws(()=>q.receiveAck(ack(latest),t),/closed/);
});

test("source1 archived bytes remain unencodable and cannot be new Combat ACK correlation",()=>{
  const t=lease(),q=queue(t);
  denied(()=>q.begin(S.KEY_E,101));
  const p=q.begin(S.LMB,102);
  assert.equal(q.snapshot.nextSequence,2);
  const batch=q.nextSendBatch(4);
  assert.deepEqual(batch.map(x=>decode(x.bytes).source),[S.LMB]);
  assert.equal(q.receiveAck(ack(p),t).combatCommitted,false);
  assert.equal(q.snapshot.nextSequence,2);
});
