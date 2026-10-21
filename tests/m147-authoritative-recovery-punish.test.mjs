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
    recoveryTick: 267, cueTick: 267, hitTick: 278,
    idleTick: 285, damage: 34, victimHp: 66 });
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
  assert.throws(() => verify(sequence.replace("tick=285 fighter=1", "tick=286 fighter=1")), /identity/);
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
