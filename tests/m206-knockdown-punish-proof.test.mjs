import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyM206ServerKnockdownPunish, verifyM155RealCueBeforeNativePunish, M206_KNOCKDOWN_TICKS } from "../scripts/m206-knockdown-punish-proof.mjs";

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
  const prematureRecovery = trace
    .replace("M201_AUTH_HIT tick=119 attacker=3 target=2 damage=34 hp=66",
      "M201_AUTH_ACTION tick=118 fighter=2 from=19 to=0\nM201_AUTH_HIT tick=119 attacker=3 target=2 damage=34 hp=66")
    .replace("M201_AUTH_ACTION tick=122 fighter=2 from=19 to=0\n", "");
  assert.throws(()=>verifyM206ServerKnockdownPunish(prematureRecovery,roles),/recovery/);
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
  assert.ok(section.includes("performPunish: () => performArenaM221GuardBreakClick(punisher, 5)"));
  assert.ok(section.includes("defenderState?.playerHp === 66"));
});

// Captured protected CI39628862270: admission at359, active/HIT368 equals recovery.
test("M206 preserves rejection of the captured M155 same-recovery-tick hit", () => {
  const late = [
    "M201_AUTH_ACTION tick=346 fighter=1 from=12 to=13",
    "M201_AUTH_ACTION tick=346 fighter=2 from=0 to=19",
    "M201_AUTH_ACTION tick=360 fighter=3 from=0 to=1",
    "M201_AUTH_ACTION tick=368 fighter=2 from=19 to=0",
    "M201_AUTH_ACTION tick=368 fighter=3 from=1 to=2",
    "M201_AUTH_HIT tick=368 attacker=3 target=2 damage=34 hp=66",
  ].join("\n") + "\n";
  assert.throws(() => verifyM206ServerKnockdownPunish(late, roles), /active|recovery/);
});


// Real #39652908814 native M155: server victim knockdown301→idle323,
// third-party server HIT315, punisher Firefox cue4036→pointer4044, but
// Chrome victim receives the same action at4064 AFTER Firefox clicked.
const trueCue = {
  playerNetId: 3, targetNetId: 2, serverTick: 303,
  fighters: [
    { netId: 3, action: 0 },
    { netId: 1, action: 13 },
    { netId: 2, action: 19 },
  ],
  cue: { visible: true, state: "knockdown", label: "PUNISH",
    epochMs: 1792607774036 },
};
const nativeArgs = { punisherId: 3, defenderId: 2,
  pointerDownEpochMs: 1792607774044, cueDeadlineMs: 360 };

test("M155 accepts real cue→W3C pointer before DIFFERENT browser receives same knockdown", () => {
  assert.deepEqual(verifyM155RealCueBeforeNativePunish(trueCue, nativeArgs), {
    punisherId: 3, defenderId: 2, cueServerTick: 303,
    cueEpochMs: 1792607774036,
    pointerDownEpochMs: 1792607774044,
    cueToPointerMs: 8,
  });
  const trueServerProof = [
    "M201_AUTH_ACTION tick=301 fighter=1 from=12 to=13",
    "M201_AUTH_ACTION tick=301 fighter=2 from=0 to=19",
    "M201_AUTH_ACTION tick=307 fighter=3 from=0 to=1",
    "M201_AUTH_ACTION tick=315 fighter=3 from=1 to=2",
    "M201_AUTH_HIT tick=315 attacker=3 target=2 damage=34 hp=66",
    "M201_AUTH_ACTION tick=323 fighter=2 from=19 to=0",
    "",
  ].join("\n");
  assert.equal(verifyM206ServerKnockdownPunish(trueServerProof, roles).hit.tick, 315);
  // The same native cue does NOT rescue a late hit after true recovery.
  const late = trueServerProof.replace("HIT tick=315", "HIT tick=323");
  assert.throws(() => verifyM206ServerKnockdownPunish(late, roles), /recovery|knockdown/);
});

test("M155 rejects false identity, stale or absent cue, and clicks outside own browser's 360ms", () => {
  assert.throws(() => verifyM155RealCueBeforeNativePunish(trueCue, { ...nativeArgs,
    punisherId: 1 }), /current punisher knockdown cue/);
  assert.throws(() => verifyM155RealCueBeforeNativePunish(trueCue, { ...nativeArgs,
    defenderId: 1 }), /current punisher knockdown cue/);
  assert.throws(() => verifyM155RealCueBeforeNativePunish({ ...trueCue,
    fighters: [{ netId: 2, action: 0 }] }, nativeArgs), /current punisher knockdown cue/);
  assert.throws(() => verifyM155RealCueBeforeNativePunish({ ...trueCue,
    cue: { ...trueCue.cue, visible: false } }, nativeArgs), /current punisher knockdown cue/);
  assert.throws(() => verifyM155RealCueBeforeNativePunish(trueCue, { ...nativeArgs,
    pointerDownEpochMs: trueCue.cue.epochMs - 1 }), /current punisher knockdown cue/);
  assert.throws(() => verifyM155RealCueBeforeNativePunish(trueCue, { ...nativeArgs,
    pointerDownEpochMs: trueCue.cue.epochMs + 360 }), /current punisher knockdown cue/);
  assert.throws(() => verifyM155RealCueBeforeNativePunish(trueCue, { ...nativeArgs,
    cueDeadlineMs: 1000 }), /current punisher knockdown cue/);
});

test("M155 original real W3C pointer and M206 authoritative hit gates remain mandatory", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=source.slice(source.indexOf("async function runOnlineUiKickKnockdownFfaHitFlight("),
    source.indexOf("async function runOnlineUiMultiKnockdownFfaFlight("));
  assert.match(section, /punishDowns\.length !== 1 \|\| punishUps\.length !== 1/);
  assert.match(section, /verifyM155RealCueBeforeNativePunish\(observed/);
  assert.match(section, /verifyM206ServerKnockdownPunish\(m201ServerOutput\(\)/);
  assert.match(section, /defenderState\?\.playerHp === 66/);
  assert.doesNotMatch(section, /punishDown\.epochMs < conversion\.knockdownTransition\.epochMs/);
  assert.doesNotMatch(section, /new MouseEvent\(|dispatchEvent\(/);
});
