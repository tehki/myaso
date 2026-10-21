import test from "node:test";
import assert from "node:assert/strict";
import { readM171RejectedFeintProof } from "../scripts/m171-rejected-feint-proof.mjs";
import { COMBAT_ACTION as A } from "../src/browser/combat-readability.mjs";

const edge = (tick, from, to, fighter = 1) =>
  `M201_AUTH_ACTION tick=${tick} fighter=${fighter} from=${from} to=${to}\n`;
const trace = edge(100, A.idle, A.attackWindup)
  + edge(109, A.attackWindup, A.attackActive)
  + edge(114, A.attackActive, A.attackRecovery);

test("M171 proves a real server active edge even when replication skips it", () => {
  const proof = readM171RejectedFeintProof(trace, { fighterId: 1 });
  assert.equal(proof.active.tick, 109);
  assert.equal(proof.recovery.tick, 114);
  const heavy = edge(200, A.idle, A.heavyAttackWindup)
    + edge(220, A.heavyAttackWindup, A.heavyAttackActive)
    + edge(226, A.heavyAttackActive, A.heavyAttackRecovery);
  assert.equal(readM171RejectedFeintProof(heavy, { fighterId: 1, heavy: true }).active.tick, 220);
});

test("M171 rejects inferred, wrong-fighter, wrong-kind or out-of-window active proof", () => {
  for (const output of [
    edge(100, A.idle, A.attackWindup) + edge(114, A.attackWindup, A.attackRecovery),
    trace.replace("tick=109", "tick=110"),
    trace.replace("tick=114", "tick=115"),
    trace.replaceAll("fighter=1", "fighter=2"),
    edge(109, A.attackWindup, A.attackActive) + edge(114, A.attackActive, A.attackRecovery),
  ]) assert.equal(readM171RejectedFeintProof(output, { fighterId: 1 }), null);
  assert.equal(readM171RejectedFeintProof(trace, { fighterId: 1, heavy: true }), null);
});

test("M171 fails closed on feint recovery, contact and malformed authority", () => {
  assert.throws(() => readM171RejectedFeintProof(trace + edge(115, A.attackRecovery, A.feintRecovery),
    { fighterId: 1 }), /feint recovery/);
  assert.throws(() => readM171RejectedFeintProof(trace
    + "M201_AUTH_HIT tick=114 attacker=1 target=2 damage=34 hp=66\n", { fighterId: 1 }), /contact/);
  assert.throws(() => readM171RejectedFeintProof("M201_AUTH_ACTION tick=bad\n", { fighterId: 1 }), /malformed/);
});
