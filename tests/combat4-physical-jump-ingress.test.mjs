import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {createPhysicalJumpChord} from "../src/browser/physical-jump-chord.mjs";
import {readFileSync} from "node:fs";

// Execute the actual game keyboard callback and optional actual fast-path
// function. No synthetic DOM event is dispatched and no World hit is inferred.
const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8").replace(/\r\n/g,"\n");
const marker='canvas.addEventListener("keydown", (event) => {';
const begin=source.indexOf(marker)+marker.length;
const end=source.indexOf('\n});\n// Key release',begin);
assert.ok(begin>=marker.length&&end>begin);
const helperStart=source.indexOf('function sendImmediatePhysicalJumpEdge(');
const helperEnd=helperStart<0?-1:source.indexOf('\n}\n',helperStart)+2;

function harness({trusted=true,hidden=false,focused=true,playerId=1,typed=false,cold=false,armed=true}={}) {
 const canvas={},events=[],packets=[];
 const physicalJumpChord=createPhysicalJumpChord();
 const context={canvas,physicalJumpChord,document:{hidden,activeElement:focused?canvas:{}},matchOver:false,
  networkClient:{playerNetId:playerId,sendInput:p=>{events.push('send');packets.push({...p});}},
  clientTick:40,currentInput:{},keys:new Set(),leftButtonDown:true,
  typedLmbEnabled:typed,experimentalGestureLab:armed?{snapshot:{failed:false,closed:false}}:null,
  attackRequested:false,runningAttackRequested:false,heavyAttackRequested:false,
  rollRequested:false,kickRequested:false,jumpRequested:false,dashRequested:false,
  dashMove:null,committedLightMove:null,
  local:{action:0,stamina:100},COMBAT_ACTION:{idle:0},COMBAT:{dash:{staminaCost:20}},
  audio:{isUnlocked:()=>!cold,play:()=>events.push('play'),unlock:()=>events.push('unlock')},
  afterSource0Audio:{noteJump:()=>cold,afterOriginalSend:()=>events.push('after-send')},
  queueStaminaDenial:()=>{},markStaminaDenialSubmitted:()=>events.push('mark'),
  dashGesture:{press:()=>null},window:{},acceptanceScenario:'',
 };
 context.leftButtonCharge={commitLight:()=>{context.attackRequested=true;}};
 context.sampleInput=()=>{Object.assign(context.currentInput,{jump:context.jumpRequested,
  attack:!typed&&context.attackRequested,heavyAttack:false});};
 vm.createContext(context);
 const helper=helperStart<0?'':source.slice(helperStart,helperEnd);
 vm.runInContext(helper+'\nglobalThis.actualKeydown=(event)=>{'+source.slice(begin,end)+'\n};',context);
 const down=(repeat=false)=>context.actualKeydown({code:'Space',repeat,isTrusted:trusted,preventDefault(){}});
 return {context,events,packets,down};
}

test("trusted Space+LMB reaches original input before RAF or cold audio startup",()=>{
 const h=harness({cold:true});h.down();
 assert.equal(h.packets.length,1,"physical chord cannot wait233ms for the next RAF sender");
 assert.deepEqual(h.packets[0],{tick:40,jump:true,attack:true,heavyAttack:false});
 assert.equal(h.context.clientTick,41);
 assert.equal(h.context.jumpRequested,false);
 assert.equal(h.context.attackRequested,false);
 assert.equal(h.events.includes('unlock'),false,"cold audio must be scheduled after original submission");
 h.down(true);assert.equal(h.packets.length,1,"Space auto-repeat cannot replay the one-shot chord");
});

test("selected typed LMB keeps its exclusive attack owner while physical Space uses original input",()=>{
 const h=harness({typed:true});h.down();
 assert.equal(h.packets.length,1);
 assert.equal(h.packets[0].jump,true);assert.equal(h.packets[0].attack,false);
});

test("hidden, unfocused, unadmitted and untrusted callbacks cannot submit an immediate jump",()=>{
 for(const opts of [{trusted:false},{hidden:true},{focused:false},{playerId:0}]) {
  const h=harness(opts);h.down();assert.equal(h.packets.length,0);
 }
});

test("physical submission shares the original uint32 tick owner across wrap",()=>{
 const h=harness();h.context.clientTick=0xffffffff;h.down();
 assert.equal(h.packets[0].tick,0xffffffff);assert.equal(h.context.clientTick,0);
 h.context.keys.delete('Space');h.down();
 assert.equal(h.packets[1].tick,0);assert.equal(h.context.clientTick,1);
});

test("typed negotiation or retired controls cannot leak original gameplay before grant",()=>{
 const pending=harness({typed:true,armed:false});pending.down();assert.equal(pending.packets.length,0);
 const retired=harness({typed:true});retired.context.experimentalGestureLab.snapshot.closed=true;
 retired.down();assert.equal(retired.packets.length,0);
});

// Execute the real Light callback after the original fast Space submission.
// These are two fresh physical edges; the first packet must not erase their chord.
test("fresh Space-first LMB preserves original combined JumpAttack intent after fast Jump",()=>{
 const h=harness();h.context.leftButtonDown=false;h.down();
 assert.equal(h.packets.length,1);
 assert.equal(h.packets[0].jump,true);
 assert.equal(h.packets[0].attack,false);
 Object.assign(h.context,{m111InputProbe:null,pendingStaminaDenial:null,
  leftButtonPressMovement:null,captureLightAttackMovement:()=>({moveX:0,moveY:0}),
  resolveLightAttackReleaseMovement:()=>({moveX:0,moveY:0}),
  rightButtonGesture:{isRunning:()=>false}});
 const start=source.indexOf('  onLight() {')+'  onLight() {'.length;
 const finish=source.indexOf('\n  },\n  onHeavy()',start);
 assert.ok(start>12&&finish>start);
 vm.runInContext('globalThis.actualLight=()=>{'+source.slice(start,finish)+'\n};',h.context);
 h.context.actualLight();h.context.sampleInput();
 assert.equal(h.context.currentInput.attack,true);
 assert.equal(h.context.currentInput.jump,true,"fresh LMB must join its just-submitted physical Space, not become buffered Light34");
});

test("physical chord cannot replay Space, survive release or attach a late unrelated Light",()=>{
 const chord=createPhysicalJumpChord();
 chord.press(100,true);assert.equal(chord.consume(101,true),true);
 assert.equal(chord.consume(102,true),false);
 chord.press(100,true);assert.equal(chord.consume(161,true),false);
 chord.press(100,true);chord.release();assert.equal(chord.consume(101,true),false);
 chord.press(100,true);assert.equal(chord.consume(101,false),false);
 chord.press(100,false);assert.equal(chord.consume(101,true),false);
 chord.press(100,true);assert.equal(chord.consume(99,true),false);
});
