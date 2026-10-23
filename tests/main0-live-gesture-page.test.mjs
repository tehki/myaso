import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { activateLoopbackGestureLab } from "../web/prealpha-gesture-live-lab.mjs";
import { decodeProposedTypedGestureEvent } from "../src/network/prealpha-lmb-gesture-proposal.mjs";

const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
function event(type, fields) {
  const e = new Event(type,{cancelable:true,bubbles:true});
  Object.assign(e,fields);
  return e;
}
function createFixture(pageHost="localhost",serverHost="127.0.0.1") {
  const canvas=new EventTarget(),win=new EventTarget(),doc=new EventTarget(),wire=[];
  doc.activeElement=canvas; doc.hidden=false;
  win.location={hostname:pageHost};
  let grantCalls=0, closed=false;
  const gameClient={
    transport:{webTransportUrl:"https://"+serverHost+":4433/game"},
    async negotiateExperimentalGestureV2(){grantCalls++;return true;},
    async sendExperimentalGestureEdge(bytes){wire.push(decodeProposedTypedGestureEvent(bytes));},
    close(){closed=true;},
  };
  return {canvas,win,doc,wire,gameClient,
    get grantCalls(){return grantCalls;},get closed(){return closed;},
    options:{gameClient,canvas,windowObj:win,documentObj:doc,getClientTick:()=>5},
  };
}

test("actual first-party pointerdown submits source0 light PRESS before mouse up, without v1 sampler",async()=>{
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try {
  assert.equal(f.grantCalls,1);
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:7,button:0,buttons:1}));
  await pause(10);
  assert.deepEqual(f.wire.map(e=>[e.source,e.action]),[[0,1]]);
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:7,button:0,buttons:0}));
  await pause(10);
  assert.deepEqual(f.wire.filter(e=>e.action===3).map(e=>e.source),[0]);
  assert.equal(lab.outbox.snapshot.activeSources.length,0);
 }finally{lab.close("test");}
});

test("genuine hold upgrade is an intent before server-controlled READY, terminal remains physical UP",async()=>{
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:8,button:0,buttons:1}));
  await pause(125);
  assert.ok(f.wire.some(e=>e.source===0&&e.action===2),"held pointer queues upgrade request");
  assert.ok(!f.wire.some(e=>e.action===3),"no phantom RELEASE at 85ms/125ms");
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:8,button:0,buttons:0}));
  await pause(10);
  assert.ok(f.wire.some(e=>e.source===0&&e.action===3),"only actual physical UP terminates hold");
 }finally{lab.close("test");}
});

test("LMB and KeyE share one monotonic actor connection allocator and release-only KeyE",async()=>{
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 try{
  f.win.dispatchEvent(event("keydown",{code:"KeyE",repeat:false}));
  await pause(10);
  assert.deepEqual(f.wire.map(e=>[e.source,e.action]),[[1,1]]);
  f.win.dispatchEvent(event("keyup",{code:"KeyE"}));
  await pause(10);
  assert.ok(f.wire.some(e=>e.source===1&&e.action===3));
  f.canvas.dispatchEvent(event("pointerdown",{pointerType:"mouse",pointerId:10,button:0,buttons:1}));
  await pause(10);
  assert.ok(f.wire.some(e=>e.source===0&&e.action===1));
  const initialIds=f.wire.filter(e=>e.action===1).map(e=>e.sequence);
  assert.deepEqual(initialIds,[1,3],"one shared sequence owner across KeyE and LMB");
  f.win.dispatchEvent(event("pointerup",{pointerType:"mouse",pointerId:10,button:0,buttons:0}));
  await pause(10);
 }finally{lab.close("test");}
});

test("public target or public webpage refuses before any grant or physical event attachment",async()=>{
 for(const f of [createFixture("game.open-trust-layer.org"),createFixture("localhost","game.open-trust-layer.org")]){
  await assert.rejects(activateLoopbackGestureLab(f.options),/cannot activate on public hosts/);
  assert.equal(f.grantCalls,0);
  assert.equal(f.wire.length,0);
 }
});

test("blur/pagehide retires source owner, never sends a phantom RELEASE or reuses old QUIC",async()=>{
 const f=createFixture(),lab=await activateLoopbackGestureLab(f.options);
 f.win.dispatchEvent(event("keydown",{code:"KeyE",repeat:false}));
 await pause(10);
 f.win.dispatchEvent(event("pagehide",{}));
 await pause(10);
 assert.equal(f.closed,true);
 assert.equal(lab.snapshot.closed,true);
 assert.ok(!f.wire.some(e=>e.action===3),"navigation must not synthesize strike");
 f.win.dispatchEvent(event("keyup",{code:"KeyE"}));
 await pause(10);
 assert.ok(!f.wire.some(e=>e.action===3),"old lease cannot send terminal after pagehide");
});

test("original player-facing online client mutually excludes legacy v1 attack writer in opt-in lab",()=>{
 const game=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(game,/if \(gestureLabRequested && !reviewedGestureLab\)/);
 assert.match(game,/currentInput\.attack = !reviewedGestureLab &&/);
 assert.match(game,/currentInput\.heavyAttack = !reviewedGestureLab &&/);
 assert.match(game,/if \(!reviewedGestureLab && event\.code === "KeyE"/);
 assert.match(game,/onExperimentalGestureAck\(bytes, lease\)/);
 assert.match(game,/await activateLoopbackGestureLab\(/);
 assert.match(game,/if \(reviewedGestureLab\) return; \/\/ v2 capture owns edge/);
});
