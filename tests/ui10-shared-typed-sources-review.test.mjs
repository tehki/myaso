import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ProposedSharedTypedGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {decodeProposedTypedGestureEvent} from "../src/network/prealpha-lmb-gesture-proposal.mjs";
import {createDormantSharedUi10Sources,attachDormantSharedUi10Sources} from "../src/browser/prealpha-shared-ui10-sources-review.mjs";

function fixture(opts={}) {
  const lease={}, outbox=new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:lease,maxPending:16,maxAttempts:3,
  });
  const canvas={},tick=()=>42;
  let chat=false,jump=false,focus=true,editing=false;
  const gates=createDormantSharedUi10Sources({
    outbox,getClientTick:opts.getClientTick??tick,
    isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>chat,isJumpAttackChord:()=>jump,
    hasGameplayFocus:()=>focus,isTextEditing:()=>editing,
  });
  const pointer=(props={})=>({pointerType:"mouse",pointerId:9,
    button:0,buttons:1,target:canvas,...props});
  const key=(props={})=>({code:"KeyE",repeat:false,...props});
  return {outbox,gates,lease,canvas,pointer,key,
    chat:x=>chat=x,jump:x=>jump=x,focus:x=>focus=x,editing:x=>editing=x};
}
const decoded=batch=>batch.map(item=>decodeProposedTypedGestureEvent(item.bytes));
const edges=o=>decoded(o.nextSendBatch(16));
function ack({sequence,gestureId,status=1,serverTick=42}) {
  const b=new Uint8Array(16),v=new DataView(b.buffer);
  b[0]=2;b[1]=0x12;b[2]=status;
  v.setUint32(4,sequence,true);v.setUint32(8,gestureId,true);
  v.setUint32(12,serverTick,true);return b;
}

