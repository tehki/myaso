import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessM172Witness } from "../scripts/combat4d-m172-proof.mjs";

const evidence = JSON.parse(readFileSync(new URL("../qa/evidence/m172-run-39942285919.json", import.meta.url), "utf8"));

test("4D real M172 native timeout is HOLD, not a denial PASS", () => {
  const q=assessM172Witness(evidence);
  assert.equal(q.status,"HOLD");
  assert.equal(q.does_not_certify_gameplay,true);
  assert.equal(q.world_stamina_at_jump,10);
  assert.equal(q.world_stamina_at_confirmation,12);
  assert.equal(q.denial_stage,"confirmed-not-stamina");
  assert.equal(q.queued_client_tick,346);
  assert.equal(q.acknowledged_processed_client_tick,361);
});
test("4D rejects fabricated confirmed-rejected status", () => {
  const e=structuredClone(evidence);
  e.reported_original_client.denial_transitions[2].stage="confirmed-rejected";
  assert.throws(()=>assessM172Witness(e),/stages were altered/);
});
test("4D rejects fabricated shown low-stamina UI message", () => {
  const e=structuredClone(evidence);
  e.reported_original_client.events.push("Low stamina — jump attack needs 12.");
  assert.throws(()=>assessM172Witness(e),/silently relabeled/);
});
test("4D rejects invented sub-cost confirmed authority", () => {
  const e=structuredClone(evidence);
  e.reported_original_client.denial_transitions[2].authoritativeStamina=10;
  assert.throws(()=>assessM172Witness(e),/stages were altered/);
});
test("4D refuses forged actor or original real World recovery tick", () => {
  const a=structuredClone(evidence); a.reported_original_client.player_net_id=2;
  assert.throws(()=>assessM172Witness(a),/World witness/);
  const b=structuredClone(evidence); b.reported_original_client.stamina_trace=b.reported_original_client.stamina_trace.filter(x=>x.serverTick!==594);
  assert.throws(()=>assessM172Witness(b),/ordinary Jump and regenerating authoritative stamina missing/);
});
test("4D rejects invented W3C LMB epoch/space provenance", () => {
  const a=structuredClone(evidence); a.reported_original_client.pointer_transitions=a.reported_original_client.pointer_transitions.filter(x=>x.epochMs!==1792753704940);
  assert.throws(()=>assessM172Witness(a),/W3C/);
  const b=structuredClone(evidence); b.reported_original_client.key_transitions=b.reported_original_client.key_transitions.filter(x=>x.code!=="Space");
  assert.throws(()=>assessM172Witness(b),/W3C/);
});
test("4D refuses fake exact-head protected outcome and reordering ACK", () => {
  const a=structuredClone(evidence); a.candidate_sha="main";
  assert.throws(()=>assessM172Witness(a),/Exact-head/);
  const b=structuredClone(evidence); b.source_outcome="success";
  assert.throws(()=>assessM172Witness(b),/Exact-head/);
  const c=structuredClone(evidence); c.reported_original_client.denial_transitions[2].processedClientTick=345;
  assert.throws(()=>assessM172Witness(c),/stages were altered/);
});
