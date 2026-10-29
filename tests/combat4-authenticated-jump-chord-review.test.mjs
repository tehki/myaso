// Review-only action5 producer: no public activation or client HIT authority.
import assert from "node:assert/strict";
import {test} from "node:test";
import {activateLoopbackGestureLab} from "../web/prealpha-gesture-live-lab.mjs";
import {GESTURE_ACTION,decodeProposedTypedGestureEvent} from "../src/network/prealpha-lmb-gesture-proposal.mjs";

function ev(type,props={}) {
  const e=new Event(type,{bubbles:true,cancelable:true});
  for(const [name,value] of Object.entries(props)) Object.defineProperty(e,name,{value});
  return e;
}
function setup(optIn) {
  const canvas=new EventTarget(),windowObj=new EventTarget(),documentObj=new EventTarget();
  windowObj.location={hostname:"127.0.0.1"};
  documentObj.activeElement=canvas;
  documentObj.hidden=false;
  let chord=true,closed=false;
  const bytes=[];
  const gameClient={
    transport:{webTransportUrl:"https://127.0.0.1:4433/game"},
    async negotiateExperimentalGestureV2(){return true;},
    async sendExperimentalGestureEdge(data){bytes.push(decodeProposedTypedGestureEvent(data));},
    close(){closed=true;},
  };
  return {canvas,windowObj,documentObj,bytes,
    get closed(){return closed;},
    setChord(value){chord=value;},
    options:{gameClient,canvas,windowObj,documentObj,
      getClientTick:()=>900,isJumpAttackChord:()=>chord,
      enableJumpAttackReview:optIn}};
}
const down=f=>f.canvas.dispatchEvent(ev("pointerdown",{pointerId:17,pointerType:"mouse",button:0,buttons:1}));
const up=f=>f.windowObj.dispatchEvent(ev("pointerup",{pointerId:17,pointerType:"mouse",button:0,buttons:0}));
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
test("explicit loopback JumpAttack uses ONE source0 action5+RELEASE, no Heavy",async()=>{
 const f=setup(true),lab=await activateLoopbackGestureLab(f.options);
 try{
  down(f);await flush();up(f);await flush();
  assert.deepEqual(f.bytes.map(e=>e.action),
    [GESTURE_ACTION.JUMP_ATTACK,GESTURE_ACTION.RELEASE]);
  assert.deepEqual(f.bytes.map(e=>e.sequence),[1,2]);
  assert.equal(f.bytes[0].gestureId,f.bytes[1].gestureId);
  assert.equal(f.bytes[0].source,0);
  assert.equal(f.closed,false);
  f.setChord(false);
  down(f);await flush();up(f);await flush();
  assert.deepEqual(f.bytes.map(e=>e.action),[5,3,1,3]);
  assert.equal(f.bytes[2].gestureId,f.bytes[3].gestureId);
  assert.notEqual(f.bytes[0].gestureId,f.bytes[2].gestureId);
 }finally{lab.close("test");}
});
test("old reviewed gestureLab WITHOUT explicit jump review still emits zero typed Light",async()=>{
 const f=setup(false),lab=await activateLoopbackGestureLab(f.options);
 try{
  down(f);await flush();up(f);await flush();
  assert.equal(f.bytes.length,0);
  assert.equal(f.closed,false);
 }finally{lab.close("test");}
});
test("review-only action5 cannot be emitted as KeyE or claim success by ACK",async()=>{
 const f=setup(true),lab=await activateLoopbackGestureLab(f.options);
 try{
  down(f);await flush();
  assert.equal(f.bytes.length,1);
  assert.deepEqual([f.bytes[0].source,f.bytes[0].action,f.bytes[0].clientTick],[0,5,900]);
  assert.equal(lab.snapshot.closed,false);
 }finally{lab.close("test");}
});
