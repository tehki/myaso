// DORMANT CROSS-DEPARTMENT source proof: UI10 real event adapter ->
// actual Core8A outbox -> exact bytes asserted by the independent Rust
// server/tests/prealpha_core8a_world_wire_interop.rs -> original World HIT.
// Does NOT assert live QUIC, actor authority, or production pointer handling.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ProposedLmbGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import { createDormantPrealphaLmbDomGate } from "../src/browser/prealpha-lmb-dom-gesture-review.mjs";
import { decodeProposedGestureEvent, GESTURE_ACTION } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const canvas={};
const mouse=(buttons=1,override={})=>({
  pointerId:7,pointerType:"mouse",button:0,buttons,target:canvas,...override
});
const press=[2,0x11,1,0,1,0,0,0,1,0,0,0,42,0,0,0];
const release=[2,0x11,3,0,2,0,0,0,1,0,0,0,42,0,0,0];
const upgrade=[2,0x11,2,0,2,0,0,0,1,0,0,0,43,0,0,0];
const releaseHeavy=[2,0x11,3,0,3,0,0,0,1,0,0,0,63,0,0,0];
function fixture(){
  const trustedLease=Object.freeze({});
  const outbox=new ProposedLmbGestureOutbox({
    negotiatedVersion:2,trustedLease,maxPending:16,maxAttempts:3
  });
  let tick=42,chat=false,jump=false;
  const gate=createDormantPrealphaLmbDomGate({
    outbox,getClientTick:()=>tick,isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>chat,isJumpAttackChord:()=>jump
  });
  return {gate,outbox,setTick:n=>{tick=n;},setChat:v=>{chat=v;},
    setJump:v=>{jump=v;},batch:()=>outbox.nextSendBatch(8).map(e=>Array.from(e.bytes))};
}

test("UI10 actual pointerDown/up -> Core8A actual outbox matches Combat4 Rust fast-click HIT vectors",()=>{
  const f=fixture();
  assert.equal(f.gate.pointerDown(mouse()),true);
  assert.equal(f.gate.pointerUp(mouse(0)),true);
  assert.deepEqual(f.batch(),[press,release]);
  assert.equal(f.gate.snapshot.active,false);
});
test("UI10 pointerDOWN held -> approved upgrade -> pointerUP yields exact genuine 46HP Rust World proof vectors",()=>{
  const f=fixture();
  assert.equal(f.gate.pointerDown(mouse()),true);
  f.setTick(43);
  assert.equal(f.gate.approvedHoldUpgrade(7),true);
  f.setTick(63);
  assert.equal(f.gate.pointerUp(mouse(0)),true);
  assert.deepEqual(f.batch(),[press,upgrade,releaseHeavy]);
  assert.equal(f.outbox.snapshot.pending,3);
});
test("UI10 canceled capture/blur preserves CANCEL identity and can never invent heavy RELEASE",()=>{
  const f=fixture();
  assert.equal(f.gate.pointerDown(mouse()),true);
  f.setTick(43);
  assert.equal(f.gate.approvedHoldUpgrade(7),true);
  f.setTick(63);
  assert.equal(f.gate.blur(),true);
  assert.equal(f.gate.pointerUp(mouse(0)),false);
  const batch=f.batch();
  assert.deepEqual(batch.slice(0,2),[press,upgrade]);
  const third=decodeProposedGestureEvent(Uint8Array.from(batch[2]));
  assert.equal(third.action,GESTURE_ACTION.CANCEL);
  assert.equal(third.gestureId,1);
  assert.equal(third.sequence,3);
});
test("UI10 respects chat/Space+LMB and old v1 runtime is still untouched",()=>{
  const f=fixture();
  f.setChat(true);
  assert.equal(f.gate.pointerDown(mouse()),false);
  f.setChat(false);f.setJump(true);
  assert.equal(f.gate.pointerDown(mouse()),false);
  f.setJump(false);
  assert.equal(f.gate.pointerDown(mouse(2,{button:2})),false);
  assert.equal(f.outbox.snapshot.pending,0);
  const liveBrowser=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const serverMain=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(liveBrowser,/prealpha-lmb-dom-gesture-review|prealpha-lmb-gesture-outbox-proposal/);
  assert.doesNotMatch(serverMain,/apply_review_only_lmb_gesture_command|prealpha_lmb_gesture_authority/);
});
