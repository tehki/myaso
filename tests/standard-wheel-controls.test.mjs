// Unit execution of the original standard DOM handlers, not native-browser,
// network admission, World parry, or two-host qualification evidence.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { COMBAT } from "../src/combat/model.mjs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";

const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
function originalFunction(name){
  const start=source.indexOf("function "+name+"(");
  const end=source.indexOf("\nfunction ",start+10);
  assert.ok(start>0&&end>start,name+" must be original source");
  return source.slice(start,end);
}
function harness(){
  const surface=()=>({listeners:new Map(),addEventListener(type,callback,options){this.listeners.set(type,{callback,options});}});
  const canvas=surface(),window=surface(),document=Object.assign(surface(),{hidden:false});
  let clock=100,focusCalls=0,preventCalls=0,cancelCalls=0;
  canvas.focus=()=>{focusCalls++;};
  const context={canvas,window,document,COMBAT,COMBAT_ACTION,performance:{now:()=>clock},
    audio:{play(){}},networkClient:null,m41PhysicalChronology:null,queueStaminaDenial(){},keys:new Set(),local:{action:COMBAT_ACTION.idle,stamina:100},
    currentInput:{},typedLmbEnabled:false,matchOver:false,dashGesture:{clearTaps(){}},
    leftButtonCharge:{cancel(){},isCharging:()=>false},rightButtonGesture:{cancel(){},isRunning:()=>false},
    shortBlockUntil:0,middleBlockHeld:false,rollRequested:false,dashRequested:false,dashMove:null,
    attackRequested:false,runningAttackRequested:false,committedLightMove:null,leftButtonDown:false,
    leftButtonPressMovement:null,chordedLeftDown:false,heavyAttackRequested:false,kickRequested:false,
    jumpRequested:false,pendingStaminaDenial:null,mouse:{x:480,y:270},
    animationFrameId:17,cancelAnimationFrame(){cancelCalls++;},requestAnimationFrame:()=>18,
    frameBudget:{reset(){}},snapshotRenderClock:{reset(){}},renderGapTelemetry:{reset(){}},
    visualCamera:{reset(){}},frame(){},
  };
  const wheelStart=source.indexOf('canvas.addEventListener("wheel",');
  const wheelEnd=source.indexOf('}, { passive: false });',wheelStart)+'}, { passive: false });'.length;
  assert.ok(wheelStart>0&&wheelEnd>wheelStart);
  const bindings=['window.addEventListener("blur", releaseInputs);',
    'canvas.addEventListener("blur", releaseInputs);',
    'document.addEventListener("visibilitychange", handleVisibilityChange);'];
  for(const binding of bindings)assert.ok(source.includes(binding));
  runInNewContext([originalFunction("releaseInputs"),originalFunction("sampleInput"),
    originalFunction("sendImmediatePhysicalBlockEdge"),originalFunction("handleVisibilityChange"),
    source.slice(wheelStart,wheelEnd),...bindings].join("\n"),context);
  return {context,canvas,window,document,clock:value=>{clock=value;},
    wheel:(deltaY,isTrusted=false)=>canvas.listeners.get("wheel").callback({deltaY,isTrusted,preventDefault(){preventCalls++;}}),
    sample:()=>{context.sampleInput();return {...context.currentInput};},
    counts:()=>({focusCalls,preventCalls,cancelCalls})};
}

test("actual standard wheel listener maps positive to block, negative to roll and zero to neither",()=>{
  for(const [deltaY,block,dodge] of [[120,true,false],[-120,false,true],[0,false,false]]){
    const h=harness();h.wheel(deltaY);const sample=h.sample();
    assert.equal(sample.block,block);assert.equal(sample.dodge,dodge);
    assert.equal(sample.attack,false);assert.equal(sample.heavyAttack,false);
    assert.equal(h.canvas.listeners.get("wheel").options.passive,false);
    assert.equal(h.counts().focusCalls,1);assert.equal(h.counts().preventCalls,1);
  }
});
test("actual standard positive wheel keeps the original 240ms deadline; duplicate notification cannot author an attack",()=>{
  const h=harness();h.wheel(120);h.wheel(120);
  assert.equal(h.context.shortBlockUntil,340);
  h.clock(339);assert.equal(h.sample().block,true);
  h.clock(340);assert.equal(h.sample().block,false);
  assert.equal(h.sample().attack,false);assert.equal(h.sample().dodge,false);
  assert.equal(COMBAT.block.parryWindowMs,125);assert.equal(COMBAT.block.shortBlockMs,240);
});
test("actual canvas and window blur handlers cancel unsent wheel block/roll and held MMB",()=>{
  for(const target of ["canvas","window"]){
    const h=harness();h.wheel(120);h.wheel(-120);h.context.middleBlockHeld=true;
    h.context.keys.add("KeyD");h[target].listeners.get("blur").callback();
    assert.equal(h.context.shortBlockUntil,0);assert.equal(h.context.keys.size,0);
    const sample=h.sample();assert.equal(sample.block,false);assert.equal(sample.dodge,false);
    assert.equal(sample.moveX,0);assert.equal(sample.attack,false);
  }
});
test("actual hidden-page handler clears pending standard defense before stopping animation frames",()=>{
  const h=harness();h.wheel(120);h.wheel(-120);h.context.middleBlockHeld=true;
  h.document.hidden=true;h.document.listeners.get("visibilitychange").callback();
  assert.equal(h.context.shortBlockUntil,0);assert.equal(h.context.animationFrameId,0);
  assert.equal(h.counts().cancelCalls,1);
  const sample=h.sample();assert.equal(sample.block,false);assert.equal(sample.dodge,false);
  assert.equal(sample.attack,false);assert.equal(sample.heavyAttack,false);
});

// Physical defense must be authored before synchronous focus/layout can stall
// the native callback. Only the original source0 writer may submit this edge.
test("trusted wheel sends original Block before slow canvas focus, with one source0 frame",()=>{
  const h=harness();
  const order=[];
  h.context.clientTick=41;
  h.context.networkClient={playerNetId:2,sendInput:packet=>order.push({
    kind:"send",atPerfMs:h.context.performance.now(),...packet,
  })};
  h.context.markStaminaDenialSubmitted=()=>{};
  h.canvas.focus=()=>{order.push({kind:"focus"});h.clock(320);}; // Simulated 220ms focus/layout stall.
  h.wheel(120,true);
  assert.equal(order[0]?.atPerfMs,100,"urgent input sent before expensive focus/layout");
  assert.deepEqual(order.map(event=>event.kind),["send","focus"],
    "canvas focus must never precede the real authenticated Block-edge submission");
  assert.equal(order[0].tick,41);
  assert.equal(order[0].block,true);
  assert.equal(h.context.clientTick,42);
  assert.equal(h.context.shortBlockUntil,340, "unchanged 240ms Block window");
  assert.equal(COMBAT.block.parryWindowMs,125, "unchanged Parry window");
});
