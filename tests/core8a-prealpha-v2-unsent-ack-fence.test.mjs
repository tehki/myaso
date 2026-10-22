import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ProposedLmbGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_VERSION,GESTURE_ACK_STATUS,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const newLease=()=>Object.freeze({});
const outbox=lease=>new ProposedLmbGestureOutbox({
  negotiatedVersion:PROPOSED_GESTURE_VERSION,trustedLease:lease,
});
function acknowledged(event,status=GESTURE_ACK_STATUS.ACCEPTED){
  const bytes=new Uint8Array(16),wire=new DataView(bytes.buffer);
  wire.setUint8(0,2);
  wire.setUint8(1,0x12);
  wire.setUint8(2,status);
  wire.setUint32(4,event.sequence,true);
  wire.setUint32(8,event.gestureId,true);
  wire.setUint32(12,12345,true);
  return bytes;
}

test("an enqueued-but-never-scheduled PRESS cannot be settled by a correlated ACK",()=>{
  const lease=newLease(),queue=outbox(lease);
  const press=queue.begin(7),release=queue.release(7);
  assert.throws(()=>queue.receiveAck(acknowledged(press),lease),/unscheduled/);
  assert.equal(queue.snapshot.pending,2);
  assert.equal(queue.snapshot.closed,false);
  assert.deepEqual(queue.nextSendBatch().map(x=>x.sequence),[press.sequence,release.sequence]);
  const first=queue.receiveAck(acknowledged(press),lease);
  const last=queue.receiveAck(acknowledged(release),lease);
  assert.equal(first.transportSettled,true);
  assert.equal(last.transportSettled,true);
  assert.equal(first.combatCommitted,false);
  assert.equal(last.combatCommitted,false);
  assert.equal(queue.snapshot.pending,0);
});

test("scheduling only PRESS does not authorize an unrelated unscheduled RELEASE ACK",()=>{
  const lease=newLease(),queue=outbox(lease);
  const press=queue.begin(1),release=queue.release(1);
  const first=queue.nextSendBatch(1);
  assert.equal(first.length,1);
  assert.equal(first[0].sequence,press.sequence);
  assert.throws(()=>queue.receiveAck(acknowledged(release),lease),/unscheduled/);
  assert.equal(queue.snapshot.pending,2);
  const second=queue.nextSendBatch(2);
  assert.deepEqual(second.map(x=>x.sequence),[press.sequence,release.sequence]);
  assert.equal(second[0].attempt,2);
  assert.equal(second[1].attempt,1);
  const settledRelease=queue.receiveAck(acknowledged(release),lease);
  assert.equal(settledRelease.combatCommitted,false);
  assert.equal(queue.receiveAck(acknowledged(press),lease).transportSettled,true);
  assert.equal(queue.snapshot.pending,0);
});

test("a never-scheduled STALE or REJECTED status cannot silently close and discard edges",()=>{
  for(const status of [GESTURE_ACK_STATUS.STALE,GESTURE_ACK_STATUS.REJECTED]){
    const lease=newLease(),queue=outbox(lease);
    const press=queue.begin(),release=queue.release();
    assert.throws(()=>queue.receiveAck(acknowledged(release,status),lease),/unscheduled/);
    assert.equal(queue.snapshot.closed,false);
    assert.equal(queue.snapshot.pending,2);
    queue.nextSendBatch();
    const rejected=queue.receiveAck(acknowledged(release,status),lease);
    assert.equal(rejected.transportSettled,false);
    assert.equal(rejected.combatCommitted,false);
    assert.equal(queue.snapshot.closed,true);
    assert.equal(queue.snapshot.pending,1);
    assert.throws(()=>queue.receiveAck(acknowledged(press),lease),/closed/);
  }
});

test("same-lease and unscheduled checks cannot be bypassed by token, sequence, or v1 imports",()=>{
  const lease=newLease(),queue=outbox(lease);
  const press=queue.begin();
  assert.throws(()=>queue.receiveAck(acknowledged(press),newLease()),/cross-lease/);
  assert.throws(()=>queue.receiveAck(acknowledged({...press,sequence:55}),lease),/unexpected/);
  assert.throws(()=>queue.receiveAck(acknowledged({...press,gestureId:999}),lease),/identity/);
  assert.throws(()=>queue.receiveAck(acknowledged(press,GESTURE_ACK_STATUS.DUPLICATE),lease),/unscheduled/);
  assert.equal(queue.snapshot.pending,1);
  const production=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(production,/prealpha-lmb-gesture-outbox-proposal/);
  assert.doesNotMatch(server,/prealpha_lmb_ingress_review/);
});

