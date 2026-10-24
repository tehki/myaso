// Combat 4A P0: exact original selected 0x11 source0 DOM adapter fixture.
// This deterministic W3C-event-sequence regression is NOT itself a native
// Chrome/Firefox run, authenticated QUIC admission, or original World HIT.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {
  createDormantPrealphaLmbDomGate, attachDormantPrealphaLmbDomGate,
} from "../src/browser/prealpha-lmb-dom-gesture-review.mjs";
import {ProposedSharedTypedGestureOutbox} from "../src/network/prealpha-lmb-gesture-outbox-proposal.mjs";
import {
  PROPOSED_GESTURE_SOURCE as SOURCE, GESTURE_ACTION as ACTION,
  decodeProposedTypedGestureEvent,
} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

function setup() {
  let clientTick=100;
  const lease=Object.freeze({});
  const outbox=new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:lease,maxPending:16,maxAttempts:2,
  });
  const canvas={};
  const gate=createDormantPrealphaLmbDomGate({
    outbox,getClientTick:()=>clientTick++,
    isCanvasTarget:({target})=>target===canvas,
    isChatFocused:()=>false,isJumpAttackChord:()=>false,
  });
  const bytes=()=>outbox.nextSendBatch(16)
    .map(x=>decodeProposedTypedGestureEvent(x.bytes))
    .map(({source,action,sequence,gestureId})=>({source,action,sequence,gestureId}));
  function event(props) {
    return {target:canvas,pointerType:"mouse",cancelable:true,
      preventDefault(){this.prevented=true;},...props};
  }
  return {gate,canvas,outbox,bytes,event};
}
function edge(action,sequence,gestureId=1) {
  return {source:SOURCE.LMB,action,sequence,gestureId};
}
function emitter() {
  const listeners=new Map();
  return {
    addEventListener(type,fn) {
      const xs=listeners.get(type)||[];
      xs.push(fn);listeners.set(type,xs);
    },
    removeEventListener(type,fn) {
      listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn));
    },
    emit(type,e={}) {
      for(const fn of listeners.get(type)||[])fn(e);
    },
  };
}

test("RMB already held: real W3C mousedown0/buttons3 then mouseup0/buttons2 produces one typed source0 PRESS/RELEASE",()=>{
  const x=setup();
  const canvas=Object.assign(x.canvas,emitter());
  const windowObj=emitter();
  const documentObj=Object.assign(emitter(),{hidden:false});
  const detach=attachDormantPrealphaLmbDomGate(x.gate,{canvas,windowObj,documentObj});
  // In this legitimate chord, the browser emits pointerdown2 for RMB but
  // does NOT emit pointerdown0 or pointerup0 for LMB.
  canvas.emit("pointerdown",x.event({button:2,buttons:2,pointerId:9}));
  const press=x.event({button:0,buttons:3});
  canvas.emit("mousedown",press);
  assert.equal(press.prevented,true);
  assert.equal(x.gate.snapshot.active,true);
  assert.equal(x.gate.snapshot.pointerId,-1);
  windowObj.emit("pointerup",x.event({button:2,buttons:0,pointerId:9}));
  assert.equal(x.gate.snapshot.active,true,"RMB pointerup is not LMB terminal");
  windowObj.emit("mouseup",x.event({button:2,buttons:1}));
  assert.equal(x.gate.snapshot.active,true,"RMB mouseup is not LMB terminal");
  const release=x.event({button:0,buttons:2});
  windowObj.emit("mouseup",release);
  assert.equal(release.prevented,true);
  assert.equal(x.gate.snapshot.active,false);
  assert.deepEqual(x.bytes(),[edge(ACTION.PRESS,1),edge(ACTION.RELEASE,2)]);
  // A later stale mouseup or pointerup must not produce a duplicate attack.
  windowObj.emit("mouseup",x.event({button:0,buttons:2}));
  windowObj.emit("pointerup",x.event({button:0,buttons:0,pointerId:9}));
  assert.deepEqual(x.bytes().map(y=>y.action),[ACTION.PRESS,ACTION.RELEASE]);
  detach();
});

test("normal LMB pointerdown plus following mousedown cannot double-produce source0",()=>{
  const x=setup();
  assert.equal(x.gate.pointerDown(x.event({button:0,buttons:1,pointerId:11})),true);
  assert.equal(x.gate.chordedMouseDown(x.event({button:0,buttons:3})),false);
  // LMB was first down, then RMB held; pointerup may be skipped, so physical
  // mouseup(button0/buttons2) still terminates this SAME real pointer owner.
  assert.equal(x.gate.mouseUp(x.event({button:0,buttons:2})),true);
  assert.equal(x.gate.pointerUp(x.event({button:0,buttons:0,pointerId:11})),false);
  assert.deepEqual(x.bytes(),[edge(ACTION.PRESS,1),edge(ACTION.RELEASE,2)]);
});

test("short LMB chord releases without a sampled 30Hz frame or heavyweight upgrade",()=>{
  const x=setup();
  assert.equal(x.gate.chordedMouseDown(x.event({button:0,buttons:3})),true);
  // 7ms native physical click may be entirely between movement samples;
  // the selected typed event path nevertheless retains both ordered edges.
  assert.equal(x.gate.mouseUp(x.event({button:0,buttons:2})),true);
  assert.equal(x.gate.approvedHoldUpgrade(-1),false,
    "short released gesture must never become delayed heavy");
  assert.deepEqual(x.bytes(),[edge(ACTION.PRESS,1),edge(ACTION.RELEASE,2)]);
});

