import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ProposedLmbGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {decodeProposedGestureEvent,decodeProposedGestureAck,
  encodeProposedTypedGestureEvent,decodeProposedTypedGestureEvent}
  from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {REVIEW_SOURCE as S,REVIEW_ACTION as A,REVIEW_ACK as K,
  encodeReviewEvent,decodeReviewEvent,encodeReviewAck}
  from "./fixtures/core8a-one-v2-gesture-wire-review.mjs";
const lmbPress=[2,0x11,1,0,1,0,0,0,1,0,0,0,42,0,0,0];
const lmbRelease=[2,0x11,3,0,2,0,0,0,1,0,0,0,42,0,0,0];
const keyEPress=[2,0x11,1,1,3,0,0,0,2,0,0,0,43,0,0,0];
const keyERelease=[2,0x11,3,1,4,0,0,0,2,0,0,0,44,0,0,0];
const keyEAck=[2,0x12,1,0,3,0,0,0,2,0,0,0,50,0,0,0];
test("same-tick two LMB edges exactly preserve already tested Combat4 and Core8A bytes",()=>{
  const q=new ProposedLmbGestureOutbox({negotiatedVersion:2,trustedLease:Object.freeze({})});
  q.begin(42);q.release(42);
  assert.deepEqual(q.nextSendBatch().map(x=>Array.from(x.bytes)),[lmbPress,lmbRelease]);
  const p=encodeReviewEvent({source:S.LMB,action:A.PRESS,sequence:1,gestureId:1,clientTick:42});
  const u=encodeReviewEvent({source:S.LMB,action:A.RELEASE,sequence:2,gestureId:1,clientTick:42});
  assert.deepEqual(Array.from(p),lmbPress);
  assert.deepEqual(Array.from(u),lmbRelease);
  assert.equal(decodeProposedGestureEvent(p).action,A.PRESS);
  assert.deepEqual(decodeReviewEvent(u),{source:0,action:3,sequence:2,gestureId:1,clientTick:42});
});
test("typed standalone KeyE never aliases held-LMB UPGRADE or origin",()=>{
  const press=encodeReviewEvent({source:S.KEY_E,action:A.PRESS,sequence:3,gestureId:2,clientTick:43});
  const release=encodeReviewEvent({source:S.KEY_E,action:A.RELEASE,sequence:4,gestureId:2,clientTick:44});
  assert.deepEqual(Array.from(press),keyEPress);
  assert.deepEqual(Array.from(release),keyERelease);
  assert.equal(decodeReviewEvent(press).source,S.KEY_E);
  assert.equal(decodeReviewEvent(release).action,A.RELEASE);
  assert.throws(()=>decodeProposedGestureEvent(press),/reserved/i,
    "the unchanged dormant old decoder MUST NOT silently accept newly tagged KeyE");
  assert.throws(()=>encodeReviewEvent({source:S.KEY_E,action:A.UPGRADE,sequence:3,gestureId:2}),/source\/action/);
  assert.deepEqual(Array.from(encodeReviewAck({status:K.ACCEPTED,sequence:3,gestureId:2,serverTick:50})),keyEAck);
  assert.deepEqual(decodeProposedGestureAck(new Uint8Array(keyEAck)),{
    status:1,sequence:3,gestureId:2,serverTick:50,
  });
});
test("malformed alternate 0x52, legacy v1, forged source/identity and reserved ACK fail closed",()=>{
  const good=new Uint8Array(keyEPress);
  for(const [index,value] of [[0,1],[1,0x52],[2,9],[3,2],[4,0],[8,0]]){
    const bad=new Uint8Array(good);bad[index]=value;
    assert.throws(()=>decodeReviewEvent(bad));
  }
  assert.throws(()=>decodeReviewEvent(good.subarray(0,15)));
  assert.throws(()=>decodeReviewEvent(new Uint8Array(48).fill(2)));
  assert.throws(()=>encodeReviewEvent({source:1,action:1,sequence:0,gestureId:2}));
  assert.throws(()=>encodeReviewEvent({source:1,action:1,sequence:3,gestureId:0}));
  assert.throws(()=>encodeReviewAck({status:5,sequence:3,gestureId:2}));
  assert.throws(()=>decodeProposedGestureEvent(new Uint8Array([2,0x52,...lmbPress.slice(2)])),/type/);
});
test("review-only schema cannot accidentally enable live server or web gesture ingress",()=>{
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  const browser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(server,/core8a_one_v2_gesture_wire_review|prealpha_lmb_gesture_authority/);
  assert.doesNotMatch(browser,/core8a-one-v2-gesture-wire-review|prealpha-lmb-gesture-outbox-proposal/);
});

