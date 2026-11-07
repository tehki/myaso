import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {planMain0NativeJumpReviewChord} from "../tools/art/main0-jump-review-native-chord.mjs";

test("Main0 original Rust jump-review uses Space-first genuine native W3C two-source chord",()=>{
  const a=planMain0NativeJumpReviewChord({keyboardId:"jump-key",pointerId:"jump-pointer",holdMs:90});
  assert.equal(a.actions.length,2);
  const [key,pointer]=a.actions;
  assert.equal(key.type,"key");
  assert.equal(pointer.type,"pointer");
  assert.equal(pointer.parameters.pointerType,"mouse");
  assert.deepEqual(key.actions.map(x=>x.type),["keyDown","pause","pause","pause","keyUp"]);
  assert.deepEqual(pointer.actions.map(x=>x.type),["pause","pointerDown","pause","pointerUp","pause"]);
  assert.equal(key.actions[0].value," ");
  assert.equal(key.actions[1].duration,0);
  assert.equal(pointer.actions[0].duration,0);
  assert.equal(pointer.actions[1].button,0);
  assert.equal(pointer.actions[3].button,0);
  assert.equal(key.actions[2].duration,90);
  assert.equal(pointer.actions[2].duration,90);
  assert.equal(key.actions.length,pointer.actions.length);
  assert.equal(key.actions.filter(x=>x.type==="keyDown").length,1);
  assert.equal(pointer.actions.filter(x=>x.type==="pointerDown").length,1);
  assert.equal(pointer.actions.filter(x=>x.type==="pointerUp").length,1);
  assert.equal(key.actions.filter(x=>x.type==="keyUp").length,1);
  assert.ok(!pointer.actions.some(x=>x.type==="pointerMove"),
    "separate genuine pre-aim is mandatory, no sluggish pointer move in jump chord");
});

test("Main0 jump review cannot extend original World chord by arbitrary W3C timer",()=>{
  for(const v of [0,20,44,121,135,200,320,Infinity,NaN,90.1]){
    assert.throws(()=>planMain0NativeJumpReviewChord({keyboardId:"key",pointerId:"mouse",holdMs:v}),TypeError);
  }
  for(const x of [{keyboardId:"",pointerId:"mouse"},{keyboardId:"key",pointerId:"key"},
    {keyboardId:"key",pointerId:""},{pointerId:"mouse"},{keyboardId:"key"}]){
    assert.throws(()=>planMain0NativeJumpReviewChord(x),TypeError);
  }
});

test("Jump review preserves strict original Rust action, actor and authenticated receipt gates",()=>{
  const runner=readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs",import.meta.url),"utf8");
  const start=runner.indexOf('}else if(physicalMode==="jump-review"){');
  const end=runner.indexOf('}else if(physicalMode==="space-guard"){',start);
  const part=runner.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(part,/planMain0NativeJumpReviewChord\(\{/);
  assert.match(part,/"genuine physical Space\+LMB order"/);
  assert.match(part,/"all native chord edges must be isTrusted"/);
  assert.match(part,/classifyOriginalWorldJumpAttackEntry\(log,1/);
  assert.match(part,/worldTransition\(log,1,16,17\)/);
  assert.match(part,/COMBAT4_JUMP_NATIVE_FIRST_RED/);
  assert.match(part,/observedSpaceToPointerDownMs:chordGapMs/);
  assert.match(part,/combat4-jump-review-FIRST-RED\.json/);
  assert.match(part,/authoritativeWorldRequired:true,releaseHold:true/);
  assert.match(part,/"original authenticated World-lock receipt proves one typed JumpAttack action5"/);
  assert.match(part,/"no parallel sampled ordinary Light attack"/);
  assert.match(part,/assert\.equal\(result\.p\.failed,false/);
  assert.match(part,/assert\.equal\(result\.p\.closed,false/);
});
