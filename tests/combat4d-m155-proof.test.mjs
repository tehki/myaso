import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessM155Witness } from "../scripts/combat4d-m155-proof.mjs";

const witness = JSON.parse(readFileSync(
  new URL("../qa/evidence/m155-run-39931321731.json", import.meta.url), "utf8"));

test("4D real native M155 true 34HP hit on victim recovery tick is HOLD", () => {
  const result = assessM155Witness(witness);
  assert.equal(result.status,"HOLD");
  assert.equal(result.knockdown_tick,353);
  assert.equal(result.recovery_tick,375);
  assert.equal(result.third_player_active_tick,375);
  assert.equal(result.real_hit_tick,375);
  assert.equal(result.real_damage_hp,34);
  assert.equal(result.target_hp,66);
  assert.equal(result.inside_knockdown,false);
});

test("4D tampered damage cannot manufacture a punish", () => {
  const copy = structuredClone(witness);
  copy.authoritative_lines[7] = copy.authoritative_lines[7].replace("damage=34", "damage=0");
  assert.throws(() => assessM155Witness(copy), /authentic original World/);
});

test("4D chronology rejects inverted World ordering", () => {
  const copy = structuredClone(witness);
  copy.authoritative_lines.reverse();
  assert.throws(() => assessM155Witness(copy), /out of order/);
});

test("4D rejects attacker and victim identity conflation", () => {
  const copy = structuredClone(witness);
  copy.roles.punisher = copy.roles.victim;
  assert.throws(() => assessM155Witness(copy), /not distinct/);
});

test("4D cannot accept sampled action2 from a different server tick", () => {
  const copy = structuredClone(witness);
  copy.native_runner_evidence.sampled_light_active_server_tick = 373;
  assert.throws(() => assessM155Witness(copy), /evidence missing/);
});

test("4D rejects mismatched run/commit identity", () => {
  const copy = structuredClone(witness);
  copy.candidate_sha = "main";
  assert.throws(() => assessM155Witness(copy), /exact-head/);
});
