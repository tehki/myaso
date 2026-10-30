import test from "node:test";
import assert from "node:assert/strict";
import {awaitOriginalWorldShortBlock} from "../scripts/m151-original-world-block.mjs";
import {dispatchR2ReleaseLedShortBlock} from "../scripts/r2-release-led-short-block.mjs";

const block="M201_AUTH_ACTION tick=1329 fighter=2 from=0 to=6\n";
function fixture(output,extra={}) {
 let now=0;
 return {readOutput:()=>output,afterOffset:0,fighterId:2,now:()=>now,
  sleep:ms=>{now+=ms;},timeoutMs:8,...extra};
}
test("M151 requires the fresh intended actor's actual World Block",async()=>{
 assert.deepEqual(await awaitOriginalWorldShortBlock(fixture(block)),{serverTick:1329,fighterId:2});
 await assert.rejects(()=>awaitOriginalWorldShortBlock(fixture(block,{afterOffset:block.length})),/admission missing/);
 await assert.rejects(()=>awaitOriginalWorldShortBlock(fixture(block.replace("fighter=2","fighter=1"))),/admission missing/);
});
test("immutable M151 first-red expired Block and partial proof cannot authorize release",async()=>{
 await assert.rejects(()=>awaitOriginalWorldShortBlock(fixture(block+"M201_AUTH_ACTION tick=1344 fighter=2 from=6 to=0\n")),/already ended/);
 await assert.rejects(()=>awaitOriginalWorldShortBlock(fixture(block.trimEnd())),/admission missing/);
 await assert.rejects(()=>awaitOriginalWorldShortBlock(fixture("",{afterOffset:1})),/unavailable/);
});
test("genuine control callback releases after original World admission with no extra25ms pause",async()=>{
 let output="",released=false;const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const proof=await dispatchR2ReleaseLedShortBlock({
  sendAttackDown:async()=>{},sendWheel:async()=>{},
  awaitTrustedWheel:async()=>{
   queueMicrotask(()=>{output=block;});
   await awaitOriginalWorldShortBlock({readOutput:()=>output,afterOffset:0,fighterId:2,sleep});
   return {trusted:true,deltaY:120};
  },
  sendAttackUp:async()=>{assert.equal(output,block);released=true;},
  sleep,trustedWheelWaitMs:190,postTrustedWheelMs:0,
 });
 assert.equal(released,true);assert.equal(proof.postTrustedWheelMs,0);
});
