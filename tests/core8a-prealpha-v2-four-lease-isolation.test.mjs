import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ProposedLmbGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_VERSION, GESTURE_ACK_STATUS,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const golden=readFileSync(new URL("./fixtures/core8a-prealpha-v2-js-rust-wire.hex",import.meta.url),"utf8")
  .split(/\r?\n/).filter(x=>x&& !x.startsWith("#")).map(x=>x.trim().split(/\s+/));
const fixed=label=>{
  const entries=golden.filter(row=>row[0]===label);
  assert.equal(entries.length,1,"original immutable fixture must be unambiguous");
  return entries[0][1];
};
function accepted({sequence,gestureId},status=GESTURE_ACK_STATUS.ACCEPTED){
  const bytes=new Uint8Array(16),v=new DataView(bytes.buffer);
  bytes[0]=2;bytes[1]=0x12;bytes[2]=status;
  v.setUint32(4,sequence,true);v.setUint32(8,gestureId,true);
  v.setUint32(12,44,true);
  return bytes;
}
function session(){
  const trustedLease=Object.freeze({});
  const q=new ProposedLmbGestureOutbox({
    negotiatedVersion:PROPOSED_GESTURE_VERSION,trustedLease,
  });
  const press=q.begin(0x11223344),release=q.release(0x11223344);
  return {trustedLease,q,press,release};
}
test("four original JS outboxes share identical event bytes but never share a lease ACK",()=>{
  const actors=Array.from({length:4},session);
  const batches=actors.map(a=>a.q.nextSendBatch());
  assert.equal(batches.length,4);
  for(const [i,a] of actors.entries()){
    assert.deepEqual([a.press.sequence,a.release.sequence],[1,2]);
    assert.equal(a.press.gestureId,1);
    assert.equal(a.release.gestureId,1);
    assert.equal(Buffer.from(batches[i][0].bytes).toString("hex"),fixed("TAP_PRESS"));
    assert.equal(Buffer.from(batches[i][1].bytes).toString("hex"),fixed("TAP_RELEASE"));
    assert.equal(a.q.snapshot.pending,2);
  }
  // Identical seq/gesture/event byte patterns are common across independently
  // admitted connections. Transport origin MUST never be inferred from them.
  for(let i=0;i<actors.length;i++){
    const a=actors[i],foreign=actors[(i+1)%actors.length];
    assert.throws(()=>a.q.receiveAck(accepted(a.press),foreign.trustedLease),/cross-lease/);
    assert.throws(()=>a.q.receiveAck(accepted(a.release),foreign.trustedLease),/cross-lease/);
    assert.equal(a.q.snapshot.pending,2);
  }
  for(const a of actors){
    const later=a.q.receiveAck(accepted(a.release),a.trustedLease);
    assert.equal(later.transportSettled,true);
    assert.equal(later.combatCommitted,false);
    assert.equal(a.q.snapshot.pending,1);
  }
  for(const a of actors){
    const first=a.q.receiveAck(accepted(a.press,GESTURE_ACK_STATUS.DUPLICATE),a.trustedLease);
    assert.equal(first.transportSettled,true);
    assert.equal(first.combatCommitted,false);
    assert.equal(a.q.snapshot.pending,0);
    assert.throws(()=>a.q.receiveAck(accepted(a.press),a.trustedLease),/replayed/);
  }
});
test("reusing sequence one after reconnect still requires a newly owned session token",()=>{
  const old=session();
  old.q.nextSendBatch();
  old.q.closeLease();
  const fresh=session();
  fresh.q.nextSendBatch();
  assert.equal(fresh.press.sequence,old.press.sequence);
  assert.equal(fresh.press.gestureId,old.press.gestureId);
  assert.throws(()=>fresh.q.receiveAck(accepted(old.press),old.trustedLease),/cross-lease/);
  assert.equal(fresh.q.snapshot.pending,2);
  assert.equal(fresh.q.receiveAck(accepted(fresh.press),fresh.trustedLease).combatCommitted,false);
  assert.equal(fresh.q.receiveAck(accepted(fresh.release),fresh.trustedLease).transportSettled,true);
  assert.equal(fresh.q.snapshot.pending,0);
  // This proves only object-token partitioning in the dormant client model.
  // Actual authenticated QUIC origin and Core8C actor epoch remain missing.
});
