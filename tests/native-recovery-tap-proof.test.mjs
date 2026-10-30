import test from "node:test";
import assert from "node:assert/strict";
import {verifyNativeRecoveryTapIntents} from "../scripts/native-recovery-tap-proof.mjs";

function original115msTrace() {
 // Immutable CI41133458446/job124329979193:115ms DOWN/UP, World
 // 1->9->1, then34HP and34HP. An85ms intent is not a320ms Heavy.
 return {physical:[{type:"pointerdown",at:19179,trusted:true,pointerId:0},
  {type:"pointerup",at:19294,trusted:true,pointerId:0},
  {type:"pointerdown",at:19584,trusted:true,pointerId:0},
  {type:"pointerup",at:19603,trusted:true,pointerId:0}],
  admissions:[{event:1,gesture:1},{event:2,gesture:1},{event:3,gesture:1},
   {event:1,gesture:2},{event:3,gesture:2}],
  actions:[{to:1},{to:9},{to:1},{to:2},{to:3},{to:1},{to:2},{to:3}]};
}
test("real115ms undercharged intent preserves the actual Light-only World proof",()=>{
 assert.deepEqual(verifyNativeRecoveryTapIntents(original115msTrace()),
  {tapHoldsMs:[115,19],underchargedUpgradeGestures:[1]});
});
test("native tap proof rejects early or duplicate intent and an actual World Heavy",()=>{
 let t=original115msTrace();t.physical[1].at=t.physical[0].at+40;
 assert.throws(()=>verifyNativeRecoveryTapIntents(t),/cannot emit hold intent/);
 t=original115msTrace();t.admissions.push({event:2,gesture:1});
 assert.throws(()=>verifyNativeRecoveryTapIntents(t),/at most one/);
 t=original115msTrace();t.actions.push({to:10});
 assert.throws(()=>verifyNativeRecoveryTapIntents(t),/actual World Heavy/);
});
test("original135ms physical limit, trusted edges and Jump ownership remain strict",()=>{
 let t=original115msTrace();t.physical[1].at=t.physical[0].at+135;
 assert.throws(()=>verifyNativeRecoveryTapIntents(t),/original135ms/);
 t=original115msTrace();t.physical[0].trusted=false;
 assert.throws(()=>verifyNativeRecoveryTapIntents(t));
 t=original115msTrace();t.admissions[0].event=5;
 assert.throws(()=>verifyNativeRecoveryTapIntents(t),/cannot emit hold intent/);
});
