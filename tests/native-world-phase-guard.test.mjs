import assert from "node:assert/strict";
import test from "node:test";
import {currentNativeWorldPhase,dispatchNativeHeldHeavyGuard,awaitNativeHeavyRecoveryExit} from "../scripts/native-world-phase-guard.mjs";

test("expired Block, wrong actor, browser cue and truncated proof cannot release a held Heavy",()=>{
 const phase="COMBAT4_NATIVE_WORLD_PHASE tick=10 fighter=2 action=6 elapsedMs=133.3\n";
 const options={afterOffset:0,fighterId:2,action:6};
 assert.equal(currentNativeWorldPhase(phase,options).elapsedMs,133.3);
 assert.equal(currentNativeWorldPhase(phase+"M201_AUTH_ACTION tick=11 fighter=2 from=6 to=0\n",options),null);
 assert.equal(currentNativeWorldPhase(phase,{...options,fighterId:3}),null);
 assert.equal(currentNativeWorldPhase(phase.slice(0,-1),options),null);
 assert.equal(currentNativeWorldPhase("W3C ACK Heavy READY320\n",options),null);
 assert.equal(currentNativeWorldPhase(phase,{...options,afterOffset:phase.length}),null);
 assert.equal(currentNativeWorldPhase(phase,{...options,requireEntry:true}),null,"old held phase cannot adopt a new physical DOWN");
});

test("recovery buffer proof requires a fresh current original recovery, never its stale last sample",()=>{
 const options={afterOffset:0,fighterId:1,action:3,requireEntry:true};
 const phase="M201_AUTH_ACTION tick=10 fighter=1 from=2 to=3\nCOMBAT4_NATIVE_WORLD_PHASE tick=20 fighter=1 action=3 elapsedMs=166.7\n";
 assert.equal(currentNativeWorldPhase(phase,options).elapsedMs,166.7);
 assert.equal(currentNativeWorldPhase(phase+"M201_AUTH_ACTION tick=26 fighter=1 from=3 to=0\n",options),null);
 assert.equal(currentNativeWorldPhase(phase+"M201_AUTH_ACTION tick=26 fighter=1 from=3 to=1\n",options),null);
 assert.equal(currentNativeWorldPhase(phase,{...options,afterOffset:phase.length}),null);
});

test("native controller waits for actual READY320 and Block beyond125, without a fixed release clock",async()=>{
 let output="",clock=0,blockAge=-1;const calls=[];
 const result=await dispatchNativeHeldHeavyGuard({readOutput:()=>output,attackerId:1,defenderId:2,guard:"block",wheelCount:2,now:()=>clock,
  sendDown:async()=>{calls.push("DOWN");output+="M201_AUTH_ACTION tick=1 fighter=1 from=0 to=9\nCOMBAT4_NATIVE_WORLD_PHASE tick=1 fighter=1 action=9 elapsedMs=0.0\n";},
  sendWheel:async()=>{calls.push("WHEEL");blockAge=0;output+="M201_AUTH_ACTION tick=21 fighter=2 from=0 to=6\nCOMBAT4_NATIVE_WORLD_PHASE tick=21 fighter=2 action=6 elapsedMs=0.0\n";},
  sendUp:async()=>{calls.push("UP");assert.ok(clock>=320);assert.ok(blockAge>=133.3);},
  sleep:async ms=>{clock+=ms;if(blockAge<0)output+=`COMBAT4_NATIVE_WORLD_PHASE tick=20 fighter=1 action=9 elapsedMs=${Math.min(320,clock).toFixed(1)}\n`;
   else{blockAge+=ms;output+=`COMBAT4_NATIVE_WORLD_PHASE tick=29 fighter=2 action=6 elapsedMs=${blockAge.toFixed(1)}\n`;}}});
 assert.deepEqual(calls,["DOWN","WHEEL","WHEEL","UP"]);assert.equal(result.ready.elapsedMs,320);
 assert.ok(result.guardPhase.elapsedMs>125);
});

test("punish observes this Heavy's complete recovery, excluding old Light and other actor exits",async()=>{
 let output="M201_AUTH_ACTION tick=1 fighter=1 from=11 to=0\n",clock=0;
 const afterOffset=output.length;
 const recovered=await awaitNativeHeavyRecoveryExit({readOutput:()=>output,afterOffset,fighterId:1,now:()=>clock,
  sleep:async ms=>{clock+=ms;if(clock===2)output+="M201_AUTH_ACTION tick=10 fighter=1 from=3 to=0\nM201_AUTH_ACTION tick=12 fighter=2 from=11 to=0\n";
   if(clock===4)output+="M201_AUTH_ACTION tick=20 fighter=1 from=9 to=10\nM201_AUTH_ACTION tick=26 fighter=1 from=10 to=11\nM201_AUTH_ACTION tick=52 fighter=1 from=11 to=0\n";}});
 assert.deepEqual(recovered,{activeTick:20,recoveryTick:26,idleTick:52});
 assert.ok((recovered.idleTick-recovered.recoveryTick)*1000/60>=420);
});
