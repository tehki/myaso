import test from "node:test";
import assert from "node:assert/strict";
import { awaitM35OriginalLightAdmission } from "../scripts/m35-original-light-admission.mjs";

function fixture(chunks) {
  let time=0, index=0;
  return {readOutput:()=>chunks[Math.min(index,chunks.length-1)],afterOffset:0,fighterId:1,
    now:()=>time,sleep:async ms=>{time+=ms;index++;},timeoutMs:10};
}
test("original charging cannot start the reaction before the current actor's Light admission",async()=>{
  const heavy="M201_AUTH_ACTION tick=1470 fighter=1 from=0 to=9\n";
  const light="M201_AUTH_ACTION tick=1472 fighter=1 from=9 to=1\n";
  const result=await awaitM35OriginalLightAdmission(fixture([heavy,heavy,heavy+light]));
  assert.equal(result.tick,1472);assert.equal(result.observedAfterMs,4);
});
test("stale prior-attempt Light and a foreign current Light cannot authorize a wheel",async()=>{
  const stale="M201_AUTH_ACTION tick=100 fighter=1 from=9 to=1\n";
  const f=fixture([stale+"M201_AUTH_ACTION tick=1472 fighter=2 from=9 to=1\n"]);
  f.afterOffset=stale.length;
  await assert.rejects(awaitM35OriginalLightAdmission(f),/did not admit/);
});
test("already resolved contact and actual HeavyActive fail closed, without scheduling late input",async()=>{
  const light="M201_AUTH_ACTION tick=1472 fighter=1 from=9 to=1\n";
  await assert.rejects(awaitM35OriginalLightAdmission(fixture([
    light+"CORE8C_WORLD_CONTACT tick=1480 world=1 outcome=HIT attacker=1 target=2\n",
  ])),/already resolved/);
  await assert.rejects(awaitM35OriginalLightAdmission(fixture([
    "M201_AUTH_ACTION tick=1472 fighter=1 from=9 to=10\n",
  ])),/HeavyActive/);
});
test("no World receipt, invalid actor and unbounded waits cannot manufacture admission",async()=>{
  await assert.rejects(awaitM35OriginalLightAdmission(fixture([""])),/did not admit/);
  await assert.rejects(awaitM35OriginalLightAdmission({...fixture([""]),fighterId:0}),TypeError);
  await assert.rejects(awaitM35OriginalLightAdmission({...fixture([""]),timeoutMs:181}),TypeError);
});
