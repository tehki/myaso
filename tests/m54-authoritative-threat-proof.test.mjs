import test from "node:test";
import assert from "node:assert/strict";
import { readM54AuthoritativeHit } from "../scripts/m54-authoritative-threat-proof.mjs";

const ids = { attackerId: 1, victimId: 2 };
const trace = "M201_AUTH_ACTION tick=2262 fighter=1 from=0 to=1\n"
  + "M201_AUTH_ACTION tick=2270 fighter=1 from=1 to=2\n"
  + "M201_AUTH_HIT tick=2270 attacker=1 target=2 damage=34 hp=66\n";

test("M54 binds the sole actual 34HP victim hit to genuine windup and active", () => {
  const proof = readM54AuthoritativeHit(trace, ids);
  assert.equal(proof.hit.tick, 2270);
  assert.equal(proof.active.tick, proof.hit.tick);
  assert.equal(readM54AuthoritativeHit("", ids), null);
});

test("M54 stale DOM66 cannot conceal the captured second hit leaving server32", () => {
  const duplicate = trace + "M201_AUTH_ACTION tick=2346 fighter=1 from=9 to=1\n"
    + "M201_AUTH_ACTION tick=2354 fighter=1 from=1 to=2\n"
    + "M201_AUTH_HIT tick=2354 attacker=1 target=2 damage=34 hp=32\n";
  assert.throws(() => readM54AuthoritativeHit(duplicate, ids), /exactly one authoritative/);
});

test("M54 rejects wrong-target, heavy, incomplete or malformed authority", () => {
  for (const output of [trace.replace("target=2", "target=3"),
    trace.replace("damage=34 hp=66", "damage=46 hp=54"),
    trace.replace("M201_AUTH_ACTION tick=2270 fighter=1 from=1 to=2\n", "")]) {
    assert.throws(() => readM54AuthoritativeHit(output, ids));
  }
  assert.throws(() => readM54AuthoritativeHit("M201_AUTH_ACTION tick=bad\n", ids), /malformed/);
});