test("one Core8A allocator orders physical LMB PRESS, independent KeyE, then LMB RELEASE",()=>{
  const f=fixture();
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),true);
  const held=f.gates.lmb.snapshot.gestureId;
  assert.equal(f.gates.keye.keyDown(f.key()),true);
  assert.equal(f.gates.keye.keyUp(f.key()),true);
  assert.equal(f.gates.lmb.snapshot.active,true);
  assert.equal(f.gates.lmb.snapshot.gestureId,held);
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),true);
  const e=edges(f.outbox);
  assert.deepEqual(e.map(x=>[x.source,x.action,x.sequence,x.gestureId]),[
    [0,1,1,1],[1,1,2,2],[1,3,3,2],[0,3,4,1],
  ]);
  assert.equal(f.gates.lmb.snapshot.active,false);
  assert.deepEqual(f.outbox.snapshot.activeSources,[]);
  assert.equal(e.every(x=>x.clientTick===42),true);
  assert.equal(f.outbox.snapshot.pending,4);
});
test("source0 UPGRADE remains same gesture and source1 never inherits it",()=>{
  const f=fixture();
  f.gates.lmb.pointerDown(f.pointer());
  assert.equal(f.gates.lmb.approvedHoldUpgrade(9),true);
  f.gates.keye.keyDown(f.key());
  f.gates.keye.keyUp(f.key());
  f.gates.lmb.pointerUp(f.pointer({buttons:0}));
  const e=edges(f.outbox);
  assert.deepEqual(e.map(x=>[x.source,x.action]),[[0,1],[0,2],[1,1],[1,3],[0,3]]);
  assert.deepEqual(e.map(x=>x.gestureId),[1,1,2,2,1]);
  assert.equal(f.gates.lmb.approvedHoldUpgrade(9),false);
});
test("chat, jump and text editing cannot steal gameplay or generate phantom edge",()=>{
  const f=fixture();
  f.chat(true);f.editing(true);
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),false);
  assert.equal(f.gates.keye.keyDown(f.key()),false);
  f.chat(false);f.editing(false);f.jump(true);
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),false);
  f.jump(false);f.focus(false);
  assert.equal(f.gates.keye.keyDown(f.key()),false);
  f.focus(true);
  assert.equal(f.gates.keye.keyDown(f.key()),true);
  f.gates.chatOpened();
  assert.equal(f.gates.keye.keyUp(f.key()),false);
  assert.deepEqual(edges(f.outbox).map(x=>[x.source,x.action]),[[1,1],[1,4]]);
});
test("lost capture/blur/hidden never turn old physical KeyE or LMB into RELEASE",()=>{
  for(const reason of ["blur","hidden","chatOpened"]) {
    const f=fixture();
    f.gates.lmb.pointerDown(f.pointer());
    f.gates.keye.keyDown(f.key());
    f.gates[reason]();
    assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),false);
    assert.equal(f.gates.keye.keyUp(f.key()),false);
    const es=edges(f.outbox);
    assert.deepEqual(es.map(x=>[x.source,x.action]),[[0,1],[1,1],[0,4],[1,4]],reason);
  }
});
test("actual negotiated lease ACK settles transport only, not World HIT",()=>{
  const f=fixture();
  f.gates.lmb.pointerDown(f.pointer());
  f.gates.keye.keyDown(f.key());
  const e=edges(f.outbox);
  assert.equal(e.length,2);
  assert.throws(()=>f.outbox.receiveAck(ack(e[0]),{}),/lease/);
  const settled=f.outbox.receiveAck(ack(e[0]),f.lease);
  assert.equal(settled.source,0);
  assert.equal(settled.transportSettled,true);
  assert.equal(settled.combatCommitted,false);
  assert.throws(()=>f.outbox.receiveAck(ack(e[0]),f.lease),/replayed|unexpected|retired/);
  const keyack=f.outbox.receiveAck(ack(e[1]),f.lease);
  assert.equal(keyack.source,1);
  assert.equal(f.outbox.snapshot.pending,0);
});
test("bounded fairness sends unsent KeyE RELEASE before repeated LMB PRESS retries",()=>{
  const f=fixture();
  f.gates.lmb.pointerDown(f.pointer());
  let first=f.outbox.nextSendBatch(1);
  assert.equal(decoded(first)[0].action,1);
  f.gates.keye.keyDown(f.key());
  f.gates.keye.keyUp(f.key());
  const batch=f.outbox.nextSendBatch(2);
  assert.deepEqual(decoded(batch).map(x=>[x.source,x.action]),[[1,1],[1,3]]);
  assert.equal(f.outbox.snapshot.activeSources.includes(0),true);
});
test("outbox rejection retires both source generation and cannot generate v1 fallback",()=>{
  const f=fixture({getClientTick:()=>-1});
  assert.equal(f.gates.keye.keyDown(f.key()),false);
  assert.equal(f.gates.keye.snapshot.closed,true);
  assert.equal(f.gates.lmb.snapshot.closed,true);
  assert.equal(f.outbox.snapshot.closed,true);
  assert.equal(f.gates.lmb.pointerDown(f.pointer()),false);
});
test("closing page/lease prevents stale KEY_E UP and stale LMB RELEASE",()=>{
  const f=fixture();
  f.gates.lmb.pointerDown(f.pointer());
  f.gates.keye.keyDown(f.key());
  f.gates.closeLease();
  assert.equal(f.outbox.snapshot.closed,true);
  assert.equal(f.gates.keye.keyUp(f.key()),false);
  assert.equal(f.gates.lmb.pointerUp(f.pointer({buttons:0})),false);
  assert.throws(()=>f.outbox.nextSendBatch(4),/closed/);
});
test("native event listener fixture uses only one shared source stack; teardown is idempotent",()=>{
  const windowObj=new EventTarget(),canvas=new EventTarget(),documentObj=new EventTarget();
  documentObj.hidden=false;
  const lease={},outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  let gameplayFocus=true;
  const gates=createDormantSharedUi10Sources({
    outbox,getClientTick:()=>11,isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>false,isJumpAttackChord:()=>false,
    hasGameplayFocus:()=>gameplayFocus,isTextEditing:()=>false,
  });
  const detach=attachDormantSharedUi10Sources(gates,{canvas,windowObj,documentObj});
  const send=(target,type,props)=>{
    const e=new Event(type,{cancelable:true});
    for(const [k,v] of Object.entries(props))Object.defineProperty(e,k,{value:v});
    target.dispatchEvent(e);return e;
  };
  assert.equal(send(canvas,"pointerdown",{pointerType:"mouse",pointerId:9,button:0,buttons:1}).defaultPrevented,true);
  assert.equal(send(windowObj,"keydown",{code:"KeyE",repeat:false}).defaultPrevented,true);
  assert.equal(send(windowObj,"keyup",{code:"KeyE"}).defaultPrevented,true);
  assert.equal(send(windowObj,"pointerup",{pointerType:"mouse",pointerId:9,button:0,buttons:0}).defaultPrevented,true);
  assert.deepEqual(edges(outbox).map(e=>[e.source,e.action]),[[0,1],[1,1],[1,3],[0,3]]);
  detach();detach();assert.equal(outbox.snapshot.closed,true);
  gameplayFocus=false;
  assert.equal(send(windowObj,"keydown",{code:"KeyE",repeat:false}).defaultPrevented,false);
});
test("pagehide retires both physical input sources and their ONE pending outbox lease",()=>{
  const windowObj=new EventTarget(),canvas=new EventTarget(),documentObj=new EventTarget();
  documentObj.hidden=false;
  const lease={},outbox=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:lease});
  const gates=createDormantSharedUi10Sources({
    outbox,getClientTick:()=>88,isCanvasTarget:e=>e.target===canvas,
    isChatFocused:()=>false,isJumpAttackChord:()=>false,
    hasGameplayFocus:()=>true,isTextEditing:()=>false,
  });
  const detach=attachDormantSharedUi10Sources(gates,{canvas,windowObj,documentObj});
  function dispatch(target,type,props={}) {
    const event=new Event(type,{cancelable:true});
    for(const [key,value] of Object.entries(props))
      Object.defineProperty(event,key,{value});
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }
  assert.equal(dispatch(canvas,"pointerdown",{
    pointerType:"mouse",pointerId:10,button:0,buttons:1,
  }),true);
  assert.equal(dispatch(windowObj,"keydown",{code:"KeyE",repeat:false}),true);
  assert.equal(outbox.snapshot.pending,2);
  assert.deepEqual(outbox.snapshot.activeSources,[0,1]);
  // Actual page navigation must close the whole outbox, not only KeyE.
  dispatch(windowObj,"pagehide");
  assert.equal(outbox.snapshot.closed,true);
  assert.equal(outbox.snapshot.pending,0,"old-session typed edges must be discarded");
  assert.deepEqual(outbox.snapshot.activeSources,[]);
  assert.equal(gates.lmb.snapshot.closed,true);
  assert.equal(gates.keye.snapshot.closed,true);
  assert.equal(dispatch(windowObj,"keyup",{code:"KeyE"}),false);
  assert.equal(dispatch(windowObj,"pointerup",{
    pointerType:"mouse",pointerId:10,button:0,buttons:0,
  }),false);
  assert.throws(()=>outbox.nextSendBatch(4),/closed/);
  detach();detach(); // idempotent and no further emission after teardown
  assert.equal(dispatch(windowObj,"keydown",{code:"KeyE",repeat:false}),false);
});

test("no original gameplay/wire imports or UI network authentication fabrication",()=>{
  const live=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  const server=readFileSync(new URL("../server/src/main.rs",import.meta.url),"utf8");
  assert.doesNotMatch(live,/prealpha-shared-ui10-sources-review/);
  assert.doesNotMatch(live,/prealpha-keye-source-review/);
  assert.doesNotMatch(server,/prealpha-shared-ui10-sources-review/);
});
