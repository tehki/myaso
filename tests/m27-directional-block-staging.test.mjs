import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {planM27DirectionalBackblock} from "../src/combat/m27-directional-block-staging.mjs";

test("M27 starts authentic Light from in-range Idle and rear Block only after replicated LightWindup", () => {
  assert.deepEqual(planM27DirectionalBackblock({isAttacker:true, ownAction:0, peerAction:0, distance:65}),
    {attackReady:true, blockReady:false});
  assert.deepEqual(planM27DirectionalBackblock({isAttacker:false, ownAction:0, peerAction:1, distance:65}),
    {attackReady:false, blockReady:true});
  for(const action of [0,2,3,6,7,9,18,19]) {
    assert.equal(planM27DirectionalBackblock({isAttacker:false, ownAction:0, peerAction:action, distance:65}).blockReady, false);
  }
  assert.equal(planM27DirectionalBackblock({isAttacker:false, ownAction:6, peerAction:1, distance:65}).blockReady,false);
  assert.equal(planM27DirectionalBackblock({isAttacker:true, ownAction:1, peerAction:6, distance:65}).attackReady,false);
  assert.equal(planM27DirectionalBackblock({isAttacker:true, ownAction:0, peerAction:0, distance:75}).attackReady,false);
  assert.equal(planM27DirectionalBackblock({isAttacker:true, ownAction:0, peerAction:0, distance:NaN}).attackReady,false);
});

test("M27 preserves strict original-contact overlap, rear arc, HP and untouched guard checks", () => {
  const client=readFileSync(new URL("../web/pvp-flight.mjs",import.meta.url),"utf8");
  const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  assert.match(client,/planM27DirectionalBackblock/);
  assert.match(client,/attacker\.action === 2 && defender\.action === 6/);
  assert.match(client,/blockFacingDelta > Math\.PI \* 0\.46/);
  assert.match(client,/directionalBlockOverlapSeen\s*&&/);
  assert.match(client,/m27OriginalWorldSamples\.push/);
  assert.match(runner,/!result\.defenderBlockSeen \|\| !result\.directionalBlockOverlapSeen/);
  assert.match(runner,/result\.minDefenderHp < 100/);
  assert.match(runner,/result\.minDefenderGuard !== 100/);
});
