import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { auditGuardTrace, auditM320Log } from "../scripts/combat4-native-guard-trace-audit.mjs";

// Original protected M194 on #778, quality #39788267914.
// These are authoritative logged World transitions, not mock combat success.
const genuineFirst=[
 "M201_AUTH_ACTION tick=273 fighter=1 from=0 to=9",
 "M201_AUTH_ACTION tick=274 fighter=1 from=9 to=1",
 "M201_AUTH_ACTION tick=275 fighter=2 from=0 to=6",
 "M201_AUTH_ACTION tick=282 fighter=1 from=1 to=2",
 "M201_AUTH_BLOCK tick=282 attacker=1 target=2",
 "M201_AUTH_ACTION tick=287 fighter=1 from=2 to=3",
];
const genuineSecond=[
 "M201_AUTH_ACTION tick=307 fighter=1 from=0 to=9",
 "M201_AUTH_ACTION tick=308 fighter=1 from=9 to=1",
 "M201_AUTH_ACTION tick=310 fighter=2 from=0 to=6",
 "M201_AUTH_ACTION tick=316 fighter=1 from=1 to=7",
 "M201_AUTH_PARRY tick=316 attacker=1 target=2",
];
const packet=(attempt,tickLines)=>({attempt,attackerNetId:1,defenderNetId:2,tickLines});
test("M194 true first original server tick Block is retained without invented parry",()=>{
 const result=auditGuardTrace(packet(1,genuineFirst));
 assert.equal(result.evidenceComplete,true);
 assert.equal(result.fullNativeAcceptanceProven,false);
 assert.deepEqual(result.results,[{
  authoritativeResult:"BLOCK",hitServerTick:282,blockStartServerTick:275,
  attackerWindupServerTick:274,serverTickIndexGap:7,
  boundaryContext:"AMBIGUOUS_NEEDS_AUTHORITY_ELAPSED_MS",
 }]);
});
test("M194 real second original Parry occurred six ticks after World Block entered",()=>{
 const result=auditGuardTrace(packet(2,genuineSecond));
 assert.equal(result.evidenceComplete,true);
 assert.deepEqual(result.results,[{
  authoritativeResult:"PARRY",hitServerTick:316,blockStartServerTick:310,
  attackerWindupServerTick:308,serverTickIndexGap:6,
  boundaryContext:"SHORT_GAP_COMPATIBLE_WITH_PARRY",
 }]);
});
test("M193 native historical eight-tick genuine block is not conflated with second-six-tick parry",()=>{
 const result=auditGuardTrace(packet(3,[
  "M201_AUTH_ACTION tick=383 fighter=1 from=9 to=1",
  "M201_AUTH_ACTION tick=385 fighter=2 from=0 to=6",
  "M201_AUTH_BLOCK tick=394 attacker=1 target=2",
 ]));
 assert.equal(result.results[0].serverTickIndexGap,9);
 assert.equal(result.results[0].boundaryContext,"GAP_COMPATIBLE_WITH_GUARDED_CONTACT");
});
test("actual timestamp-prefixed CI output parsed, not the previous trial, and no acceptance invented",()=>{
 const prefix="2026-10-22T13:40:42.2195566Z ";
 const text=[
 prefix+"M320_GUARD_BREAK_AUTH_TRACE "+JSON.stringify(packet(1,genuineFirst)),
 prefix+"M320_GUARD_BREAK_AUTH_TRACE "+JSON.stringify(packet(2,genuineSecond)),
 "2026-10-22T13:40:42Z M201_AUTH_PARRY tick=316 attacker=1 target=2",
 ].join("\n");
 const output=auditM320Log(text);
 assert.equal(output.length,2);
 assert.deepEqual(output.map(x=>[x.attempt,x.results[0].authoritativeResult]),[[1,"BLOCK"],[2,"PARRY"]]);
 assert.equal(output.every(x=>!x.fullNativeAcceptanceProven),true);
});
test("fail-closed for fabricated impact with no corresponding World Block/windup source",()=>{
 const result=auditGuardTrace(packet(4,["M201_AUTH_PARRY tick=19 attacker=1 target=2"]));
 assert.equal(result.evidenceComplete,false);
 assert.equal(result.results[0].serverTickIndexGap,null);
 assert.equal(result.results[0].boundaryContext,"MISSING_BLOCK_EDGE");
});
test("refuse ambiguous actor identities, alien log lines and unbounded trace inputs",()=>{
 assert.throws(()=>auditGuardTrace({...packet(1,genuineFirst),defenderNetId:1}),TypeError);
 assert.throws(()=>auditGuardTrace(packet(1,["M201_AUTH_GUARD_HIT tick=5 attacker=1 target=2"])),TypeError);
 assert.throws(()=>auditGuardTrace(packet(1,Array.from({length:65},()=>genuineFirst[0]))),TypeError);
 assert.throws(()=>auditM320Log(17),TypeError);
});
test("audit tools do not alter original M194 native W3C assertion or Combat rules",()=>{
 const script=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const source=readFileSync(new URL("../server/src/simulation.rs",import.meta.url),"utf8");
 assert.match(script,/M193 guard-break exchange \$\{attempt \+ 1\} resolved as parry/);
 assert.match(script,/defenderState\?\.playerHp !== 100/);
 assert.match(script,/M320_GUARD_BREAK_AUTH_TRACE/);
 assert.match(source,/const BLOCK_PARRY_WINDOW_MS: f32 = 125\.0/);
});
