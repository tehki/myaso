import test from "node:test";
import assert from "node:assert/strict";
import {
  encodeProposedHitControl, decodeProposedHitControl, createProposedHitInbox,
  HIT_CONTROL_OP as OP, HIT_CONTROL_BYTES, HIT_CONTROL_TYPE_PROPOSAL as TYPE,
} from "../src/network/m147-hit-control-proposal.mjs";
import {encodeHitReceipt} from "../src/network/m147-hit-receipt-codec.mjs";

const lease = Uint8Array.from({length:16}, (_,i)=>i+1);
const grant = () => encodeProposedHitControl({op:OP.SERVER_GRANT,token:lease,aux:64});
const hit = (sequence,attacker=2,target=1,damage=34,targetHp=66) =>
  encodeHitReceipt({sequence,serverTick:100+sequence,attacker,target,damage,targetHp});

test("Rust/JS proposed 32B GRANT vector is identical, not a live PACKET_TYPE allocation", () => {
  const encoded = Uint8Array.from(new Uint8Array(grant()));
  assert.equal(encoded.length,HIT_CONTROL_BYTES);
  assert.equal(encoded[1],TYPE);
  assert.deepEqual([...encoded],[1,6,2,0,0,0,0,0,
    1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
    64,0,0,0,0,0,0,0]);
  const d=decodeProposedHitControl(encoded.subarray());
  assert.deepEqual({op:d.op,cursor:d.cursor,aux:d.aux},{op:OP.SERVER_GRANT,cursor:0,aux:64});
  assert.deepEqual([...d.token],[...lease]);
  assert.deepEqual([...new Uint8Array(encodeProposedHitControl({op:OP.CLIENT_HELLO}))],
    [1,6,1,0,...Array(28).fill(0)]);
});

test("strict control parsing rejects reserved, wrong version/op, missing lease, malformed capacities and roles",()=>{
  const original=new Uint8Array(grant());
  const corruption=(index,value)=>{const b=original.slice();b[index]=value;return b;};
  assert.throws(()=>decodeProposedHitControl(original.subarray(1)),/32 bytes/);
  assert.throws(()=>decodeProposedHitControl(corruption(0,2)),/version/);
  assert.throws(()=>decodeProposedHitControl(corruption(1,0x12)),/packet type/);
  assert.throws(()=>decodeProposedHitControl(corruption(2,7)),/operation/);
  assert.throws(()=>decodeProposedHitControl(corruption(3,1)),/reserved/);
  assert.throws(()=>decodeProposedHitControl(corruption(28,1)),/reserved/);
  const zeros=original.slice();zeros.fill(0,8,24);
  assert.throws(()=>decodeProposedHitControl(zeros),/current nonzero/);
  assert.throws(()=>decodeProposedHitControl(corruption(24,65)),/bounded GRANT/);
  assert.throws(()=>encodeProposedHitControl({op:OP.CLIENT_ACK,token:lease,cursor:1,aux:2}),/aux/);
  assert.throws(()=>encodeProposedHitControl({op:OP.CLIENT_HELLO,token:lease}),/HELLO/);
  assert.throws(()=>encodeProposedHitControl({op:OP.CLIENT_HELLO,cursor:1}),/HELLO/);
});

test("auth-bound three-person FFA: only attacker confirms, victim damaged, spectator has no receipt",()=>{
  const aTransport={},vTransport={},thirdTransport={};
  const attacker=[],victim=[],third=[];
  const a=createProposedHitInbox({trustedTransport:aTransport,actorId:2,
    onAttackerHit:x=>attacker.push(x),onDamageTaken:()=>assert.fail("attacker may not be victim")});
  const v=createProposedHitInbox({trustedTransport:vTransport,actorId:1,
    onDamageTaken:x=>victim.push(x),onAttackerHit:()=>assert.fail("victim may not claim hit")});
  const s=createProposedHitInbox({trustedTransport:thirdTransport,actorId:3,
    onAttackerHit:x=>third.push(x)});
  for (const [gate,origin] of [[a,aTransport],[v,vTransport],[s,thirdTransport]]) {
    assert.deepEqual(gate.acceptControl(grant(),origin),{kind:"granted",capacity:64});
  }
  const original=hit(0);
  assert.equal(a.receipt(original,aTransport).kind,"delivered");
  assert.equal(v.receipt(original,vTransport).kind,"delivered");
  assert.throws(()=>s.receipt(original,thirdTransport),/unowned HIT/);
  assert.deepEqual(attacker.map(x=>[x.attacker,x.target,x.damage,x.targetHp]),[[2,1,34,66]]);
  assert.deepEqual(victim.map(x=>x.targetHp),[66]);
  assert.equal(third.length,0);
  assert.equal(a.state.expected,1);
  assert.equal(v.state.expected,1);
  assert.equal(s.state.expected,0);
});

