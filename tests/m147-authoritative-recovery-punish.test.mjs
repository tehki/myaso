import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { verifyM147AuthoritativeRecoveryPunish } from "../scripts/m147-authoritative-recovery-punish.mjs";

const sequence = [
  "M201_AUTH_ACTION tick=255 fighter=1 from=0 to=16",
  "M201_AUTH_ACTION tick=261 fighter=1 from=16 to=17",
  "M201_AUTH_ACTION tick=267 fighter=1 from=17 to=18",
  "M201_AUTH_ACTION tick=270 fighter=2 from=0 to=1",
  "M201_AUTH_ACTION tick=278 fighter=2 from=1 to=2",
  "M201_AUTH_HIT tick=278 attacker=2 target=1 damage=34 hp=66",
  "M201_AUTH_ACTION tick=285 fighter=1 from=18 to=0",
  "",
].join("\n");
const valid = { victimId: 1, attackerId: 2, recoveryTick: 267, idleTick: 285,
  cueTick: 267, cueTargetAction: 18, cueEpochMs: 7677, pointerDownEpochMs: 7685 };
const verify = (output = sequence, args = valid) => verifyM147AuthoritativeRecoveryPunish(output, args);

test("M147 accepts actual Firefox cue before Chrome recovery observation ONLY with exact server hit in recovery", () => {
  assert.deepEqual(verify(), { attackerId: 2, victimId: 1,
    recoveryTick: 267, observedRecoveryTick: 267,
    cueTick: 267, hitTick: 278,
    idleTick: 285, observedIdleTick: 285, damage: 34, victimHp: 66 });
});

test("M147 accepts real server hit at recovery penultimate tick with bounded Chrome replica lag", () => {
  // Reproduced protected red #39647579254 attempt2: Rust enters target
  // recovery341, genuine Firefox sees cue342, and hits at358 before idle359.
  // Chrome's observed transition ticks can be342 and360; those cannot move
  // the actual recovery window even by one tick.
  const stdout = [
    "M201_AUTH_ACTION tick=341 fighter=1 from=17 to=18",
    "M201_AUTH_ACTION tick=346 fighter=2 from=0 to=9",
    "M201_AUTH_ACTION tick=350 fighter=2 from=9 to=1",
    "M201_AUTH_ACTION tick=358 fighter=2 from=1 to=2",
    "M201_AUTH_HIT tick=358 attacker=2 target=1 damage=34 hp=66",
    "M201_AUTH_ACTION tick=359 fighter=1 from=18 to=0", "",
  ].join("\n");
  const proof = verify(stdout, { ...valid,
    recoveryTick: 342, idleTick: 360, cueTick: 342 });
  assert.equal(proof.recoveryTick, 341);
  assert.equal(proof.observedRecoveryTick, 342);
  assert.equal(proof.hitTick, 358);
  assert.equal(proof.idleTick, 359);
  assert.equal(proof.observedIdleTick, 360);
  // Real Rust idle at359 remains a hard fence even if Chrome observes at360.
  assert.throws(() => verify(stdout.replace("HIT tick=358", "HIT tick=359"),
    { ...valid, recoveryTick: 342, idleTick: 360, cueTick: 342 }), /outside server-owned/);
});

test("M147 rejects Chrome phase lag beyond six true server ticks and phase rollback", () => {
  assert.throws(() => verify(sequence, { ...valid, recoveryTick: 274 }), /too stale/);
  assert.throws(() => verify(sequence, { ...valid, idleTick: 292 }), /too stale/);
  assert.throws(() => verify(sequence, { ...valid, recoveryTick: 266 }), /too stale/);
  assert.throws(() => verify(sequence, { ...valid, idleTick: 284 }), /too stale/);
});

test("M147 rejects hit after target recovered, including same tick as idle", () => {
  assert.throws(() => verify(sequence.replace("HIT tick=278", "HIT tick=285")), /outside server-owned/);
  assert.throws(() => verify(sequence.replace("HIT tick=278", "HIT tick=286")), /outside server-owned/);
});

test("M147 rejects spectator credit, wrong victim, extra hits and wrong damage", () => {
  assert.throws(() => verify(sequence.replace("attacker=2 target=1", "attacker=3 target=1")), /identity/);
  assert.throws(() => verify(sequence.replace("attacker=2 target=1", "attacker=2 target=3")), /identity/);
  assert.throws(() => verify(sequence + "M201_AUTH_HIT tick=280 attacker=3 target=1 damage=34 hp=32\n"), /identity/);
  assert.throws(() => verify(sequence.replace("damage=34 hp=66", "damage=42 hp=58")), /identity/);
});

test("M147 fails closed on missing, stale, wrong or duplicated authoritative phases", () => {
  assert.throws(() => verify(sequence.replace("to=18", "to=19")), /identity/);
  assert.throws(() => verify(sequence.replace("tick=285 fighter=1", "tick=286 fighter=1")), /too stale/);
  assert.throws(() => verify(sequence + "M201_AUTH_ACTION tick=290 fighter=1 from=18 to=0\n"), /identity/);
  assert.throws(() => verify(sequence, { ...valid, cueTargetAction: 0 }), /genuine recovery cue/);
  assert.throws(() => verify(sequence, { ...valid, cueTick: 265 }), /outside server-owned/);
});

test("M147 native click must follow actual Firefox recovery cue within original 190ms", () => {
  assert.throws(() => verify(sequence, { ...valid, pointerDownEpochMs: 7676 }), /genuine recovery cue/);
  assert.throws(() => verify(sequence, { ...valid, pointerDownEpochMs: 7870 }), /genuine recovery cue/);
});

test("M147 server tick-window proof survives genuine u32 wrap and rejects overlong windows", () => {
  const wrap = ["M201_AUTH_ACTION tick=4294967294 fighter=1 from=17 to=18",
    "M201_AUTH_HIT tick=2 attacker=2 target=1 damage=34 hp=66",
    "M201_AUTH_ACTION tick=15 fighter=1 from=18 to=0", ""].join("\n");
  assert.equal(verify(wrap, { ...valid, recoveryTick: 4294967294, cueTick: 4294967294, idleTick: 15 }).hitTick, 2);
  const longWindow = wrap.replace("tick=15 fighter=1", "tick=100 fighter=1");
  assert.throws(() => verify(longWindow, { ...valid, recoveryTick: 4294967294, cueTick: 4294967294, idleTick: 100 }), /outside server-owned/);
});

// Source-order regression: maintain genuine single native W3C input AFTER
// the current rendered recovery cue, not a synthetic client/server hit.
test("M147 uses one real 5ms Firefox W3C light from recovery cue and strict server HIT proof", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const start = runner.indexOf("async function runOnlineUiJumpRecoveryFfaPunishFlight(");
  const end = runner.indexOf("async function runOnlineUiMultiRecoveryFfaFocusFlight(", start);
  assert.ok(start >= 0 && end > start);
  const flight = runner.slice(start, end);
  assert.match(flight, /performPunish: \(\) => performArenaM221GuardBreakClick\(observer, 5\)/);
  assert.doesNotMatch(flight, /performArenaM221GuardBreakClick\(observer, (?:45|90)\)/);
  assert.match(flight, /const recoveryCue = observed\.cue/);
  assert.match(flight, /verifyM147AuthoritativeRecoveryPunish\(/);
  assert.match(flight, /const punishDowns = punishPointers\.filter/);
  assert.match(flight, /real Firefox light did not damage selected jump-recovery target/);
  assert.doesNotMatch(flight, /dispatchEvent\(|\.click\(\)/);
});
