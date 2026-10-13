import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyM206ServerKnockdownPunish, M206_KNOCKDOWN_TICKS } from "../scripts/m206-knockdown-punish-proof.mjs";

const trace = [
  "M201_AUTH_ACTION tick=100 fighter=1 from=12 to=13",
  "M201_AUTH_ACTION tick=100 fighter=2 from=0 to=19",
  "M201_AUTH_ACTION tick=110 fighter=3 from=0 to=1",
  "M201_AUTH_ACTION tick=118 fighter=3 from=1 to=2",
  "M201_AUTH_HIT tick=119 attacker=3 target=2 damage=34 hp=66",
  "M201_AUTH_ACTION tick=121 fighter=3 from=2 to=3",
  "M201_AUTH_ACTION tick=122 fighter=2 from=19 to=0",
].join("\n") + "\n";
const roles={kickerId:1,defenderId:2,punisherId:3};
test("M206 proves actual server active edge and 34 HP hit inside kick knockdown",()=>{
  const result=verifyM206ServerKnockdownPunish(trace,roles);
  assert.equal(result.knockdown.tick,100);
  assert.equal(result.active.tick,118);
  assert.equal(result.hit.tick,119);
  assert.equal(M206_KNOCKDOWN_TICKS,22);
});
test("M206 missing 80ms active cannot be hidden by replicated recovery and 34HP",()=>{
  assert.throws(()=>verifyM206ServerKnockdownPunish(
    trace.replace("M201_AUTH_ACTION tick=118 fighter=3 from=1 to=2\n",""),roles),/active/);
});
test("M206 refuses wrong victim, early recovery, wrong damage and extra hit",()=>{
  assert.throws(()=>verifyM206ServerKnockdownPunish(trace.replace("target=2 damage=34","target=1 damage=34"),roles));
  assert.throws(()=>verifyM206ServerKnockdownPunish(trace.replace("damage=34 hp=66","damage=35 hp=65"),roles));
  assert.throws(()=>verifyM206ServerKnockdownPunish(
    trace+"M201_AUTH_HIT tick=123 attacker=3 target=1 damage=34 hp=66\n",roles));
  assert.throws(()=>verifyM206ServerKnockdownPunish(
    trace.replace("tick=122 fighter=2 from=19 to=0","tick=118 fighter=2 from=19 to=0"),roles),/recovery/);
});
test("M206 rejects synthetic player IDs or uncorrelated kick knockdown",()=>{
  assert.throws(()=>verifyM206ServerKnockdownPunish(trace,{...roles,punisherId:1}),RangeError);
  assert.throws(()=>verifyM206ServerKnockdownPunish(trace.replace("fighter=1 from=12 to=13","fighter=3 from=12 to=13"),roles),/kicker/);
});
test("M206 is wired only into real W3C third-party punish loopback flight",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=source.slice(source.indexOf("async function runOnlineUiKickKnockdownFfaHitFlight("),
    source.indexOf("async function runOnlineUiMultiKnockdownFfaFlight("));
  assert.ok(source.includes('MYASO_FLIGHT_ACTION_PROOF: (scenario === "uiguardbreakpunishffahit"'));
  assert.ok(source.includes('scenario === "uikickknockdownffahit"'));
  assert.ok(section.includes("verifyM206ServerKnockdownPunish(m201ServerOutput()"));
  assert.ok(section.includes("punishDowns.length !== 1"));
  assert.ok(section.includes("punishUps.length !== 1"));
  assert.ok(section.includes("punishAimValid"));
  assert.ok(section.includes("performArenaAttack(punisher, punisherElementId, punishOffset)"));
  assert.ok(section.includes("defenderState?.playerHp === 66"));
});