test("byte-exact duplicate, missing seq NACK and recovered contiguous ACK do not duplicate presentation",()=>{
  const transport={},present=[];
  const inbox=createProposedHitInbox({trustedTransport:transport,actorId:2,
    onAttackerHit:r=>present.push(r.sequence)});
  inbox.acceptControl(grant(),transport);
  const first=inbox.receipt(hit(0),transport);
  assert.equal(decodeProposedHitControl(first.response).op,OP.CLIENT_ACK);
  assert.equal(decodeProposedHitControl(first.response).cursor,1);
  assert.equal(inbox.receipt(hit(0),transport).kind,"duplicate");
  const huge=encodeHitReceipt({sequence:0xffffffff,serverTick:12,attacker:2,target:1,damage:34,targetHp:66});
  assert.equal(inbox.receipt(huge,transport).kind,"missing",
    "unwrapped large future sequence must not be misclassified as a duplicate");
  const missing=inbox.receipt(hit(2),transport);
  assert.equal(missing.kind,"missing");
  assert.deepEqual([decodeProposedHitControl(missing.response).op,
    decodeProposedHitControl(missing.response).cursor],[OP.CLIENT_NACK,1]);
  assert.equal(inbox.receipt(hit(1),transport).kind,"delivered");
  assert.equal(inbox.receipt(hit(2),transport).kind,"delivered");
  assert.deepEqual(present,[0,1,2]);
  assert.equal(inbox.state.expected,3);
});

test("stale transport, swapped actor, duplicate GRANT and unrelated sender control fail closed",()=>{
  const transport={},oldTransport={},attacked=[];
  const gate=createProposedHitInbox({trustedTransport:transport,actorId:2,
    onAttackerHit:r=>attacked.push(r)});
  assert.throws(()=>gate.acceptControl(grant(),oldTransport),/foreign/);
  assert.throws(()=>gate.receipt(hit(0),transport),/grant/);
  gate.acceptControl(grant(),transport);
  assert.throws(()=>gate.acceptControl(grant(),transport),/duplicate/);
  assert.throws(()=>gate.receipt(hit(0),oldTransport),/foreign/);
  assert.throws(()=>gate.receipt(hit(0,3,1),transport),/unowned/);
  assert.throws(()=>gate.acceptControl(encodeProposedHitControl({
    op:OP.CLIENT_ACK,cursor:0,token:lease}),transport),/unexpected inbound/);
  assert.deepEqual(attacked,[]);
  assert.equal(gate.state.expected,0);
});

test("retirement prevents old asynchronous session receipts; explicit overflow GAP never credits",()=>{
  const transport={},lost=[];
  const gate=createProposedHitInbox({trustedTransport:transport,actorId:2,
    onGap:g=>lost.push(g)});
  gate.acceptControl(grant(),transport);
  const other=Uint8Array.from(lease);other[0]=90;
  assert.throws(()=>gate.acceptControl(encodeProposedHitControl({
    op:OP.SERVER_GAP,token:other,cursor:1,aux:10}),transport),/foreign HIT lease token/);
  const gap=gate.acceptControl(encodeProposedHitControl({
    op:OP.SERVER_GAP,token:lease,cursor:1,aux:10}),transport);
  assert.deepEqual(gap,{kind:"gap",missingFrom:1,oldestAvailable:10});
  assert.deepEqual(lost,[{missingFrom:1,oldestAvailable:10}]);
  assert.throws(()=>gate.receipt(hit(0),transport),/grant/);
  assert.throws(()=>gate.acceptControl(grant(),transport),/duplicate or replaced/);
  const retirement=gate.acceptControl(encodeProposedHitControl({
    op:OP.SERVER_RETIRED,token:lease,cursor:0,aux:1}),transport);
  assert.deepEqual(retirement,{kind:"retired",reason:1});
  gate.retire();
  assert.throws(()=>gate.acceptControl(grant(),transport),/retired/);
  assert.throws(()=>gate.receipt(hit(0),transport),/grant/);
});

test("callback failure refuses to ACK or advance; no same-lease wrap credit",()=>{
  const transport={},delivered=[];
  let shouldFail=true;
  const gate=createProposedHitInbox({trustedTransport:transport,actorId:2,
    onAttackerHit:r=>{if(shouldFail)throw Error("presentation enqueue failed"); delivered.push(r.sequence);}});
  gate.acceptControl(grant(),transport);
  assert.throws(()=>gate.receipt(hit(0),transport),/presentation enqueue failed/);
  assert.equal(gate.state.expected,0);
  shouldFail=false;
  assert.equal(gate.receipt(hit(0),transport).kind,"delivered");
  assert.deepEqual(delivered,[0]);
});
