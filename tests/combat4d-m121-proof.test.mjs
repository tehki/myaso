import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessM121Witness} from "../scripts/combat4d-m121-proof.mjs";

const witness=JSON.parse(readFileSync(new URL("../qa/evidence/m121-run-39938139017.json",import.meta.url),"utf8"));

test("4D native M121 defender receives real 34HP while LEFT SWEEP evidence is missing — HOLD",()=>{
  const r=assessM121Witness(witness);
  assert.equal(r.status,"HOLD");
  assert.equal(r.defender_hp,66);
  assert.equal(r.real_hit_damage,34);
  assert.deepEqual(r.observed_visible_phases,["HEAVY WINDUP","WINDUP","STRIKE"]);
  assert.deepEqual(r.observed_visible_recovery,["attack-recovery"]);
  assert.equal(r.left_sweep_proven,false);
});
test("4D cannot reclassify ordinary 34HP hit as LEFT SWEEP",()=>{
  const x=structuredClone(witness);
  x.readability_contract.required_directional_phase=["WINDUP","STRIKE"];
  assert.throws(()=>assessM121Witness(x),/invariants/);
});
test("4D rejects tampered native snapshots, even with plausible statuses",()=>{
  const x=structuredClone(witness);
  x.original_firefox_snapshot.threat_transitions[1].phase="LEFT WINDUP";
  assert.throws(()=>assessM121Witness(x),/differ/);
});
test("4D rejects invented directional source data even if transcription is altered",()=>{
  const x=structuredClone(witness);
  const marker="Error: M121 left-sweep readability was incomplete: ";
  const raw=JSON.parse(x.original_native_firefox_log_error.slice(marker.length));
  raw.threatTransitions.find(e=>e.visible).phase="LEFT SWEEP";
  x.original_native_firefox_log_error=marker+JSON.stringify(raw);
  x.original_firefox_snapshot.threat_transitions=raw.threatTransitions;
  assert.throws(()=>assessM121Witness(x),/specific original/);
});
test("4D rejects fake exact-head protected status and missing browser evidence",()=>{
  const x=structuredClone(witness);
  x.candidate_sha="main";
  assert.throws(()=>assessM121Witness(x),/exact-head/);
  const y=structuredClone(witness);
  y.source_outcome="success";
  assert.throws(()=>assessM121Witness(y),/exact-head/);
  const z=structuredClone(witness);
  z.original_native_firefox_log_error="manually passed";
  assert.throws(()=>assessM121Witness(z),/exact-head/);
});
test("4D refuses altered hit values and lost original recovery observation",()=>{
  const x=structuredClone(witness);
  x.original_firefox_snapshot.player_hp=100;
  assert.throws(()=>assessM121Witness(x),/differ/);
  const y=structuredClone(witness);
  y.original_firefox_snapshot.recovery_transitions=[];
  assert.throws(()=>assessM121Witness(y),/differ/);
});
