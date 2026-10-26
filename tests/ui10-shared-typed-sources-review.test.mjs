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
// Preserve non-KeyE transport/lease invariants from the older two-source
// acceptance suite while removing its obsolete source1-heavy expectations.
function typedAck(edge,{status=1,serverTick=71}={}) {
  const bytes=new Uint8Array(16),view=new DataView(bytes.buffer);
  bytes[0]=2;bytes[1]=0x12;bytes[2]=status;
  view.setUint32(4,edge.sequence,true);
  view.setUint32(8,edge.gestureId,true);
  view.setUint32(12,serverTick,true);
  return bytes;
}
test("retired E cannot reserve sequence, gesture ID, retries or held LMB capacity",()=>{
  const f=fixture();
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
  const before=f.outbox.snapshot;
  for(const action of [
    ()=>f.outbox.begin(SOURCE.KEY_E,42),
    ()=>f.outbox.release(SOURCE.KEY_E,42),
    ()=>f.outbox.cancel(SOURCE.KEY_E,42),
  ]) assert.throws(action);
  assert.deepEqual(f.outbox.snapshot,before);
  assert.equal(f.gates.lmb.approvedHoldUpgrade(9),true);
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),true);
  const edges=f.edges();
  assert.deepEqual(edges.map(e=>[e.source,e.action,e.sequence,e.gestureId]),[
    [SOURCE.LMB,ACTION.PRESS,1,1],
    [SOURCE.LMB,ACTION.UPGRADE,2,1],
    [SOURCE.LMB,ACTION.RELEASE,3,1],
  ]);
});
test("same-lease LMB ACK and duplicate remain transport-only, foreign ACK cannot settle",()=>{
  const f=fixture();
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),true);
  const packets=f.outbox.nextSendBatch(2,{onlyUnsent:true});
  assert.deepEqual(packets.map(e=>e.attempt),[1,1]);
  const first=typedAck(packets[0]);
  assert.throws(()=>f.outbox.receiveAck(first,{}),/foreign connection lease/);
  assert.equal(f.outbox.snapshot.pending,2);
  const accepted=f.outbox.receiveAck(first,f.lease);
  assert.equal(accepted.source,SOURCE.LMB);
  assert.equal(accepted.transportSettled,true);
  assert.equal(accepted.combatCommitted,false);
  const duplicate=f.outbox.receiveAck(typedAck(packets[0],{status:2}),f.lease);
  assert.equal(duplicate.alreadySettled,true);
  assert.equal(duplicate.combatCommitted,false);
  assert.equal(f.outbox.snapshot.pending,1);
  const released=f.outbox.receiveAck(typedAck(packets[1]),f.lease);
  assert.equal(released.combatCommitted,false);
  assert.equal(f.outbox.snapshot.pending,0);
  assert.throws(()=>f.outbox.receiveAck(typedAck(packets[1],{status:3}),f.lease),/settled typed ACK status rejected/);
});
test("real LMB terminal first-send takes precedence over pending PRESS retry",()=>{
  const f=fixture();
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
  const [press]=f.outbox.nextSendBatch(1,{onlyUnsent:true});
  assert.equal(press.action,ACTION.PRESS);
  assert.equal(press.attempt,1);
  assert.throws(()=>f.outbox.begin(SOURCE.KEY_E,42),/Combat permits only/);
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),true);
  const [release]=f.outbox.nextSendBatch(1);
  assert.equal(release.action,ACTION.RELEASE);
  assert.equal(release.attempt,1);
  assert.equal(release.gestureId,press.gestureId);
  assert.equal(release.sequence,press.sequence+1);
  assert.deepEqual(f.outbox.nextSendBatch(3,{onlyUnsent:true}),[]);
  const retry=f.outbox.nextSendBatch(1);
  assert.equal(retry[0].sequence,press.sequence);
  assert.equal(retry[0].attempt,2);
});
test("chat, hidden tab and blur CANCEL LMB without a phantom late RELEASE",()=>{
  for(const cancel of ["chatOpened","hidden","blur"]) {
    const f=fixture();
    assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
    f.gates[cancel]();
    assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),false);
    assert.deepEqual(f.edges().map(e=>[e.source,e.action]),[
      [SOURCE.LMB,ACTION.PRESS],[SOURCE.LMB,ACTION.CANCEL],
    ],cancel);
    assert.equal(f.outbox.snapshot.activeSources.length,0);
  }
});
test("navigation with pending source0 edges retires entire queue and ignores late E/UP",()=>{
  const canvas=new EventTarget(),windowObj=new EventTarget(),documentObj=new EventTarget();
  documentObj.hidden=false;
  const lease={},outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  const gates=createDormantSharedUi10Sources({outbox,getClientTick:()=>88,
    isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>false,isJumpAttackChord:()=>false});
  const detach=attachDormantSharedUi10Sources(gates,{canvas,windowObj,documentObj});
  const pointerDown=event(canvas,"pointerdown",{
    pointerType:"mouse",pointerId:17,button:0,buttons:1});
  assert.equal(pointerDown.defaultPrevented,true);
  assert.equal(outbox.snapshot.pending,1);
  assert.equal(event(windowObj,"keydown",{code:"KeyE"}).defaultPrevented,false);
  event(windowObj,"pagehide");
  assert.equal(outbox.snapshot.closed,true);
  assert.equal(outbox.snapshot.pending,0);
  assert.equal(gates.lmb.snapshot.closed,true);
  assert.equal(event(windowObj,"pointerup",{
    pointerType:"mouse",pointerId:17,button:0,buttons:0}).defaultPrevented,false);
  assert.throws(()=>outbox.nextSendBatch(1),/closed/);
  detach();detach();
});

test("typed browser adapter never installs retired Key E Combat handler",()=>{
  const source=readFileSync(new URL("../src/browser/prealpha-shared-ui10-sources-review.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/createDormantKeyEOrigin|attachDormantKeyEOrigin/);
});
