import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProposedLmbGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_VERSION,
  GESTURE_ACTION,
  GESTURE_ACK_STATUS,
  decodeProposedGestureAck,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

// Byte-for-byte reviewed fixture is shared with the independent Rust ingress
// test, not computed by the Rust codec and not used by production JS/QUIC.
const fixtureText = readFileSync(new URL("./fixtures/core8a-prealpha-v2-js-rust-wire.hex", import.meta.url),"utf8");
const rows = fixtureText.trim().split(/\r?\n/).filter(x=>x && !x.startsWith("#")).map(x=>x.trim().split(/\s+/));
const fixtures = new Map(rows);
assert.equal(fixtures.size,9);
function expectWire(label,bytes) {
  const hex=Buffer.from(bytes).toString("hex");
  assert.equal(hex, fixtures.get(label), label+" byte-for-byte wire drift");
}
function open() {
  const trustedLease=Object.freeze({});
  return {trustedLease,outbox:new ProposedLmbGestureOutbox({
    trustedLease,negotiatedVersion:PROPOSED_GESTURE_VERSION,
  })};
}
test("original JS outbox emits exact Rust-consumable fast same-tick light events",()=>{
  const {outbox}=open();
  const press=outbox.begin(0x11223344);
  const release=outbox.release(0x11223344);
  assert.deepEqual([press.sequence,release.sequence],[1,2]);
  assert.equal(press.gestureId,release.gestureId);
  const sent=outbox.nextSendBatch();
  assert.equal(sent.length,2);
  expectWire("TAP_PRESS",sent[0].bytes);
  expectWire("TAP_RELEASE",sent[1].bytes);
});
test("original JS outbox emits exact Rust-consumable held heavy without client timing authority",()=>{
  const {outbox}=open();
  outbox.begin(0x55667788);
  outbox.upgrade(0x66778899);
  outbox.release(0x99aabbcc);
  const sent=outbox.nextSendBatch();
  assert.deepEqual(sent.map(x=>x.sequence),[1,2,3]);
  expectWire("HOLD_PRESS",sent[0].bytes);
  expectWire("HOLD_UPGRADE",sent[1].bytes);
  expectWire("HOLD_RELEASE",sent[2].bytes);
});
test("original JS outbox emits true CANCEL rather than synthesizing RELEASE",()=>{
  const {outbox}=open();
  outbox.begin(0);
  outbox.cancel(0);
  const sent=outbox.nextSendBatch();
  expectWire("CANCEL_PRESS",sent[0].bytes);
  expectWire("CANCEL_CANCEL",sent[1].bytes);
  assert.equal(sent.some(e=>e.bytes[2]===GESTURE_ACTION.RELEASE),false);
});
test("exact Rust ACK frames parse in original JS codec and settle transport only",()=>{
  const {outbox,trustedLease}=open();
  outbox.begin(0x11223344);
  outbox.release(0x11223344);
  const duplicate=Uint8Array.from(Buffer.from(fixtures.get("ACK_DUPLICATE_SECOND"),"hex"));
  const first=Uint8Array.from(Buffer.from(fixtures.get("ACK_ACCEPTED_FIRST"),"hex"));
  assert.deepEqual(decodeProposedGestureAck(duplicate),{
    status:GESTURE_ACK_STATUS.DUPLICATE, sequence:2, gestureId:1, serverTick:0x0a0b0c0d,
  });
  const b=outbox.receiveAck(duplicate,trustedLease);
  assert.equal(b.transportSettled,true);
  assert.equal(b.combatCommitted,false);
  const a=outbox.receiveAck(first,trustedLease);
  assert.equal(a.transportSettled,true);
  assert.equal(a.combatCommitted,false);
  assert.equal(outbox.snapshot.pending,0);
  assert.throws(()=>outbox.receiveAck(first,trustedLease),/replayed/);
});
test("review fixture is limited to original 16-byte Combat ABI, never Core8C alternative 0x52",()=>{
  for(const [label,hex] of fixtures){
    const bytes=Uint8Array.from(Buffer.from(hex,"hex"));
    assert.equal(bytes.length,16,label);
    assert.equal(bytes[0],2,label);
    assert.equal(bytes[1],label.startsWith("ACK_")?0x12:0x11,label);
    assert.equal(bytes[3],0,label);
    assert.notEqual(bytes[1],0x52,label);
  }
});
