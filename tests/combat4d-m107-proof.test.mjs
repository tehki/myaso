import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessM107Witness } from "../scripts/combat4d-m107-proof.mjs";

const witness = JSON.parse(readFileSync(new URL("../qa/evidence/m107-run-39930443888.json", import.meta.url), "utf8"));

test("4D real protected M107 run is preserved as QA HOLD, never retroactive dodge success", () => {
  const result = assessM107Witness(witness);
  assert.equal(result.status, "HOLD");
  assert.equal(result.hit_tick, 280);
  assert.equal(result.dodge_tick, 282);
  assert.equal(result.damage, 46);
  assert.equal(result.hp, 54);
  assert.equal(result.false_success_feedback, true);
});
test("4D native evidence requires exact-head run identity", () => {
  assert.throws(() => assessM107Witness({ ...witness, candidate_sha: "main" }), /exact-head/);
});
test("4D server event transcription must match raw M201_AUTH lines", () => {
  const corrupted = structuredClone(witness);
  corrupted.authoritative_server_events[2].damage = 0;
  assert.throws(() => assessM107Witness(corrupted), /does not match/);
});
test("4D server tick chronology cannot be reordered to fake a valid evade", () => {
  const reordered = structuredClone(witness);
  reordered.authoritative_server_events.reverse();
  assert.throws(() => assessM107Witness(reordered), /Nonmonotonic/);
});
test("4D browser success feedback cannot substitute for a genuine trusted wheel", () => {
  const synthetic = structuredClone(witness);
  synthetic.native_browser_observation.trusted_wheel_back_recorded = false;
  assert.throws(() => assessM107Witness(synthetic), /browser evidence/);
});
test("4D a hypothetical on-time dodge is not auto-classified as public PASS", () => {
  const future = structuredClone(witness);
  for (const entry of future.authoritative_server_events.filter(e =>
    e.kind === "hit" || (e.kind === "action" && e.actor === 2 && e.to === 10))) {
    entry.source = entry.source.replace("tick=280", "tick=284");
    entry.tick = 284;
  }
  // keep chronology sorted for this pure evidence-contract test
  future.authoritative_server_events.sort((a, b) => a.tick - b.tick);
  assert.equal(assessM107Witness(future).status, "NOT QUALIFIED");
});
