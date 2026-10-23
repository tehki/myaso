import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  PROPOSED_GESTURE_VERSION,GESTURE_ACTION,GESTURE_ACK_STATUS,
  decodeProposedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {ProposedLmbGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";

const token=()=>Object.freeze({});
const open=(lease=token(),params={})=>new ProposedLmbGestureOutbox({
  negotiatedVersion:PROPOSED_GESTURE_VERSION,trustedLease:lease,...params,
});
function ack({status=GESTURE_ACK_STATUS.ACCEPTED,sequence,gestureId,serverTick=321}){
  const b=new Uint8Array(16),v=new DataView(b.buffer);
  v.setUint8(0,2);v.setUint8(1,0x12);v.setUint8(2,status);
  v.setUint32(4,sequence,true);v.setUint32(8,gestureId,true);
  v.setUint32(12,serverTick,true);
  return b;
}
const decode=batch=>batch.map(x=>decodeProposedGestureEvent(x.bytes));

test("explicit v2 and opaque current QUIC lease are required, never fall back to v1 silently",()=>{
  assert.throws(()=>new ProposedLmbGestureOutbox({trustedLease:token()}),/negotiated/);
  assert.throws(()=>new ProposedLmbGestureOutbox({trustedLease:token(),negotiatedVersion:1}),/negotiated/);
  assert.throws(()=>new ProposedLmbGestureOutbox({trustedLease:"untrusted-client",negotiatedVersion:2}),/opaque/);
  assert.throws(()=>open(token(),{maxPending:3}),/out of bounds/);
  assert.throws(()=>open(token(),{maxPending:257}),/out of bounds/);
});

test("sub-30Hz tap keeps both ordered PRESS and RELEASE even if zero input samples saw held LMB",()=>{
  const q=open();
  const press=q.begin(42),release=q.release(42);
  assert.equal(press.gestureId,release.gestureId);
  assert.equal(release.sequence,press.sequence+1);
  assert.deepEqual(decode(q.nextSendBatch()),[
    {action:GESTURE_ACTION.PRESS,sequence:press.sequence,gestureId:press.gestureId,clientTick:42},
    {action:GESTURE_ACTION.RELEASE,sequence:release.sequence,gestureId:release.gestureId,clientTick:42},
  ]);
  assert.equal(q.snapshot.pending,2);
});

test("hold upgrades only the SAME nonterminal gesture; second gesture has new monotonic identity",()=>{
  const q=open();
  const p=q.begin(1),u=q.upgrade(2),r=q.release(3);
  assert.equal(p.gestureId,u.gestureId);assert.equal(u.gestureId,r.gestureId);
  assert.deepEqual(decode(q.nextSendBatch()).map(x=>x.action),
    [GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE]);
  assert.throws(()=>q.release(4),/no active/);
  assert.throws(()=>q.upgrade(4),/not-yet-upgraded/);
  const next=q.begin(5);
  assert.equal(next.gestureId,p.gestureId+1);
  assert.equal(next.sequence,r.sequence+1);
  assert.throws(()=>q.begin(6),/terminate/);
  assert.throws(()=>q.upgrade(-1),/clientTick/);
});

test("cancel terminates current edge without synthesizing a RELEASE or a Combat hit",()=>{
  const q=open();const p=q.begin(),c=q.cancel();
  assert.equal(p.gestureId,c.gestureId);
  assert.deepEqual(decode(q.nextSendBatch()).map(x=>x.action),
    [GESTURE_ACTION.PRESS,GESTURE_ACTION.CANCEL]);
  assert.throws(()=>q.cancel(),/no active/);
  assert.throws(()=>q.release(),/no active/);
});

test("ACKs only settle exact event+gesture on correct bound connection and cannot prove a hit",()=>{
  const lease=token(),q=open(lease);
  const p=q.begin(),r=q.release();
  assert.throws(()=>q.receiveAck(ack(p),token()),/cross-lease/);
  assert.throws(()=>q.receiveAck(ack({...p,gestureId:p.gestureId+1}),lease),/does not match/);
  assert.throws(()=>q.receiveAck(ack({...p,sequence:777}),lease),/unexpected/);
  const last=q.receiveAck(ack(r),lease);
  assert.equal(last.transportSettled,true);
  assert.equal(last.combatCommitted,false);
  assert.equal(last.serverTick,321);
  assert.equal(q.snapshot.pending,1);
  assert.throws(()=>q.receiveAck(ack(r),lease),/replayed/);
  const first=q.receiveAck(ack({...p,status:GESTURE_ACK_STATUS.DUPLICATE}),lease);
  assert.equal(first.transportSettled,true);
  assert.equal(first.combatCommitted,false);
  assert.equal(q.snapshot.pending,0);
});

test("late and invalid server ACKs fail closed, do not invent accepted action",()=>{
  const lease=token(),q=open(lease),p=q.begin();
  const bad=ack(p);bad[3]=1;
  assert.throws(()=>q.receiveAck(bad,lease),/reserved/);
  const outcome=q.receiveAck(ack({...p,status:GESTURE_ACK_STATUS.STALE}),lease);
  assert.equal(outcome.transportSettled,false);
  assert.equal(outcome.combatCommitted,false);
  assert.equal(q.snapshot.closed,true);
  assert.throws(()=>q.begin(),/closed/);
  const rejectLease=token(),reject=open(rejectLease);const x=reject.begin();
  assert.equal(reject.receiveAck(ack({...x,status:GESTURE_ACK_STATUS.REJECTED}),rejectLease).transportSettled,false);
  assert.equal(reject.snapshot.closed,true);
});
test("reserved terminal edge capacity never drops a pending RELEASE under a full outbound window",()=>{
  const lease=token(),q=open(lease,{maxPending:4});
  const p=q.begin(),u=q.upgrade(),r=q.release();
  assert.deepEqual([p.sequence,u.sequence,r.sequence],[1,2,3]);
  assert.throws(()=>q.begin(),/edge capacity/);
  assert.equal(q.snapshot.closed,true); // needs fresh authenticated lease, never silent loss
  // The already-retained press, upgrade and release were not silently removed.
  assert.equal(q.snapshot.pending,3);
});

test("bounded resend keeps exact event bytes, stops instead of discarding an unACKed edge",()=>{
  const q=open(token(),{maxAttempts:2}),p=q.begin();
  const first=q.nextSendBatch();
  first[0].bytes[2]=99; // caller cannot mutate immutable canonical pending payload
  const second=q.nextSendBatch();
  assert.equal(decodeProposedGestureEvent(second[0].bytes).action,GESTURE_ACTION.PRESS);
  assert.equal(second[0].attempt,2);
  assert.throws(()=>q.nextSendBatch(),/retransmission exhausted/);
  assert.equal(q.snapshot.closed,true);
  assert.equal(q.snapshot.pending,1);
  assert.equal(p.sequence,1);
});

test("old connection ACKs cannot clear new lease's coincident sequence after reconnect",()=>{
  const formerLease=token(),old=open(formerLease),p=old.begin();
  old.closeLease();
  assert.equal(old.snapshot.pending,0);
  const newLease=token(),fresh=open(newLease),newPress=fresh.begin();
  assert.equal(newPress.sequence,p.sequence); // numeric IDs alone cannot fence sessions
  assert.throws(()=>fresh.receiveAck(ack(p),formerLease),/cross-lease/);
  assert.equal(fresh.snapshot.pending,1);
  assert.equal(fresh.receiveAck(ack(newPress),newLease).transportSettled,true);
});

test("v1 browser remains isolated and reviewed Rust v2 ingress is default-off loopback only",()=>{
  const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const main=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(browser,/prealpha-lmb-gesture-outbox-proposal/);
  assert.doesNotMatch(browser,/prealpha-lmb-gesture-proposal/);
  // Main0's selected original Rust ingress is no longer an unimported fixture:
  // require its *actual* disabled-by-default + loopback-only operator gate.
  assert.match(main,/prealpha_lmb_gesture_proposal::encode_ack/);
  assert.match(main,/let v2_lab = match env::var\("MYASO_EXPERIMENTAL_GESTURE_V2"\)\.as_deref\(\)/);
  assert.match(main,/Ok\("0"\) \| Err\(_\) => false/);
  assert.match(main,/if v2_lab && !bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(main,/bail!\("experimental v2 gesture ingress is loopback-only"\)/);
  assert.doesNotMatch(main,/prealpha_lmb_gesture_outbox_proposal/);
});
