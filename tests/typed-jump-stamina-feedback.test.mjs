import test from "node:test";
import assert from "node:assert/strict";
import {createTypedJumpStaminaFeedback} from "../src/browser/typed-jump-stamina-feedback.mjs";

function scenario({baseline=21.1998,stamina=7.1998,clientTick=90,serverTick=493}={}){
 const ui=createTypedJumpStaminaFeedback(),lease={};
 ui.originalJump({actorId:1,lease,action:0,clientTick,stamina:baseline,now:10});
 const press={jump:true,trusted:true,spaceHeld:true,pointerId:1,gestureId:7,sequence:9,actorId:1,lease,now:12,stamina:baseline};
 ui.press(press);
 const receipt={source:0,action:5,gestureId:7,sequence:9,status:1,transportSettled:true,serverTick};
 const snapshot={own:{netId:1,hp:100,action:15,stamina},lease,alive:true,focused:true,
  serverTick,processedClientTick:clientTick,now:100};
 return {ui,lease,press,receipt,snapshot};
}
test("real native Jump14 denial waits for both typed receipt and original World snapshot",()=>{
 const {ui,lease,receipt,snapshot}=scenario();
 assert.equal(ui.observe(snapshot),null,"World alone cannot identify the current typed gesture");
 ui.acknowledge(receipt,lease);
 assert.deepEqual(ui.observe(snapshot),{action:"jump-attack-chord",stamina:7.1998});
 ui.acknowledge(receipt,lease);
 assert.equal(ui.observe(snapshot),null,"duplicate ACK cannot replay a displayed cue");
});
test("ACK alone, older World/input and affordable conversion never show a denial",()=>{
 for(const change of [{serverTick:492},{processedClientTick:89},{own:{netId:1,hp:100,action:15,stamina:12}}]){
  const {ui,lease,receipt,snapshot}=scenario();ui.acknowledge(receipt,lease);
  assert.equal(ui.observe({...snapshot,...change}),null);
 }
 for(const action of [1,2,3,16,17,18,21,22,23]){
  const {ui,lease,receipt,snapshot}=scenario();ui.acknowledge(receipt,lease);
  assert.equal(ui.observe({...snapshot,own:{...snapshot.own,action}}),null);
 }
});
test("cancel, focus, actor/lease retirement, death and expiry discard the cue",()=>{
 for(const change of [{focused:false},{alive:false},{lease:{}},{now:913},
   {own:{netId:2,hp:100,action:15,stamina:7}},{own:{netId:1,hp:0,action:19,stamina:7}}]){
  const {ui,lease,receipt,snapshot}=scenario();ui.acknowledge(receipt,lease);
  assert.equal(ui.observe({...snapshot,...change}),null);assert.equal(ui.observe(snapshot),null);
 }
 const {ui,lease,receipt,snapshot}=scenario();
 ui.cancel(2);ui.acknowledge(receipt,lease);ui.cancel(1);
 assert.equal(ui.observe(snapshot),null);
});
test("wrong receipt, untrusted/newer ordinary press and accepted attack cannot acquire an old cue",()=>{
 for(const change of [{gestureId:8},{sequence:10},{source:1},{action:1},{status:3},{transportSettled:false}]){
  const {ui,lease,receipt,snapshot}=scenario();ui.acknowledge({...receipt,...change},lease);
  assert.equal(ui.observe(snapshot),null);
 }
 for(const change of [{jump:false},{trusted:false},{stamina:100,now:100}]){
  const {ui,lease,press,receipt,snapshot}=scenario();ui.press({...press,...change});
  ui.acknowledge(receipt,lease);assert.equal(ui.observe(snapshot),null);
 }
});
test("low-budget Idle needs processed original input; an existing airborne attempt costs12",()=>{
 const {ui,lease,receipt,snapshot}=scenario({baseline:8,stamina:8});ui.acknowledge(receipt,lease);
 assert.deepEqual(ui.observe({...snapshot,own:{...snapshot.own,action:0}}),
  {action:"jump-attack-chord",stamina:8});
 const airborne=scenario({baseline:10,stamina:10});
 airborne.ui.press({...airborne.press,now:200});airborne.ui.acknowledge(airborne.receipt,airborne.lease);
 assert.deepEqual(airborne.ui.observe({...airborne.snapshot,now:300}),{action:"jump-attack",stamina:10});
});
test("World/input tick wrap remains bound; duplicate-status first ACK can settle one cue",()=>{
 const {ui,lease,receipt,snapshot}=scenario({clientTick:0xffffffff,serverTick:0xffffffff});
 ui.acknowledge({...receipt,status:2},lease);
 assert.deepEqual(ui.observe({...snapshot,serverTick:0,processedClientTick:0}),
  {action:"jump-attack-chord",stamina:7.1998});
});

test("one Space labels only the first LMB; keyUP or another accepted press preserves airborne12",()=>{
 for(const spaceHeld of [true,false]){
  const {ui,lease,press,receipt,snapshot}=scenario();
  ui.press({...press,gestureId:8,sequence:11,now:35,stamina:7,spaceHeld});
  ui.acknowledge(receipt,lease);
  assert.equal(ui.observe(snapshot),null,"an older gesture receipt cannot confirm the new attempt");
  ui.acknowledge({...receipt,gestureId:8,sequence:11},lease);
  assert.deepEqual(ui.observe(snapshot),{action:"jump-attack",stamina:7.1998});
 }
 const {ui,lease,press,receipt,snapshot}=scenario();
 ui.reset();ui.originalJump({actorId:1,lease,action:0,clientTick:90,stamina:21,now:10});
 ui.press({...press,spaceHeld:false,stamina:7});ui.acknowledge(receipt,lease);
 assert.deepEqual(ui.observe(snapshot),{action:"jump-attack",stamina:7.1998});
});
