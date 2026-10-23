import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessM194Witness} from "../scripts/combat4d-m194-proof.mjs";

const w=JSON.parse(readFileSync(new URL("../qa/evidence/m194-run-39948482124.json",import.meta.url),"utf8"));

test("4D historical M194 genuine 38guard BLOCK then 100ms lawful PARRY: HOLD",()=>{
  const result=assessM194Witness(w);
  assert.equal(result.classification,"HOLD");
  assert.equal(result.does_not_certify_gameplay,true);
  assert.equal(result.offline_json_authenticates_github,false);
  assert.deepEqual(result.world_results.map(r=>[r.result,r.block_age_ticks,r.guard_damage]),
    [["BLOCK",7,38],["PARRY",6,0]]);
});
test("4D does not manufacture guard damage on the true second parry",()=>{
  const x=structuredClone(w);
  x.native_browser.firefox.guard=24;
  assert.throws(()=>assessM194Witness(x),/Real browser HP/);
});
test("4D rejects relabeling the server parry as a second block",()=>{
  const x=structuredClone(w);
  x.world_exchanges[1].tickLines[3]="M201_AUTH_BLOCK tick=317 attacker=1 target=2";
  assert.throws(()=>assessM194Witness(x),/server attack\/ParryStun|source failure/);
});
test("4D rejects forged second World action and actor ownership",()=>{
  const x=structuredClone(w);
  x.world_exchanges[1].tickLines[2]="M201_AUTH_ACTION tick=316 fighter=1 from=1 to=7";
  assert.throws(()=>assessM194Witness(x),/server attack\/ParryStun/);
  const y=structuredClone(w);
  y.world_exchanges[1].defenderNetId=1;
  assert.throws(()=>assessM194Witness(y),/Attempt ownership/);
});
test("4D keeps true first BLOCK even though integer log delta only 7 ticks",()=>{
  const x=structuredClone(w);
  x.world_exchanges[0].tickLines[3]="M201_AUTH_PARRY tick=283 attacker=1 target=2";
  assert.throws(()=>assessM194Witness(x),/source failure/);
});
test("4D refuses synthetic/truncated W3C Chrome clicks and false trusted wheel",()=>{
  const x=structuredClone(w);
  x.native_browser.chrome.physical_w3c_clicks=x.native_browser.chrome.physical_w3c_clicks.slice(0,2);
  assert.throws(()=>assessM194Witness(x),/Four genuine/);
  const y=structuredClone(w);
  y.original_w3c_ingress[1].trustedWheelBeforeRelease=false;
  assert.throws(()=>assessM194Witness(y),/trusted wheel/);
});
test("4D rejects fake exact-head CI pass and altered 125ms constants",()=>{
  const x=structuredClone(w);
  x.candidate_sha="main";
  assert.throws(()=>assessM194Witness(x),/provenance/);
  const y=structuredClone(w);
  y.source_outcome="success";
  assert.throws(()=>assessM194Witness(y),/provenance/);
  const z=structuredClone(w);
  z.parry_window_ms=75;
  assert.throws(()=>assessM194Witness(z),/constants/);
});
