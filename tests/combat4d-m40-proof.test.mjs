import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessM40Witness} from "../scripts/combat4d-m40-proof.mjs";

const witness=JSON.parse(readFileSync(new URL("../qa/evidence/m40-run-39944996021.json",import.meta.url),"utf8"));

test("4D genuine M40 first exchange is 6-tick lawful World parry, not guard damage: HOLD",()=>{
  const a=assessM40Witness(witness);
  assert.equal(a.classification,"HOLD");
  assert.equal(a.original_parry_age_ms,100);
  assert.equal(a.real_guard_damage,0);
  assert.equal(a.real_hp_damage,0);
  assert.equal(a.provenance_verified_by_offline_json,false);
  assert.equal(a.does_not_certify_gameplay,true);
});
test("4D rejects fabricated -38 guard in actual zero-guard-loss parry",()=>{
  const x=structuredClone(witness);
  x.original_browser_evidence.defender_guard=62;
  assert.throws(()=>assessM40Witness(x),/zero guard damage/);
});
test("4D rejects invented authoritative BLOCK replacing actual PARRY",()=>{
  const x=structuredClone(witness);
  x.original_world_trace.tickLines[4]="M201_AUTH_BLOCK tick=219 attacker=1 target=2";
  assert.throws(()=>assessM40Witness(x),/Real World action order/);
});
test("4D rejects spoofed World tick 125ms boundary or actor",()=>{
  const x=structuredClone(witness);
  x.original_world_trace.tickLines[2]="M201_AUTH_ACTION tick=210 fighter=2 from=0 to=6";
  assert.throws(()=>assessM40Witness(x),/Real World action order/);
  const y=structuredClone(witness);
  y.original_world_trace.attackerNetId=2;
  assert.throws(()=>assessM40Witness(y),/actor/);
});
test("4D refuses untrusted wheel and fake Chrome pointer chronology",()=>{
  const x=structuredClone(witness);
  x.original_m212_ingress.trustedWheelBeforeRelease=false;
  assert.throws(()=>assessM40Witness(x),/trusted Firefox wheel/);
  const y=structuredClone(witness);
  y.original_browser_evidence.attacker_pointer_events[0].epochMs=1792755078999;
  assert.throws(()=>assessM40Witness(y),/pointerDOWN/);
});
test("4D refuses false protected success, fake exact head and mislabeled game pass",()=>{
  const x=structuredClone(witness);
  x.source_outcome="success";
  assert.throws(()=>assessM40Witness(x),/exact-head/);
  const y=structuredClone(witness);
  y.candidate_sha="main";
  assert.throws(()=>assessM40Witness(y),/exact-head/);
  const z=structuredClone(witness);
  z.qa_disposition="PASS";
  assert.throws(()=>assessM40Witness(z),/exact-head/);
});
