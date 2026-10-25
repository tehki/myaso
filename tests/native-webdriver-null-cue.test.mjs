import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { dispatchM41ObservedParry, readM41ScalarWorldCue } from "../scripts/m41-native-observed-parry.mjs";
import { isM147RenderedRecoveryCue } from "../scripts/m147-recovery-feedback-convergence.mjs";
const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
function load(name,globals){
  const start=source.indexOf(`async function ${name}(`);
  assert.ok(start>=0);
  return vm.runInNewContext("("+source.slice(start,source.indexOf("\n}",start)+2)+")",globals);
}

test("actual native executor preserves valid null/false/zero and unwraps each browser response exactly once",async()=>{
  for(const value of [null,false,0,"",{value:null,actorId:1}]){
    const execute=load("execute",{webdriver:async()=>({value})});
    assert.equal(await execute("driver","session","return null;"),value);
  }
});

test("actual cue poll cannot issue a wheel for WebDriver null before the genuine actor-bound cue",async()=>{
  const text="Attack committed - your windup is readable.";
  const cue=readM41ScalarWorldCue({online:"Online - player #1 - server tick 1640",
    events:[text],eventTransitions:[{text,t:100}]},0,1);
  let reads=0,wheelAt=0;
  const responses=[null,{value:null},{...cue,actorId:2},{...cue,eventIndex:-1},cue];
  const execute=load("execute",{webdriver:async()=>({value:responses[reads++]})});
  const poll=load("waitForM41WorldWindup",{execute,readM41ScalarWorldCue,sleep:async()=>{}});
  const result=await dispatchM41ObservedParry({sendAttack:async()=>{},
    awaitWorldCue:()=>poll({base:"driver",sessionId:"session"},180,0,1),
    sendWheel:async()=>{wheelAt=reads;}});
  assert.equal(wheelAt,5);
  assert.equal(result.cue,cue);
});

test("standard M147 accepts only actual finite rendered recovery cue for the selected actor",()=>{
  const cue={visible:true,state:"jump-attack-recovery",label:"PUNISH",
    detail:"Jump attack recovery",epochMs:1792963318796,focusLabel:"PUNISH TARGET #1"};
  for(const absent of [null,false,{value:null},{...cue,epochMs:undefined},
    {...cue,visible:false},{...cue,focusLabel:"PUNISH TARGET #3"}])
    assert.equal(isM147RenderedRecoveryCue(absent,1),false);
  assert.equal(isM147RenderedRecoveryCue(cue,1),true);
  assert.match(source,/if \(!isM147RenderedRecoveryCue\(recoveryCue, jumpId\)\)/);
  assert.match(source,/\/session\/\$\{observer.sessionId\}\/execute\/async/);
});
