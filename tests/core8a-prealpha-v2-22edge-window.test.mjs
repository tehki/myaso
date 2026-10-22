import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ProposedLmbGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_VERSION,
  GESTURE_ACTION,
  GESTURE_ACK_STATUS,
  decodeProposedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const rows=readFileSync(new URL("./fixtures/core8a-prealpha-v2-22edge-window.hex",import.meta.url),"utf8")
  .split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"))
  .map(line=>{
    const [seq,action,hex]=line.split(/\s+/);
    assert.match(hex,/^[0-9a-f]{32}$/);
    return Object.freeze({seq:Number(seq),action,hex});
  });
function ack(record,status=GESTURE_ACK_STATUS.ACCEPTED){
  const b=new Uint8Array(16),v=new DataView(b.buffer);
  b[0]=2;b[1]=0x12;b[2]=status;
  v.setUint32(4,record.seq,true);
  v.setUint32(8,Math.ceil(record.seq/2),true);
  v.setUint32(12,77,true);
  return b;
}
function actualOutbox(){
  const lease=Object.freeze({});
  return {lease,q:new ProposedLmbGestureOutbox({
    trustedLease:lease,negotiatedVersion:PROPOSED_GESTURE_VERSION,
    maxPending:32,maxAttempts:8,
  })};
}
function matches(row,emitted){
  assert.equal(emitted.sequence,row.seq);
  assert.equal(Buffer.from(emitted.bytes).toString("hex"),row.hex,
    "original JS outbox drift from independently shared Rust fixture seq"+row.seq);
  const decoded=decodeProposedGestureEvent(emitted.bytes);
  assert.equal(decoded.action,row.action==="PRESS"?GESTURE_ACTION.PRESS:GESTURE_ACTION.RELEASE);
  assert.equal(decoded.gestureId,Math.ceil(row.seq/2));
  assert.equal(decoded.clientTick,0x1100+Math.floor((row.seq-1)/2));
}
test("22 original JS fast-click bytes match independent Rust fixture and never exceed MAX_GAP=16",()=>{
  assert.equal(rows.length,22);
  const {lease,q}=actualOutbox();
  for(let i=0;i<11;i++){
    const press=q.begin(0x1100+i),release=q.release(0x1100+i);
    assert.equal(press.sequence,2*i+1);
    assert.equal(release.sequence,2*i+2);
    assert.equal(press.gestureId,release.gestureId);
  }
  assert.equal(q.snapshot.pending,22);
  const first=q.nextSendBatch(32);
  assert.equal(first.length,17);
  first.forEach((emitted,i)=>matches(rows[i],emitted));
  assert.throws(()=>q.receiveAck(ack(rows[17]),lease),/unscheduled/);
  assert.equal(q.receiveAck(ack(rows[16]),lease).transportSettled,true);
  assert.throws(()=>q.receiveAck(ack(rows[17]),lease),/unscheduled/);
  const retry=q.nextSendBatch(1);
  matches(rows[0],retry[0]);
  assert.equal(retry[0].attempt,2);
  assert.equal(q.receiveAck(ack(rows[0]),lease).combatCommitted,false);
  // Each oldest-ACK advances one sequence. Unsent first attempts always
  // take priority over retransmissions without trusting client timestamps.
  for(let seq=18;seq<=22;seq++){
    const [only]=q.nextSendBatch(1);
    matches(rows[seq-1],only);
    assert.equal(only.attempt,1);
    assert.equal(q.receiveAck(ack(rows[seq-1]),lease).transportSettled,true);
    if(seq<22){
      const low=seq-16;
      assert.equal(q.receiveAck(ack(rows[low-1]),lease).combatCommitted,false);
    }
  }
  assert.equal(q.snapshot.closed,false);
});
test("the fixture enforces unchanged v2 type and alternating same-tick terminal identity",()=>{
  assert.equal(rows.length,22);
  for(let i=0;i<11;i++){
    const p=rows[2*i],r=rows[2*i+1];
    assert.equal(p.action,"PRESS");
    assert.equal(r.action,"RELEASE");
    const pp=Buffer.from(p.hex,"hex"),rr=Buffer.from(r.hex,"hex");
    assert.equal(pp.length,16);assert.equal(rr.length,16);
    assert.deepEqual([...pp.slice(0,2)],[2,0x11]);
    assert.deepEqual([...rr.slice(0,2)],[2,0x11]);
    assert.equal(pp[3],0);assert.equal(rr[3],0);
    assert.deepEqual([...pp.slice(8,16)],[...rr.slice(8,16)]);
    assert.equal(new DataView(pp.buffer,pp.byteOffset,pp.byteLength).getUint32(4,true),2*i+1);
    assert.equal(new DataView(rr.buffer,rr.byteOffset,rr.byteLength).getUint32(4,true),2*i+2);
  }
});
