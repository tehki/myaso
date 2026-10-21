import test from "node:test";
import assert from "node:assert/strict";
import { verifyM156RollKnockdownPunish } from "../scripts/m156-roll-knockdown-proof.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { NETWORK } from "../src/network/constants.mjs";

const roles = { rollerId: 1, defenderId: 2, punisherId: 3 };
// Actual positive server chronology from the PulseAudio-backed native flight.
// Browser saw knockdown epoch7232, active7760 (>520ms), yet server hit at500ms.
const trace = [
  "M201_AUTH_ACTION tick=981 fighter=1 from=0 to=4",
  "M201_AUTH_ACTION tick=987 fighter=2 from=0 to=19",
  "M201_AUTH_ACTION tick=991 fighter=1 from=4 to=5",
  "M201_AUTH_ACTION tick=1009 fighter=3 from=0 to=1",
  "M201_AUTH_ACTION tick=1017 fighter=3 from=1 to=2",
  "M201_AUTH_HIT tick=1017 attacker=3 target=2 damage=34 hp=66",
  "M201_AUTH_ACTION tick=1019 fighter=2 from=19 to=0",
].join("\n") + "\n";

test("M156 proves actual roll and one light hit at500ms, independent of browser delivery epochs", () => {
  const p = verifyM156RollKnockdownPunish(trace, roles);
  assert.equal((p.hit.tick - p.knockdown.tick) * 1000 / 60, 500);
  assert.equal(p.hit.tick, 1017);
  assert.equal(p.recovery.tick, 1019);
  assert.equal(COMBAT.dodge.collisionKnockdownMs, 520);
  assert.equal(NETWORK.serverSimulationHz, 60);
});

test("M156 retains the actual late-input native failure as a rejection", () => {
  const lateNative = [
    "M201_AUTH_ACTION tick=1191 fighter=1 from=0 to=4",
    "M201_AUTH_ACTION tick=1197 fighter=2 from=0 to=19",
    "M201_AUTH_ACTION tick=1201 fighter=1 from=4 to=5",
    "M201_AUTH_ACTION tick=1229 fighter=2 from=19 to=0",
    "M201_AUTH_ACTION tick=1282 fighter=3 from=0 to=1",
    "M201_AUTH_ACTION tick=1290 fighter=3 from=1 to=2",
    "M201_AUTH_HIT tick=1290 attacker=3 target=2 damage=34 hp=66",
  ].join("\n") + "\n";
  assert.throws(() => verifyM156RollKnockdownPunish(lateNative, roles));
});

test("M156 refuses hit after520ms even if victim recovery was never observed", () => {
  const late = trace.replaceAll("tick=1009", "tick=1011").replaceAll("tick=1017", "tick=1019")
    .replace("M201_AUTH_ACTION tick=1019 fighter=2 from=19 to=0\n", "");
  assert.throws(() => verifyM156RollKnockdownPunish(late, roles), /original knockdown/);
});

test("M156 refuses actual recovery on or before the hit, wrong attribution, damage and duplicate hits", () => {
  assert.throws(() => verifyM156RollKnockdownPunish(trace.replace("tick=1019 fighter=2", "tick=1017 fighter=2"), roles), /recovery/);
  for (const s of [trace.replace("attacker=3", "attacker=1"), trace.replace("target=2", "target=1"),
    trace.replace("damage=34 hp=66", "damage=46 hp=54"),
    trace + "M201_AUTH_HIT tick=1020 attacker=3 target=2 damage=34 hp=32\n"]) {
    assert.throws(() => verifyM156RollKnockdownPunish(s, roles));
  }
});

test("M156 cannot infer real roll/knockdown/active from damage or malformed authority", () => {
  for (const s of [trace.replace("from=0 to=4", "from=0 to=13"),
    trace.replace("from=0 to=19", "from=0 to=0"),
    trace.replace("from=1 to=2", "from=1 to=3"),
    trace.replace("damage=34", "damage=bogus")]) {
    assert.throws(() => verifyM156RollKnockdownPunish(s, roles));
  }
  assert.throws(() => verifyM156RollKnockdownPunish(trace, { ...roles, punisherId: 2 }), RangeError);
});
