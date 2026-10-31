import assert from "node:assert/strict";
import {COMBAT} from "../src/combat/model.mjs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";

// Verify physical input and actual World outcomes, not the name of a hold-
// intent edge. The existing85ms UPGRADE precedes server-owned320ms Heavy.
export function verifyNativeRecoveryTapIntents({physical,admissions,actions}) {
 const edges=physical.filter(e=>e.type==="pointerdown"||e.type==="pointerup");
 const presses=admissions.filter(e=>e.event===1||e.event===5);
 assert.equal(edges.length,presses.length*2,"every admitted gesture needs one actual physical DOWN/UP");
 const tapHoldsMs=[],underchargedUpgradeGestures=[];
 for(let i=0;i<presses.length;i++) {
  const down=edges[2*i],up=edges[2*i+1],press=presses[i];
  assert.equal(down.type,"pointerdown");assert.equal(up.type,"pointerup");
  assert.equal(down.trusted,true);assert.equal(up.trusted,true);
  assert.equal(down.pointerId,up.pointerId);
  const held=up.at-down.at;
  assert.ok(Number.isFinite(held)&&held>=0&&held<COMBAT.attack.windupMs,"actual native tap must remain below original135ms Light window");
  tapHoldsMs.push(held);
  const upgrades=admissions.filter(e=>e.event===2&&e.gesture===press.gesture);
  assert.ok(upgrades.length<=1,"a physical gesture may emit at most one hold-intent upgrade");
  if(held<85||press.event===5)assert.equal(upgrades.length,0,"short or Jump chord cannot emit hold intent");
  if(upgrades.length)underchargedUpgradeGestures.push(press.gesture);
 }
 assert.ok(admissions.filter(e=>e.event===2).every(e=>presses.some(p=>p.gesture===e.gesture)),"hold intent belongs to its actual physical gesture");
 assert.equal(actions.filter(e=>e.to===COMBAT_ACTION.heavyAttackActive||e.to===COMBAT_ACTION.heavyAttackRecovery).length,0,
  "a tap cannot commit an actual World Heavy");
 return {tapHoldsMs,underchargedUpgradeGestures};
}
