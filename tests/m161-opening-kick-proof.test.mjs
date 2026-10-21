import test from "node:test";
import assert from "node:assert/strict";
import { readM161OpeningKickProof } from "../scripts/m161-opening-kick-proof.mjs";

const ids = { kickerId: 1, defenderId: 2 };
const windup = "M201_AUTH_ACTION tick=276 fighter=1 from=0 to=12\n";
const active = "M201_AUTH_ACTION tick=282 fighter=1 from=12 to=13\n";
const knockdown = "M201_AUTH_ACTION tick=282 fighter=2 from=0 to=19\n";

test("M161 requires server kick-active and victim knockdown even if snapshots omit active", () => {
  const proof = readM161OpeningKickProof(windup + active + knockdown, ids);
  assert.equal(proof.source, "authoritative-server-ticks");
  assert.equal(proof.active.tick, 282);
  assert.equal(proof.knockdown.fighter, 2);
  assert.equal(proof.active.tick, proof.knockdown.tick);
});

test("M161 never promotes a victim cue, recovery or another fighter's kick to active proof", () => {
  for (const trace of [
    windup + knockdown,
    windup + "M201_AUTH_ACTION tick=282 fighter=1 from=12 to=14\n" + knockdown,
    windup + active.replace("fighter=1", "fighter=3") + knockdown,
    active + knockdown,
    windup + active + knockdown.replace("fighter=2", "fighter=3"),
    windup + active + knockdown.replace("tick=282", "tick=283"),
  ]) assert.equal(readM161OpeningKickProof(trace, ids), null);
});

test("M161 rejects malformed, reordered and damaging control-only evidence", () => {
  assert.throws(() => readM161OpeningKickProof(windup + active + knockdown
    + "M201_AUTH_HIT tick=282 attacker=1 target=2 damage=34 hp=66\n", ids), /control-only/);
  assert.throws(() => readM161OpeningKickProof(active + windup, ids), /unordered/);
  assert.throws(() => readM161OpeningKickProof("M201_AUTH_ACTION tick=bad\n", ids), /malformed/);
  assert.throws(() => readM161OpeningKickProof("", { kickerId: 1, defenderId: 1 }), RangeError);
});
