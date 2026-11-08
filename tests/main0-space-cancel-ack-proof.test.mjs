import assert from "node:assert/strict";
import test from "node:test";
import {requireUniqueSpaceCancel} from "../tools/art/main0-space-cancel-ack-proof.mjs";
import {readFileSync} from "node:fs";

const press = Object.freeze({source:0,action:1,status:1,sequence:91,gestureId:7,alreadySettled:false});
const cancel = Object.freeze({source:0,action:4,status:1,sequence:92,gestureId:7,alreadySettled:false});
const duplicate = Object.freeze({source:0,action:4,status:2,sequence:92,gestureId:7,alreadySettled:true});
const copy = overrides => ({...duplicate,...overrides});

test("genuine original Space-CANCEL accepts exactly one first-settled typed terminal", () => {
  const proof = requireUniqueSpaceCancel([press,cancel]);
  assert.equal(proof.cancel.sequence,92);
  assert.equal(proof.duplicateTerminalAcks,0);
});

test("same-lease retried CANCEL ACK cannot fabricate a second gameplay terminal", () => {
  const proof = requireUniqueSpaceCancel([press,cancel,duplicate]);
  assert.equal(proof.duplicateTerminalAcks,1);
  assert.equal(requireUniqueSpaceCancel([press,cancel,copy({status:1})]).duplicateTerminalAcks,1);
});

test("duplicate terminal MUST be same gesture, same sequence and already settled", () => {
  for (const changed of [
    {sequence:93},{gestureId:8},{status:3},{alreadySettled:false},
  ]) {
    assert.throws(() => requireUniqueSpaceCancel([press,cancel,copy(changed)]), /CANCEL|terminal|ACK|sequence|gesture|status/);
  }
});

test("every RELEASE is fatal, even when claimed to be a duplicate ACK", () => {
  assert.throws(() => requireUniqueSpaceCancel([press,cancel,copy({action:3})]), /RELEASE/);
  assert.throws(() => requireUniqueSpaceCancel([press,cancel,copy({action:3,alreadySettled:false,status:1})]), /RELEASE/);
});

test("second original CANCEL and second first-settled PRESS remain fatal", () => {
  assert.throws(() => requireUniqueSpaceCancel([press,cancel,copy({alreadySettled:false,status:1,sequence:93})]), /one first-settled/);
  assert.throws(() => requireUniqueSpaceCancel([press,cancel,{...press,sequence:93}]), /one accepted/);
});

test("missing accepted CANCEL, mismatched PRESS, unsent identity remain fatal", () => {
  assert.throws(() => requireUniqueSpaceCancel([press]), /terminal/);
  assert.throws(() => requireUniqueSpaceCancel([press,{...cancel,gestureId:8}]), /gesture/);
  assert.throws(() => requireUniqueSpaceCancel([press,{...cancel,sequence:91}]), /sequence/);
});

test("native harness reads authenticated alreadySettled witness, not an inferred duplicate", () => {
  const source=readFileSync(new URL("../web/prealpha-gesture-live-lab.mjs",import.meta.url),"utf8");
  const native=readFileSync(new URL("../tools/art/main0_v2_knights_combat_four_native.mjs",import.meta.url),"utf8");
  assert.match(source,/alreadySettled:receipt.alreadySettled === true/);
  assert.match(native,/requireUniqueSpaceCancel\(cancelled\)/);
  assert.match(native,/COMBAT4_SPACE_CANCEL_ACK_FIRST_RED/);
  const helper=readFileSync(new URL("../tools/art/main0-space-cancel-ack-proof.mjs",import.meta.url),"utf8");
  assert.match(helper,/Space after LMB/);
});
