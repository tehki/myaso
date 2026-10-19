import assert from "node:assert/strict";
import test from "node:test";
import {
  parseM201ServerProof,
  verifyM201ServerPunishProof,
} from "../scripts/m201-authoritative-phase-proof.mjs";

const roles = { attackerId: 1, defenderId: 2, closerId: 3 };
const observed = [
  "M201_AUTH_ACTION tick=297 fighter=2 from=0 to=6",
  "M201_AUTH_ACTION tick=297 fighter=1 from=0 to=1",
  "M201_AUTH_ACTION tick=305 fighter=1 from=1 to=2",
  "M201_AUTH_BLOCK tick=305 attacker=1 target=2",
  "M201_AUTH_ACTION tick=312 fighter=2 from=6 to=0",
  "M201_AUTH_ACTION tick=332 fighter=2 from=0 to=6",
  "M201_AUTH_ACTION tick=332 fighter=1 from=0 to=1",
  "M201_AUTH_ACTION tick=340 fighter=1 from=1 to=2",
  "M201_AUTH_BLOCK tick=340 attacker=1 target=2",
  "M201_AUTH_ACTION tick=346 fighter=2 from=6 to=0",
  "M201_AUTH_ACTION tick=368 fighter=2 from=0 to=6",
  "M201_AUTH_ACTION tick=368 fighter=1 from=0 to=1",
  "M201_AUTH_ACTION tick=376 fighter=1 from=1 to=2",
  "M201_AUTH_ACTION tick=376 fighter=2 from=6 to=7",
  "M201_AUTH_BREAK tick=376 attacker=1 target=2",
  "M201_AUTH_ACTION tick=397 fighter=1 from=3 to=1",
  "M201_AUTH_ACTION tick=406 fighter=1 from=1 to=2",
  "M201_AUTH_HIT tick=406 attacker=1 target=2 damage=34 hp=66",
  "M201_AUTH_ACTION tick=415 fighter=2 from=7 to=0",
].join("\n")+"\n";

// Independent of browser timestamps, these records follow the real M205
// server-tick evidence from run 39230417023.
test("M322 real defense events remain strictly parsed and preserve M205 34HP victim proof", () => {
  const parsed = parseM201ServerProof(observed);
  assert.equal(parsed.filter(r => r.kind === "block").length, 2);
  assert.equal(parsed.find(r => r.kind === "block").tick, 305);
  const verified = verifyM201ServerPunishProof(observed, roles);
  assert.equal(verified.guardBreak.tick, 376);
  assert.equal(verified.active.tick, 406);
  assert.equal(verified.hit.target, 2);
  assert.equal(verified.hit.hp, 66);
});
test("M322 parry is a parsed real server event, not an unknown trace", () => {
  const rows = parseM201ServerProof([
    "M201_AUTH_ACTION tick=30 fighter=2 from=0 to=6",
    "M201_AUTH_ACTION tick=38 fighter=1 from=1 to=7",
    "M201_AUTH_PARRY tick=38 attacker=1 target=2",
    "M201_AUTH_ACTION tick=39 fighter=2 from=6 to=0",
  ].join("\n")+"\n");
  assert.deepEqual(rows.find(r => r.kind === "parry"),
    { kind: "parry", tick: 38, attacker: 1, target: 2 });
});
test("M322 unknown and corrupt defense events still fail closed", () => {
  for (const line of [
    "M201_AUTH_FAKE tick=100 attacker=1 target=2",
    "M201_AUTH_BLOCK tick=xxx attacker=1 target=2",
    "M201_AUTH_PARRY tick=100 attacker=1 target=-2",
    "M201_AUTH_BLOCK tick=9007199254740995 attacker=1 target=2",
    "M201_AUTH_PARRY tick=20 attacker=1 target=2",
  ]) {
    assert.throws(() => parseM201ServerProof(
      "M201_AUTH_ACTION tick=99 fighter=1 from=0 to=1\n" + line + "\n"
    ), /malformed|unsafe|unordered/);
  }
});
test("M322 strict proof rejects wrong victim and excessive hit despite defense logs", () => {
  assert.throws(() => verifyM201ServerPunishProof(
    observed.replace("M201_AUTH_HIT tick=406 attacker=1 target=2 damage=34 hp=66",
      "M201_AUTH_HIT tick=406 attacker=1 target=3 damage=34 hp=66"), roles),
    /34 HP/);
  assert.throws(() => verifyM201ServerPunishProof(
    observed.replace("hp=66", "hp=32"), roles), /34 HP/);
  assert.throws(() => verifyM201ServerPunishProof(
    observed.replace("M201_AUTH_ACTION tick=406 fighter=1 from=1 to=2\n", ""), roles),
    /attack-active/);
});
