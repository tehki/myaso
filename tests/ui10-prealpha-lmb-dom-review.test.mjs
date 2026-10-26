import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROPOSED_GESTURE_VERSION, GESTURE_ACTION,
  decodeProposedGestureEvent } from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import { ProposedLmbGestureOutbox } from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {createDormantPrealphaLmbDomGate,
  attachDormantPrealphaLmbDomGate} from "../src/browser/prealpha-lmb-dom-gesture-review.mjs";

// Intent-only fixtures. They are not user authentication, server ACK or hits.
const canvas={};
const event=(pointerId=7,overrides={})=>({
  pointerId,pointerType:"mouse",button:0,buttons:1,target:canvas,...overrides
});
function fixture(overrides={}){
  const lease=Object.freeze({});
  const outbox=new ProposedLmbGestureOutbox({
    trustedLease:lease,negotiatedVersion:PROPOSED_GESTURE_VERSION,maxPending:16
  });
  let tick=123,chat=false,jump=false;
  const gate=createDormantPrealphaLmbDomGate({
    outbox,getClientTick:()=>tick,
    isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>chat,isJumpAttackChord:()=>jump,...overrides
  });
  return {gate,outbox,lease,advance:n=>tick=n,
    chat:v=>chat=v,jump:v=>jump=v};
}
const actions=outbox=>outbox.nextSendBatch(8).map(e=>decodeProposedGestureEvent(e.bytes));

