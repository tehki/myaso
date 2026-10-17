import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { M209_ROLL_KNOCKDOWN_TICKS, verifyM209DualKnockdownServerPunish as verify } from "../scripts/m209-dual-knockdown-proof.mjs";
const parts=[
"M201_AUTH_ACTION tick=100 fighter=1 from=0 to=4",
"M201_AUTH_ACTION tick=105 fighter=2 from=0 to=19",
"M201_AUTH_ACTION tick=106 fighter=3 from=0 to=19",
"M201_AUTH_ACTION tick=108 fighter=4 from=0 to=1",
"M201_AUTH_ACTION tick=116 fighter=4 from=1 to=2",
"M201_AUTH_HIT tick=117 attacker=4 target=2 damage=34 hp=66",
"M201_AUTH_ACTION tick=120 fighter=4 from=2 to=3",
"M201_AUTH_ACTION tick=121 fighter=2 from=19 to=0",
"M201_AUTH_ACTION tick=122 fighter=3 from=19 to=0",
];
const trace=(lines=parts)=>lines.join("\n")+"\n";
const ids={rollerId:1,firstVictimId:2,secondVictimId:3,punisherId:4};
test("M209 proves authentic single roller and two victims before active and selected 34HP",()=>{
 const p=verify(trace(),ids);
 assert.equal(p.first.tick,105);assert.equal(p.second.tick,106);
 assert.equal(p.active.tick,116);assert.equal(p.hit.tick,117);
 assert.equal(p.earliestRecoveryTick,121);assert.equal(M209_ROLL_KNOCKDOWN_TICKS,16);
});
test("M209 fails closed if browser misses 80ms active phase but server also lacks it",()=>{
 assert.throws(()=>verify(trace(parts.filter(x=>!x.includes("tick=116 fighter=4"))),ids),/active/);
});
test("M209 rejects attack active on first victim recovery tick, even if hit is correct",()=>{
 const ordered=parts.map(x=>x.includes("tick=116 fighter=4")?
  "M201_AUTH_ACTION tick=121 fighter=4 from=1 to=2":x.includes("tick=117 attacker=4")?
  "M201_AUTH_HIT tick=122 attacker=4 target=2 damage=34 hp=66":x.includes("tick=108 fighter=4")?
  "M201_AUTH_ACTION tick=111 fighter=4 from=0 to=1":x)
 .filter(x=>!x.includes("tick=120 fighter=4"));
 const seq=ordered.sort((a,b)=>Number(a.match(/tick=(\d+)/)[1])-Number(b.match(/tick=(\d+)/)[1]));
 assert.throws(()=>verify(trace(seq),ids),/BEFORE first recovery/);
});
test("M209 refuses second victim not within same real roll",()=>{
 const shifted=parts.map(x=>x.includes("tick=106 fighter=3")?
  "M201_AUTH_ACTION tick=115 fighter=3 from=0 to=19":x)
  .sort((a,b)=>Number(a.match(/tick=(\d+)/)[1])-Number(b.match(/tick=(\d+)/)[1]));
 assert.throws(()=>verify(trace(shifted),ids),/ordered overlapping/);
});
test("M209 rejects wrong victim, extra hits, changed damage and duplicate roll",()=>{
 assert.throws(()=>verify(trace(parts.map(x=>x.replace("target=2 damage=34","target=3 damage=34"))),ids),/exactly one/);
 assert.throws(()=>verify(trace(parts.map(x=>x.replace("damage=34 hp=66","damage=33 hp=67"))),ids),/exactly one/);
 const extra=[...parts,"M201_AUTH_HIT tick=118 attacker=4 target=3 damage=34 hp=66"]
 .sort((a,b)=>Number(a.match(/tick=(\d+)/)[1])-Number(b.match(/tick=(\d+)/)[1]));
 assert.throws(()=>verify(trace(extra),ids),/exactly one/);
 assert.throws(()=>verify(trace(["M201_AUTH_ACTION tick=99 fighter=1 from=0 to=4",...parts]),ids),/one authentic/);
});
test("M209 rejects input spoofing and unsynchronized fighter IDs",()=>{
 assert.throws(()=>verify(trace(),{...ids,secondVictimId:2}),RangeError);
 assert.throws(()=>verify(trace(parts.map(x=>x.replace("tick=100 fighter=1 from=0 to=4","tick=100 fighter=1 from=0 to=0"))),ids),/authentic authoritative roll/);
});
test("M209 real browser retains one true W3C wheel and LMB plus strict HP and focus",()=>{
 const s=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const part=s.slice(s.indexOf("async function runOnlineUiMultiKnockdownFfaHitFlight("),
  s.indexOf("async function ",s.indexOf("async function runOnlineUiMultiKnockdownFfaHitFlight(")+20));
 assert.ok(s.includes('scenario === "uimultiknockdownffahit"'));
 assert.ok(part.includes("verifyM209DualKnockdownServerPunish(m201ServerOutput()"));
 assert.ok(part.includes("await scrollArenaWheel(roller, rollerElementId, -120, 0);"));
  assert.ok(part.includes("planM159GenuinePunishTap(`mouse-${punisher.name}`)"), "genuine one-packet LMB action required");
  assert.ok(s.includes('import { planM159GenuinePunishTap } from "./m159-genuine-punish-tap.mjs";'), "real W3C action-plan helper imported");
 assert.ok(part.includes("punishDowns.length !== 1 || punishUps.length !== 1"));
 assert.ok(part.includes("firstState?.playerHp === 66"));
 assert.ok(part.includes("secondState?.playerHp === 100"));
 assert.ok(part.includes("windupReaim"));
});
