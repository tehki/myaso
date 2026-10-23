import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessM193Witness} from "../scripts/combat4d-m193-proof.mjs";
const witness=JSON.parse(readFileSync(new URL("../qa/evidence/m193-run-39935435948.json",import.meta.url),"utf8"));

test("4D protected native M205's M193 prerequisite is genuine BLOCK then PARRY, hence HOLD",()=>{
  const r=assessM193Witness(witness);
  assert.equal(r.status,"HOLD");
  assert.equal(r.attempts[0].result,"BLOCK");
  assert.equal(r.attempts[0].elapsed_ticks,8);
  assert.equal(r.attempts[0].guard,62);
  assert.equal(r.attempts[1].result,"PARRY");
  assert.equal(r.attempts[1].elapsed_ticks,6);
  assert.equal(r.attempts[1].guard,62);
  assert.equal(r.does_not_certify_gameplay,true);
});
test("4D rejects manufactured guard loss on legitimate parry",()=>{
  const x=structuredClone(witness);
  x.exchanges[1].defender_guard=24;
  assert.throws(()=>assessM193Witness(x),/False claimed/);
});
test("4D rejects a misclassified parry as second block",()=>{
  const x=structuredClone(witness);
  x.exchanges[1].outcome="BLOCK";
  assert.throws(()=>assessM193Witness(x),/contradict/);
});
test("4D checks genuine raw parry tick, not supplied status alone",()=>{
  const x=structuredClone(witness);
  x.exchanges[1].authoritative_lines[3]="M201_AUTH_PARRY tick=368 attacker=1 target=2";
  assert.throws(()=>assessM193Witness(x),/original protected/);
});
test("4D refuses missing three-party identity and untrusted W3C provenance",()=>{
  const x=structuredClone(witness);
  x.actors.observer=2;
  assert.throws(()=>assessM193Witness(x),/distinct actor/);
  const y=structuredClone(witness);
  y.exchanges[1].native_browser_witness.trusted_firefox_wheel_before_chrome_release=false;
  assert.throws(()=>assessM193Witness(y),/provenance/);
});
test("4D cannot silently change World 125ms parry or evidence exact head",()=>{
  const x=structuredClone(witness);
  x.parry_window_ms=75;
  assert.throws(()=>assessM193Witness(x),/constants/);
  const y=structuredClone(witness);
  y.candidate_sha="main";
  assert.throws(()=>assessM193Witness(y),/exact-head/);
});
test("4D rejects reordered ticks or missing original World guard event",()=>{
  const x=structuredClone(witness);
  x.exchanges[0].authoritative_lines.reverse();
  assert.throws(()=>assessM193Witness(x),/Reordered/);
  const y=structuredClone(witness);
  y.exchanges[0].authoritative_lines=y.exchanges[0].authoritative_lines.filter(line=>!line.includes("fighter=2"));
  assert.throws(()=>assessM193Witness(y),/Block6/);
});
