import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyM211DualRecoveryServerProof as verify } from "../scripts/m211-dual-recovery-phase-proof.mjs";

const lines = [
  "M201_AUTH_ACTION tick=100 fighter=3 from=0 to=1",
  "M201_AUTH_ACTION tick=106 fighter=1 from=5 to=16",
  "M201_AUTH_ACTION tick=108 fighter=3 from=1 to=2",
  "M201_AUTH_ACTION tick=113 fighter=3 from=2 to=3",
  "M201_AUTH_ACTION tick=119 fighter=1 from=16 to=17",
  "M201_AUTH_ACTION tick=125 fighter=1 from=17 to=18",
  "M201_AUTH_ACTION tick=135 fighter=3 from=3 to=0",
  "M201_AUTH_ACTION tick=149 fighter=1 from=18 to=0",
];
const trace=(items=lines)=>items.join("\n")+"\n";
const ids={jumpId:1,observerId:2,lightId:3};
const shift=(match,replacement)=>trace(lines.map(s=>s.replace(match,replacement)));
test("M211 proves both authentic 60Hz active edges despite missing sampled active",()=>{
 const p=verify(trace(),ids);
 assert.equal(p.light.active.tick,108);
 assert.equal(p.jump.active.tick,119);
 assert.equal(p.overlapFrom,125);
 assert.equal(p.overlapUntil,135);
});
test("M211 missing actual 80ms light active cannot be accepted from recovery",()=>{
 assert.throws(()=>verify(trace(lines.filter(s=>!s.includes("tick=108"))),ids),/light.*phase edge 2/);
});
test("M211 missing jump active fails despite honest Space+LMB and recovery",()=>{
 assert.throws(()=>verify(trace(lines.filter(s=>!s.includes("tick=119"))),ids),/jump.*phase edge 17/);
});
test("M211 rejects same-tick or retrograde server transitions",()=>{
 const sameTick = lines.map(s=>s.replace("tick=108 fighter=3 from=1 to=2",
   "tick=100 fighter=3 from=1 to=2"))
   .sort((a,b)=>Number(a.match(/tick=(\d+)/)[1])-Number(b.match(/tick=(\d+)/)[1]));
 assert.throws(()=>verify(trace(sameTick),ids),/unordered/);
 assert.throws(()=>verify(shift("tick=125 fighter=1","tick=135 fighter=1"),ids),/unordered|overlap/);
});
test("M211 requires genuine simultaneous recovery overlap and ordered handoff",()=>{
 const extended=lines.map(s=>s.replace("tick=135 fighter=3 from=3 to=0","tick=125 fighter=3 from=3 to=0"));
 assert.throws(()=>verify(trace(extended),ids),/overlap/);
 const reversed=lines.map(s=>s.replace("tick=100 fighter=3 from=0 to=1","tick=109 fighter=3 from=0 to=1"))
  .sort((a,b)=>Number(a.match(/tick=(\d+)/)[1])-Number(b.match(/tick=(\d+)/)[1]));
 assert.throws(()=>verify(trace(reversed),ids),/light-first|unordered/);
});
test("M211 rejects damage, duplicate attack and wrong authoritative fighter ids",()=>{
 const hit=[...lines,"M201_AUTH_HIT tick=126 attacker=1 target=2 damage=42 hp=58"]
   .sort((a,b)=>Number(a.match(/tick=(\d+)/)[1])-Number(b.match(/tick=(\d+)/)[1]));
 assert.throws(()=>verify(trace(hit),ids),/damaged/);
 const repeated=[...lines,"M201_AUTH_ACTION tick=150 fighter=3 from=0 to=1"];
 assert.throws(()=>verify(trace(repeated),ids),/one server phase edge/);
 assert.throws(()=>verify(trace(),{...ids,observerId:3}),RangeError);
});
test("M211 preserves real W3C Space+LMB, one light LMB and focus/vitals gates",()=>{
 const src=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const a=src.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(");
 const b=src.indexOf("async function ",a+32);
 const section=src.slice(a,b);
 assert.ok(src.includes('scenario === "uimultirecoveryffa"'));
 assert.ok(src.includes('scenario === "uimultirecoveryspatial"'));
 assert.ok(section.includes("verifyM211DualRecoveryServerProof(m201ServerOutput()"));
 // The genuine short LMB must release before the 80ms heavy-upgrade classifier.
 assert.ok(section.includes("performArenaAttackHold(lightAttacker, lightArena, 200, 45)"));
 assert.ok(section.includes("performArenaPreAimedJumpAttackChord(jumpAttacker, 180)"));
 assert.ok(section.includes("jumpAttackDowns.length !== 1 || jumpAttackUps.length !== 1"));
 assert.ok(section.includes("lightDowns.length !== 1 || lightUps.length !== 1"));
 assert.ok(section.includes("lightPunishIndex < 0 || jumpPunishIndex <= lightPunishIndex"));
 assert.ok(section.includes("entry.playerHp !== 100 || entry.playerGuard !== 100"));
});