test("quick native LMB down/up in one 30Hz sample yields distinct ordered edges, zero client hit",()=>{
 const f=fixture();
 assert.equal(f.gate.pointerDown(event()),true);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0})),true);
 assert.deepEqual(actions(f.outbox).map(e=>e.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
 assert.equal(f.outbox.snapshot.pending,2);
 const entries=actions(f.outbox);
 assert.equal(entries[0].clientTick,123);
 assert.equal(entries[0].clientTick,entries[1].clientTick);
 assert.equal(entries[0].gestureId,entries[1].gestureId);
 assert.equal(entries[1].sequence,entries[0].sequence+1);
 assert.equal(f.gate.snapshot.active,false);
});
test("held press explicit upgrade then release uses ONE gesture, never second press",()=>{
 const f=fixture();
 assert.equal(f.gate.pointerDown(event()),true);
 f.advance(125);
 assert.equal(f.gate.approvedHoldUpgrade(7),true);
 assert.equal(f.gate.approvedHoldUpgrade(7),false);
 f.advance(140);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0})),true);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0})),false);
 const e=actions(f.outbox);
 assert.deepEqual(e.map(x=>x.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.UPGRADE,GESTURE_ACTION.RELEASE]);
 assert.equal(new Set(e.map(x=>x.gestureId)).size,1);
 assert.equal(f.gate.snapshot.active,false);
});
test("pointer ID, target, right mouse, pen, double down and mismatched up cannot retarget",()=>{
 const f=fixture();
 assert.equal(f.gate.pointerDown(event(7,{target:{}})),false);
 assert.equal(f.gate.pointerDown(event(7,{button:2,buttons:2})),false);
 assert.equal(f.gate.pointerDown(event(7,{pointerType:"pen"})),false);
 assert.equal(f.gate.pointerDown(event(7,{buttons:0})),false);
 assert.equal(f.gate.pointerDown(event(7,{pointerId:-4})),false);
 assert.equal(f.gate.pointerDown(event(7)),true);
 assert.equal(f.gate.pointerDown(event(9)),false);
 assert.equal(f.gate.pointerUp(event(9,{buttons:0})),false);
 assert.equal(f.gate.pointerUp(event(7,{button:2,buttons:0})),false);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0,target:{}})),true,
   "up outside canvas must finish the original reserved gesture");
 assert.deepEqual(actions(f.outbox).map(e=>e.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
});
test("chat composer and Space+LMB jump chord are delegated to existing source controls",()=>{
 const f=fixture();
 f.chat(true);
 assert.equal(f.gate.pointerDown(event()),false);
 f.chat(false);f.jump(true);
 assert.equal(f.gate.pointerDown(event()),false);
 f.jump(false);
 assert.equal(f.gate.pointerDown(event()),true);
 // A later unrelated RMB key/mouse action is not another v2 LMB press.
 assert.equal(f.gate.pointerDown(event(8,{button:2,buttons:2})),false);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0})),true);
 assert.deepEqual(actions(f.outbox).map(x=>x.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
});
test("lost pointer capture, browser blur, chat entry and hidden tab each CANCEL without RELEASE",()=>{
 for(const reason of ["lostCapture","blur","chatOpened","hidden","pointerCancel"]){
  const f=fixture();
  assert.equal(f.gate.pointerDown(event()),true);
  assert.equal(reason==="lostCapture"||reason==="pointerCancel"
    ? f.gate[reason](event()) : f.gate[reason](),true,reason);
  assert.equal(f.gate.pointerUp(event(7,{buttons:0})),false);
  assert.deepEqual(actions(f.outbox).map(x=>x.action),
    [GESTURE_ACTION.PRESS,GESTURE_ACTION.CANCEL],reason);
 }
});
test("wrong pointer cannot cancel another player's held edge",()=>{
 const f=fixture();
 f.gate.pointerDown(event(7));
 assert.equal(f.gate.pointerCancel(event(11)),false);
 assert.equal(f.gate.lostCapture(event(11)),false);
 assert.equal(f.gate.snapshot.pointerId,7);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0})),true);
});
test("old QUIC lease closed on disconnect, never retries as a fresh gesture",()=>{
 const f=fixture();
 f.gate.pointerDown(event());
 assert.equal(f.gate.closeLease(),true);
 assert.equal(f.gate.snapshot.closed,true);
 assert.equal(f.outbox.snapshot.closed,true);
 assert.equal(f.gate.pointerUp(event(7,{buttons:0})),false);
 assert.equal(f.gate.pointerDown(event()),false);
 const fresh=fixture();
 assert.equal(fresh.gate.pointerDown(event()),true);
 assert.equal(fresh.gate.snapshot.gestureId,1);
});
test("bad tick and exhausted outbox shut down the UI gate, never report a hit",()=>{
 const f=fixture();
 f.advance(-1);
 assert.equal(f.gate.pointerDown(event()),false);
 assert.equal(f.gate.snapshot.closed,true);
 const a=fixture();
 a.gate.pointerDown(event());
 a.advance(-1);
 assert.equal(a.gate.pointerUp(event(7,{buttons:0})),false);
 assert.equal(a.gate.snapshot.closed,true);
 assert.equal(a.outbox.snapshot.closed,true);
});
test("event listener wiring emits only one mouse edge per real event and tears down",()=>{
 const fakeCanvas=new EventTarget(),win=new EventTarget(),doc=new EventTarget();
 doc.hidden=false;
 const f=fixture({isCanvasTarget:e=>e.target===fakeCanvas});
 const disconnect=attachDormantPrealphaLmbDomGate(f.gate,{
   canvas:fakeCanvas,windowObj:win,documentObj:doc
 });
 // Dispatch synthetic DOM events only for unit coverage, never claiming
 // isTrusted native acceptance in these tests.
 function dispatch(target,type,props={}){
   const e=new Event(type,{cancelable:true});
   for(const [k,v] of Object.entries(props))Object.defineProperty(e,k,{value:v});
   target.dispatchEvent(e);return e;
 }
 const down=dispatch(fakeCanvas,"pointerdown",{
   pointerType:"mouse",pointerId:7,button:0,buttons:1
 });
 assert.equal(down.defaultPrevented,true);
 const up=dispatch(win,"pointerup",{
   pointerType:"mouse",pointerId:7,button:0,buttons:0
 });
 assert.equal(up.defaultPrevented,true);
 assert.deepEqual(actions(f.outbox).map(x=>x.action),
   [GESTURE_ACTION.PRESS,GESTURE_ACTION.RELEASE]);
 disconnect();disconnect();
 assert.equal(f.gate.snapshot.closed,true);
});
test("proposal remains fully dormant: no production browser, Rust ingress or current v1 gesture import",()=>{
 const live=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const rust=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
 assert.doesNotMatch(live,/prealpha-lmb-dom-gesture-review/);
 assert.doesNotMatch(live,/prealpha-lmb-gesture-outbox-proposal/);
 assert.doesNotMatch(rust,/prealpha-lmb-dom-gesture-review/);
 assert.doesNotMatch(rust,/prealpha-lmb-gesture-outbox-proposal/);
});
