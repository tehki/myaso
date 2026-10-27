import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
const start=source.indexOf("function sendImmediatePhysicalBlockEdge(trusted) {");
const end=source.indexOf("function simulatePrediction(stepMs)",start);
assert.ok(start>0 && end>start,"actual original DOM Block-edge sender must exist");
const realCode=source.slice(start,end);
function harness(overrides={}){
 const sent=[],audio=[],samples=[],denials=[];
 const env={
  document:{hidden:false},matchOver:false,
  networkClient:{playerNetId:2,sendInput:p=>sent.push({...p})},
  currentInput:{attack:true,heavyAttack:false,moveX:1,moveY:0,facing:2,block:true,jump:true},
  clientTick:241,
  attackRequested:true,runningAttackRequested:false,committedLightMove:{moveX:1,moveY:0},
  heavyAttackRequested:false,rollRequested:false,kickRequested:false,
  jumpRequested:true,dashRequested:false,dashMove:null,
  sampleInput:args=>samples.push(args),
  markStaminaDenialSubmitted:(tick,input)=>denials.push({tick,input:{...input}}),
  afterSource0Audio:{afterOriginalSend:input=>audio.push({...input})},
  m41PhysicalChronology:{immediateSendInvocation:(tick,input)=>({tick,block:input.block,kind:"physical-wheel-original-v1"})},
  window:{__MYASO_ACCEPTANCE_STATE__:{inputSubmissions:[]}},Date,
  ...overrides,
 };
 runInNewContext(realCode+"\nthis.callOriginalPhysicalBlock = sendImmediatePhysicalBlockEdge;",env);
 return {env,sent,audio,samples,denials,send:trusted=>env.callOriginalPhysicalBlock(trusted)};
}
test("real trusted Block edge uses original source0 v1 immediately without RAF or replaying one-shots",()=>{
 const h=harness();
 h.send(true);
 assert.equal(h.sent.length,1);
 assert.equal(h.sent[0].tick,241);
 assert.equal(h.sent[0].block,true);
 assert.equal(h.sent[0].attack,true);
 assert.equal(h.sent[0].jump,true);
 assert.equal(h.env.clientTick,242);
 assert.equal(h.env.attackRequested,false);
 assert.equal(h.env.jumpRequested,false);
 assert.equal(h.env.committedLightMove,null);
 assert.equal(h.denials.length,1);
 assert.equal(h.audio.length,1);
 assert.equal(h.samples.length,1);
 assert.equal(h.samples[0].playStepAudio,false);
 assert.equal(h.env.window.__MYASO_ACCEPTANCE_STATE__.inputSubmissions.length,1);
});
test("untrusted/synthetic, hidden, disconnected, match-over Block never receives priority send",()=>{
 for(const [mod,trusted] of [[{},false],[{document:{hidden:true}},true],
  [{networkClient:{playerNetId:null,sendInput(){throw Error("unexpected")}}},true],
  [{matchOver:true},true]]) {
  const h=harness(mod);
  h.send(trusted);
  assert.equal(h.sent.length,0);
  assert.equal(h.env.clientTick,241);
  assert.equal(h.samples.length,0);
 }
});
test("negative wheel still belongs to original roll path, never the urgent Block edge",()=>{
 const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const start=source.indexOf('canvas.addEventListener("wheel"');
 const end=source.indexOf('canvas.addEventListener("pointermove"',start);
 const actual=source.slice(start,end);
 assert.match(actual,/if \(event.deltaY < 0\) \{\s*canvas\.focus\(\);\s*rollRequested = true;/);
 assert.match(actual,/else if \(event.deltaY > 0\) \{/);
 assert.match(actual,/sendImmediatePhysicalBlockEdge\(event.isTrusted === true\)/);
});