test("fast PRESS then RELEASE both receive first send opportunity with batch limit one before retries",()=>{
  const lease=newLease();
  const queue=new ProposedLmbGestureOutbox({
    negotiatedVersion:PROPOSED_GESTURE_VERSION,trustedLease:lease,maxAttempts:1,
  });
  const press=queue.begin(7),release=queue.release(7);
  const one=queue.nextSendBatch(1);
  const two=queue.nextSendBatch(1);
  assert.deepEqual(one.map(x=>[x.sequence,x.attempt]),[[press.sequence,1]]);
  assert.deepEqual(two.map(x=>[x.sequence,x.attempt]),[[release.sequence,1]]);
  assert.equal(queue.receiveAck(acknowledged(release),lease).combatCommitted,false);
  assert.equal(queue.receiveAck(acknowledged(press),lease).transportSettled,true);
  assert.equal(queue.snapshot.pending,0);
});

test("held gesture PRESS, UPGRADE and RELEASE all offered in sequence even at batch limit one",()=>{
  const lease=newLease(),queue=new ProposedLmbGestureOutbox({
    negotiatedVersion:PROPOSED_GESTURE_VERSION,trustedLease:lease,maxAttempts:1,
  });
  const press=queue.begin(7),upgrade=queue.upgrade(8),release=queue.release(9);
  const sends=[queue.nextSendBatch(1),queue.nextSendBatch(1),queue.nextSendBatch(1)];
  assert.deepEqual(sends.map(batch=>[batch[0].sequence,batch[0].attempt]),[
    [press.sequence,1],[upgrade.sequence,1],[release.sequence,1],
  ]);
  assert.equal(queue.snapshot.pending,3);
  assert.throws(()=>queue.nextSendBatch(1),/retransmission exhausted/);
  assert.equal(queue.snapshot.closed,true);
  assert.equal(queue.snapshot.pending,3);
});

test("small batches send all first attempts before repeated retransmit, while each batch remains in sequence order",()=>{
  const lease=newLease(),queue=outbox(lease);
  const press=queue.begin(),upgrade=queue.upgrade(),release=queue.release();
  assert.deepEqual(queue.nextSendBatch(1).map(x=>[x.sequence,x.attempt]),[[press.sequence,1]]);
  assert.deepEqual(queue.nextSendBatch(2).map(x=>[x.sequence,x.attempt]),[
    [upgrade.sequence,1],[release.sequence,1],
  ]);
  assert.deepEqual(queue.nextSendBatch(2).map(x=>[x.sequence,x.attempt]),[
    [press.sequence,2],[upgrade.sequence,2],
  ]);
  assert.equal(queue.receiveAck(acknowledged(release),lease).transportSettled,true);
  assert.equal(queue.receiveAck(acknowledged(press),lease).transportSettled,true);
  assert.equal(queue.receiveAck(acknowledged(upgrade),lease).transportSettled,true);
  assert.equal(queue.snapshot.pending,0);
});

test("two distinct quick taps drain first presses and releases before retrying older event",()=>{
  const lease=newLease(),queue=new ProposedLmbGestureOutbox({
    negotiatedVersion:PROPOSED_GESTURE_VERSION,trustedLease:lease,maxPending:8,maxAttempts:1,
  });
  const a=queue.begin(),b=queue.release(),c=queue.begin(),d=queue.release();
  const result=[queue.nextSendBatch(1),queue.nextSendBatch(1),queue.nextSendBatch(1),queue.nextSendBatch(1)];
  assert.deepEqual(result.map(x=>[x[0].sequence,x[0].attempt]),[
    [a.sequence,1],[b.sequence,1],[c.sequence,1],[d.sequence,1],
  ]);
  assert.throws(()=>queue.nextSendBatch(1),/retransmission exhausted/);
  assert.equal(queue.snapshot.pending,4);
});
