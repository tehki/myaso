import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProposedLmbGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { decodeProposedGestureEvent, PROPOSED_GESTURE_VERSION, GESTURE_ACTION } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const bytes = x => Array.from(x.bytes);
const make=()=>new ProposedLmbGestureOutbox({
  negotiatedVersion: PROPOSED_GESTURE_VERSION, trustedLease: Object.freeze({}),
});
const goldenPress = [2,0x11,1,0,1,0,0,0,1,0,0,0,42,0,0,0];
const goldenRelease = [2,0x11,3,0,2,0,0,0,1,0,0,0,42,0,0,0];
const goldenUpgrade=[2,0x11,2,0,2,0,0,0,1,0,0,0,43,0,0,0];
const goldenHeavyRelease=[2,0x11,3,0,3,0,0,0,1,0,0,0,63,0,0,0];

test("actual Core8A outbox yields exact Rust World test golden byte vectors, not fabricated messages",()=>{
  const fast=make();
  fast.begin(42);fast.release(42);
  assert.deepEqual(fast.nextSendBatch().map(bytes),[goldenPress,goldenRelease]);
  const heavy=make();
  heavy.begin(42);heavy.upgrade(43);heavy.release(63);
  assert.deepEqual(heavy.nextSendBatch().map(bytes),[goldenPress,goldenUpgrade,goldenHeavyRelease]);
  assert.deepEqual(heavy.snapshot,{pending:3,activeGestureId:null,closed:false,nextSequence:4,nextGestureId:2});
});
test("outbox preserves exact ordered short mouse edges with original one-gesture identity",()=>{
  const q=make();
  const first=q.begin(42),last=q.release(42);
  assert.equal(first.gestureId,last.gestureId);
  assert.equal(last.sequence,first.sequence+1);
  const one=q.nextSendBatch().map(e=>decodeProposedGestureEvent(e.bytes));
  assert.deepEqual(one.map(e=>e.action),[GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
  assert.deepEqual(one.map(e=>e.clientTick),[42,42]);
});
test("Core8C unnegotiated alternate 0x52 source cannot silently enter Core8A v2 decoder",()=>{
  const other=new Uint8Array([2,0x52,2,0,8,7,6,5,4,3,2,1,9,0,0,0,
    1,0,0,0,7,0,0,0,100,0,0,0,1,1,0,0,
    2,0,0,0,7,0,0,0,100,0,0,0,3,1,0,0]);
  assert.throws(()=>decodeProposedGestureEvent(other),/length/);
  assert.throws(()=>decodeProposedGestureEvent(other.subarray(0,16)),/type/);
});
test("neither test-only integration nor original Core8A proposal enables public multiplayer",()=>{
  const runtimeBrowser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const runtimeServer=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(runtimeBrowser,/prealpha-lmb-gesture-outbox-proposal|prealpha-lmb-gesture-proposal/);
  assert.doesNotMatch(runtimeServer,/prealpha_lmb_gesture_authority|apply_review_only_lmb_gesture_command/);
});
