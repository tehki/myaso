import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ProposedSharedTypedGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {PROPOSED_GESTURE_SOURCE as SOURCE, GESTURE_ACTION as ACTION,
  decodeProposedTypedGestureEvent} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {createDormantSharedUi10Sources,attachDormantSharedUi10Sources}
  from "../src/browser/prealpha-shared-ui10-sources-review.mjs";

function fixture() {
  const lease={},canvas={};
  const outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  const gates=createDormantSharedUi10Sources({outbox,getClientTick:()=>42,
    isCanvasTarget:e=>e.target===canvas,isChatFocused:()=>false,
    isJumpAttackChord:()=>false});
  const pointer=(props={})=>({pointerType:"mouse",pointerId:9,
    button:0,buttons:1,target:canvas,...props});
  const edges=()=>outbox.nextSendBatch(16).map(e=>decodeProposedTypedGestureEvent(e.bytes));
  return {lease,canvas,gates,outbox,pointer,edges};
}
function event(target,type,props={}) {
  const e=new Event(type,{bubbles:true,cancelable:true});
  for(const [key,value] of Object.entries(props))Object.defineProperty(e,key,{value});
  target.dispatchEvent(e);return e;
}
test("one source0 LMB PRESS/RELEASE, no Key E Combat origin",()=>{
  const f=fixture();
  assert.equal("keye" in f.gates,false);
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),true);
  assert.deepEqual(f.edges().map(e=>[e.source,e.action,e.sequence,e.gestureId]),[
    [0,ACTION.PRESS,1,1],[0,ACTION.RELEASE,2,1]]);
});
test("LMB upgrade shares identity and CANCEL forbids late phantom release",()=>{
  const f=fixture();
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
  assert.equal(f.gates.lmb.approvedHoldUpgrade(9),true);
  f.gates.blur();
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),false);
  assert.deepEqual(f.edges().map(e=>e.action),[
    ACTION.PRESS,ACTION.UPGRADE,ACTION.CANCEL]);
});
test("old Key E source1 is denied without evicting an active LMB",()=>{
  const f=fixture(); f.gates.lmb.pointerDown(f.pointer());
  assert.throws(()=>f.outbox.begin(SOURCE.KEY_E,42),/Combat permits only/);
  assert.deepEqual(f.outbox.snapshot.activeSources,[SOURCE.LMB]);
  f.gates.lmb.pointerUp(f.pointer({buttons:0}));
  assert.deepEqual(f.edges().map(e=>e.source),[SOURCE.LMB,SOURCE.LMB]);
});
test("physical Key E remains unconsumed; pagehide retires actor lease",()=>{
  const f=fixture(),win=new EventTarget(),doc=new EventTarget();
  doc.hidden=false;
  const detach=attachDormantSharedUi10Sources(f.gates,{
    canvas:Object.assign(new EventTarget(),{foo:1}),windowObj:win,documentObj:doc});
  assert.equal(event(win,"keydown",{code:"KeyE",repeat:false}).defaultPrevented,false);
  assert.equal(event(win,"keyup",{code:"KeyE"}).defaultPrevented,false);
  assert.equal(f.outbox.snapshot.pending,0);
  event(win,"pagehide");
  assert.equal(f.outbox.snapshot.closed,true);
  detach();detach();
});
test("typed browser adapter never installs retired Key E Combat handler",()=>{
  const source=readFileSync(new URL("../src/browser/prealpha-shared-ui10-sources-review.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/createDormantKeyEOrigin|attachDormantKeyEOrigin/);
});
