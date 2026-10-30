import {createPhysicalJumpChord} from "../src/browser/physical-jump-chord.mjs";
// Execute the production DOM callback, charge classifier, prediction and30Hz
// submission functions. These are unit input-plane tests, not native/World proof.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";
import { captureLightAttackMovement, resolveLightAttackReleaseMovement } from "../src/browser/light-attack-movement.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { NETWORK } from "../src/network/constants.mjs";

const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const fn=name=>{
  const start=source.indexOf("function "+name+"(");
  let end=source.indexOf("\nfunction ",start+10);
  if(end<0)end=start+source.slice(start).match(/^[\s\S]*?\r?\n}/)[0].length;
  assert.ok(start>0&&end>start,name);
  return source.slice(start,end);
};
function harness(phase){
  let clock=0;
  const listeners=new Map(),sent=[];
  const canvas={width:960,height:540,focus(){},getBoundingClientRect:()=>({left:0,top:0,width:960,height:540}),
    addEventListener(type,callback){listeners.set(type,callback);}};
  const context={physicalJumpChord:createPhysicalJumpChord(),canvas,createLeftButtonCharge,captureLightAttackMovement,resolveLightAttackReleaseMovement,
    COMBAT,COMBAT_ACTION,NETWORK,performance:{now:()=>clock},Date:{now:()=>clock},
    audio:{play(){},isUnlocked:()=>true},keys:new Set(),local:{action:0,initialized:true,x:300,y:300,facing:0,hp:100,guard:100,stamina:100},
    typedLmbEnabled:false,matchOver:false,currentInput:{},predictionStep:phase,clientTick:57,
    networkClient:{sendInput(sample){sent.push({...sample});}},markStaminaDenialSubmitted(){},
    acceptanceScenario:"uirollknockdownffahit",m111InputProbe:null,pendingStaminaDenial:null,
    rightButtonGesture:{isRunning:()=>false,cancel(){}},queueStaminaDenial(){},
    mouse:{x:300,y:270},shortBlockUntil:0,middleBlockHeld:false,rollRequested:false,dashRequested:false,dashMove:null,
    attackRequested:false,heavyAttackRequested:false,runningAttackRequested:false,committedLightMove:null,
    leftButtonPressMovement:null,leftButtonDown:false,chordedLeftDown:false,kickRequested:false,jumpRequested:false,
    dashGesture:{clearTaps(){}},staminaRegenBlockedUntil:0,predictedDashDir:{x:0,y:0},
  };
  const chargeStart=source.indexOf("const leftButtonCharge = createLeftButtonCharge({");
  const chargeEnd=source.indexOf("const rightButtonGesture =",chargeStart);
  const downStart=source.indexOf('canvas.addEventListener("pointerdown",');
  const downEnd=source.indexOf("function onLeftPointerUp(",downStart);
  const upStart=source.indexOf("function onLeftPointerUp(");
  const upEnd=source.indexOf('canvas.addEventListener("pointerup", onLeftPointerUp);',upStart);
  assert.ok(chargeStart>0&&chargeEnd>chargeStart&&downEnd>downStart&&upEnd>upStart);
  runInNewContext([source.slice(chargeStart,chargeEnd),source.slice(downStart,downEnd),source.slice(upStart,upEnd),
    fn("updateMouse"),fn("releaseInputs"),fn("sampleInput"),fn("simulatePrediction"),fn("predictMovement"),fn("clamp")].join("\n"),context);
  const event={button:0,pointerId:1,clientX:300,clientY:270};
  return {context,sent,clock:value=>{clock=value;},down:()=>listeners.get("pointerdown")(event),
    up:()=>{context.onLeftPointerUp(event);context.onLeftPointerUp(event);},
    step:()=>context.simulatePrediction(1000/60)};
}

for(const phase of [0,1])test("actual standard24ms LMB release survives prediction/send phase "+phase,()=>{
  const h=harness(phase);h.down();h.clock(12);h.step();
  h.clock(24);h.up();
  assert.equal(h.context.attackRequested,true,"matching physical release authors original onLight latch");
  h.clock(29);h.step();
  if(phase===1)assert.equal(h.context.attackRequested,true,"intervening60Hz prediction cannot consume unsent light");
  h.clock(46);h.step();h.clock(63);h.step();h.clock(80);h.step();
  const releases=h.sent.filter(sample=>sample.attack&&!sample.heavyAttack);
  assert.equal(releases.length,1,"one real release produces exactly one original30Hz light sample");
  assert.equal(h.context.attackRequested,false);
  assert.equal(h.sent.filter(sample=>sample.heavyAttack&&!sample.attack).length,0,"short click never authors standalone heavy");
});
test("actual focus cancellation intentionally clears an unsent release; it is distinct from prediction-phase loss",()=>{
  const h=harness(1);h.down();h.clock(12);h.step();h.clock(24);h.up();
  h.context.releaseInputs();h.clock(29);h.step();h.clock(46);h.step();
  assert.equal(h.sent.some(sample=>sample.attack&&!sample.heavyAttack),false);
  assert.equal(h.context.attackRequested,false);
});
