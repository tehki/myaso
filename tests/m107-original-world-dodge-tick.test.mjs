import test from "node:test";
import assert from "node:assert/strict";
import {awaitOriginalHeavyChargeTick} from "../scripts/m107-original-world-dodge-tick.mjs";

const phase=(tick,id=2)=>`COMBAT4_NATIVE_WORLD_PHASE tick=${tick} fighter=${id} action=9 elapsedMs=320.0\n`;
function fixture(output,extra={}) {
 let now=0;
 return {readOutput:()=>output,afterOffset:0,fighterId:2,startTick:261,offsetTicks:20,
  now:()=>now,sleep:ms=>{now+=ms;},timeoutMs:12,...extra};
}
test("M107 dispatch follows the actual World tick, ignoring stale and foreign phase rows",async()=>{
 const row=await awaitOriginalHeavyChargeTick(fixture(phase(260)+phase(290,1)+phase(281)));
 assert.deepEqual(row,{serverTick:281,offsetTicks:20,elapsedMs:320});
 await assert.rejects(()=>awaitOriginalHeavyChargeTick(fixture(phase(280)+phase(290,1))),/not observed/);
});
test("M107 immutable first-red chronology forbids wheel after Heavy already hit Idle",async()=>{
 // Original Quality run41121261743/job124288270883, source#a8893ec4:
 // 288 HIT46 Idle0; 289 Dodge4. The late host timer must not dispatch.
 const trace=phase(287)+"M201_AUTH_ACTION tick=288 fighter=2 from=9 to=10\n"
  +"CORE8C_WORLD_CONTACT tick=288 world=1 outcome=HIT attacker=2 target=1 defenderAction=0 defenderHp=54.0\n";
 await assert.rejects(()=>awaitOriginalHeavyChargeTick(fixture(trace)),/already left charge/);
});
test("M107 bounded World proof rejects partial lines and unavailable output",async()=>{
 await assert.rejects(()=>awaitOriginalHeavyChargeTick(fixture(phase(281).trimEnd())),/not observed/);
 await assert.rejects(()=>awaitOriginalHeavyChargeTick(fixture("",{afterOffset:1})),/unavailable/);
 await assert.rejects(()=>awaitOriginalHeavyChargeTick(fixture(phase(281),{offsetTicks:0})),TypeError);
});