test("held RMB/LMB upgrade, physical cancel and stale release cannot yield phantom hit",()=>{
  const x=setup();
  assert.equal(x.gate.chordedMouseDown(x.event({button:0,buttons:3})),true);
  assert.equal(x.gate.approvedHoldUpgrade(-1),true);
  assert.equal(x.gate.pointerCancel(x.event({button:-1,buttons:0,pointerId:8})),true);
  assert.equal(x.gate.mouseUp(x.event({button:0,buttons:2})),false);
  assert.deepEqual(x.bytes(),[
    edge(ACTION.PRESS,1),edge(ACTION.UPGRADE,2),edge(ACTION.CANCEL,3),
  ]);
});

test("no RMB: duplicate MouseEvent does not bypass exact-pointer native LMB identity",()=>{
  const x=setup();
  assert.equal(x.gate.chordedMouseDown(x.event({button:0,buttons:1})),false);
  assert.equal(x.gate.pointerDown(x.event({button:0,buttons:1,pointerId:33})),true);
  assert.equal(x.gate.mouseUp(x.event({button:0,buttons:0})),false,
    "non-chord terminal must retain pointerId validation");
  assert.equal(x.gate.pointerUp(x.event({button:0,buttons:0,pointerId:34})),false);
  assert.equal(x.gate.pointerUp(x.event({button:0,buttons:0,pointerId:33})),true);
  assert.deepEqual(x.bytes(),[edge(ACTION.PRESS,1),edge(ACTION.RELEASE,2)]);
});

test("single loopback sender drains only newly authored typed events; timer retains real retries",()=>{
  const lab=readFileSync(new URL("../web/prealpha-gesture-live-lab.mjs",import.meta.url),"utf8");
  const start=lab.indexOf("  let lastFirstSendSequence = outbox.snapshot.nextSequence;");
  const end=lab.indexOf("  function add(target,type,handler) {",start);
  assert.ok(start>0 && end>start,"one edge-deduplicating drain route exists");
  let seq=1, calls=0;
  const ctx={
    outbox:{snapshot:{get nextSequence(){return seq;}}},
    failed:false,detached:false,
    drain(){calls++;},
  };
  runInNewContext(lab.slice(start,end),ctx);
  assert.equal(typeof ctx.drainNewEdges,"function");
  ctx.drainNewEdges();
  assert.equal(calls,0,"normal events without an authored edge must not drain");
  seq=2;ctx.drainNewEdges();
  assert.equal(calls,1,"new PRESS drains exactly once");
  ctx.drainNewEdges();ctx.drainNewEdges();
  assert.equal(calls,1,"pointerdown+mousedown must not exhaust retry attempts");
  seq=3;ctx.drainNewEdges();
  assert.equal(calls,2,"real RELEASE drains exactly once");
  ctx.drainNewEdges();
  assert.equal(calls,2,"pointerup+mouseup must not exhaust retry attempts");
  ctx.detached=true;seq=4;ctx.drainNewEdges();
  assert.equal(calls,2,"retired session must never send");
  assert.match(lab,/if \(outbox\.snapshot\.pending > 0\) drain\(\);/,
    "genuine unacknowledged typed events retain the one bounded retry timer");
  for(const type of ["pointerup","mouseup","pointercancel","keydown","keyup","blur"]){
    assert.ok(lab.includes('add(windowObj,"'+type+'",drainNewEdges);'),
      "all source edges use one immediate sequence-gated drain: "+type);
  }
});


test("physical source0 and source1 edges only spend one first-send attempt; 170ms retry owns retransmits",()=>{
  const lease=Object.freeze({});
  const q=new ProposedSharedTypedGestureOutbox({
    reviewVersion:2,trustedLease:lease,maxPending:8,maxAttempts:3,
  });
  const first=(edge)=>{
    const batch=q.nextSendBatch(4,{onlyUnsent:true});
    assert.deepEqual(batch.map(x=>[x.sequence,x.gestureId,x.attempt]),[
      [edge.sequence,edge.gestureId,1],
    ],"each NEW physical edge may write only its own packet, no old retry");
  };
  const press=q.begin(SOURCE.LMB,100);first(press);
  const release=q.release(SOURCE.LMB,100);first(release);
  const keyDown=q.begin(SOURCE.KEY_E,101);first(keyDown);
  const keyCancel=q.cancel(SOURCE.KEY_E,101);first(keyCancel);
  assert.deepEqual(q.nextSendBatch(4,{onlyUnsent:true}),[],
    "duplicate W3C pointerup/mouseup and keyboard notification must not spend retries");
  assert.deepEqual(q.nextSendBatch(4,{onlyUnsent:true}),[]);
  assert.equal(q.snapshot.pending,4);
  assert.equal(q.snapshot.closed,false);
  assert.deepEqual(q.nextSendBatch(4).map(x=>x.attempt),[2,2,2,2],
    "one existing 170ms retry timer drives second attempt");
  assert.deepEqual(q.nextSendBatch(4).map(x=>x.attempt),[3,3,3,3]);
  assert.throws(()=>q.nextSendBatch(4),/retransmission attempts exhausted/);
  assert.equal(q.snapshot.closed,true,"bounded fail-closed retirement stays authoritative");

  const lab=readFileSync(new URL("../web/prealpha-gesture-live-lab.mjs",import.meta.url),"utf8");
  assert.match(lab,/function drain\(onlyUnsent = false\)/);
  assert.match(lab,/outbox\.nextSendBatch\(4, \{onlyUnsent\}\)/);
  assert.match(lab,/lastFirstSendSequence = next;\s*drain\(true\)/,
    "one physical source sequence drains never-sent edges, not old retries");
  assert.match(lab,/if \(outbox\.snapshot\.pending > 0\) drain\(\);/,
    "the original scheduled timer still owns retries");
});