test("selected-family immutable fixture matches actual JS EVENT/ACK encoding and strict negatives",()=>{
  const lines=readFileSync(
    new URL("./fixtures/core8a-p723-selected-family-v2.golden",import.meta.url),"utf8")
    .split(/\r?\n/).filter(line=>line&&!line.startsWith("#"));
  const fixture=new Map(lines.map(line=>{
    const parts=line.split("=");
    assert.equal(parts.length,2,"one immutable key/value per row");
    assert.match(parts[1],/^[0-9a-f]{32}$/,"exact 16-byte lowercase fixture");
    return parts;
  }));
  assert.equal(fixture.size,15,"all selected-family and negative vectors present");
  const bytes=name=>{
    const hex=fixture.get(name);
    assert.ok(hex, `missing shared vector ${name}`);
    return Uint8Array.from(hex.match(/../g),h=>Number.parseInt(h,16));
  };
  const events=[
    ["LMB_PRESS",S.LMB,A.PRESS,1,1,42],
    ["LMB_RELEASE",S.LMB,A.RELEASE,2,1,42],
    ["KEY_E_PRESS",S.KEY_E,A.PRESS,3,2,43],
    ["KEY_E_RELEASE",S.KEY_E,A.RELEASE,4,2,44],
    ["KEY_E_CANCEL",S.KEY_E,A.CANCEL,5,2,45],
    ["LMB_UPGRADE",S.LMB,A.UPGRADE,6,3,42],
    ["LMB_CANCEL",S.LMB,A.CANCEL,7,3,42],
  ];
  for(const [name,source,action,sequence,gestureId,clientTick] of events){
    const encoded=encodeReviewEvent({source,action,sequence,gestureId,clientTick});
    assert.deepEqual(encoded,bytes(name),name);
    assert.deepEqual(decodeReviewEvent(bytes(name)),
      {source,action,sequence,gestureId,clientTick},name);
    if(source===S.KEY_E)
      assert.throws(()=>decodeProposedGestureEvent(bytes(name)),/reserved/i);
    else assert.equal(decodeProposedGestureEvent(bytes(name)).action,action);
  }
  for(const [name,status] of [
    ["ACK_ACCEPTED",K.ACCEPTED],["ACK_DUPLICATE",K.DUPLICATE],
    ["ACK_STALE",K.STALE],["ACK_REJECTED",K.REJECTED]
  ]){
    assert.deepEqual(encodeReviewAck({status,sequence:3,gestureId:2,serverTick:50}),bytes(name));
    assert.deepEqual(decodeProposedGestureAck(bytes(name)),
      {status,sequence:3,gestureId:2,serverTick:50});
  }
  for(const name of ["BAD_KEY_E_UPGRADE","BAD_UNKNOWN_SOURCE","BAD_UNSELECTED_52"])
    assert.throws(()=>decodeReviewEvent(bytes(name)),undefined,name);
  assert.throws(()=>decodeProposedGestureAck(bytes("BAD_ACK_SOURCE")) ,/reserved/i);
  // These are ABI fixtures only; no KeyE enable, actor trust or Combat hit grant.
  assert.equal(fixture.get("KEY_E_PRESS").slice(0,8),"02110101");
});

test("selected Combat typed codec preserves LMB vectors and refuses archived Key E attack source",()=>{
  const lines=readFileSync(new URL("./fixtures/core8a-p723-selected-family-v2.golden",import.meta.url),"utf8")
    .split(/\r?\n/).filter(line=>line&&!line.startsWith("#"));
  const fixture=new Map(lines.map(line=>line.split("=")));
  const fromHex=name=>Uint8Array.from(fixture.get(name).match(/../g),h=>parseInt(h,16));
  for(const [name,action,sequence,gestureId,clientTick] of [
    ["LMB_PRESS",1,1,1,42],["LMB_RELEASE",3,2,1,42],
    ["LMB_UPGRADE",2,6,3,42],["LMB_CANCEL",4,7,3,42],
  ]){
    const wire=new Uint8Array(encodeProposedTypedGestureEvent({
      source:0,action,sequence,gestureId,clientTick,
    }));
    assert.deepEqual(wire,fromHex(name));
    assert.deepEqual(decodeProposedTypedGestureEvent(wire),{
      source:0,action,sequence,gestureId,clientTick,
    });
  }
  for(const [name,action,sequence,gestureId,clientTick] of [
    ["KEY_E_PRESS",1,3,2,43],["KEY_E_RELEASE",3,4,2,44],
    ["KEY_E_CANCEL",4,5,2,45],
  ]){
    assert.throws(()=>encodeProposedTypedGestureEvent({
      source:1,action,sequence,gestureId,clientTick,
    }),/reserved for Use/);
    assert.throws(()=>decodeProposedTypedGestureEvent(fromHex(name)),/reserved for Use/);
  }
});
