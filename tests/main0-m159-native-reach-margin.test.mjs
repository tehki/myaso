import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const start=source.indexOf("async function runOnlineUiMultiKnockdownFfaHitFlight(entries) {");
const end=source.indexOf("\nasync function ",start+20);
const flight=source.slice(start,end);

test("M159 genuine original four-client staging uses bounded native W3C to avoid separately held keys",()=>{
  assert.ok(start>=0&&end>start);
  assert.match(flight,/await pulseMovementKeyBoundedW3c\(secondVictim, plan\.key, plan\.pulseMs\)/);
  assert.doesNotMatch(flight,/await pulseMovementKey\(secondVictim, plan\.key, plan\.pulseMs\)/);
  assert.match(source,/async function pulseMovementKeyBoundedW3c\(/);
  assert.match(source,/type: "keyDown", value/);
  assert.match(source,/type: "pause", duration: durationMs/);
  assert.match(source,/type: "keyUp", value/);
  assert.match(flight,/const clusterPlans = \[\]/);
  assert.match(flight,/planM197KnockdownClusterNudge\(/);
  assert.match(flight,/M197 could not stage genuine ordered roll contacts/);
});

test("M159 refuses edge-of-reach staging without a real trusted server-validated approach",()=>{
  assert.match(flight,/const originalLightReach=COMBAT\.attack\.reach\+COMBAT\.fighterRadius/);
  assert.match(flight,/const reachBefore=await stageM159ReachMargin\(\)/);
  assert.match(flight,/await pulseMovementKeyBoundedW3c\(punisher,"s",45\)/);
  assert.match(flight,/let reachAfter=reachBefore/);
  assert.match(flight,/if\(reachAfter\.distance > originalLightReach-7\)/);
  assert.match(flight,/M159 original World reach margin not demonstrated/);
  assert.match(flight,/M159_NATIVE_REACH_MARGIN_STAGE/);
  assert.match(flight,/if\(reachBefore\.target\.y<=reachBefore\.own\.y\)/);
  assert.match(flight,/const target = fighters\.find\(f => f\.netId === firstVictimId\)/);
  assert.match(flight,/await aimArenaForExclusiveAuthoritativeTarget\(/);
  assert.match(flight,/verifyM209DualKnockdownServerPunish\(m201ServerOutput\(\)/);
  assert.match(flight,/firstState\?\.playerHp === 66/);
  assert.match(flight,/secondState\?\.playerHp === 100/);
  assert.match(flight,/provenance\.firstKnockdown\.epochMs/);
});

test("M159 physical staging happens before original wheel and never changes gameplay timing or hit admission",()=>{
  const stage=flight.indexOf("M159_NATIVE_REACH_MARGIN_STAGE");
  const roll=flight.indexOf("await scrollArenaWheel(roller");
  const light=flight.indexOf("await setArenaAttackButton(punisher, true)");
  const head=flight.indexOf("await aimArenaForExclusiveAuthoritativeTarget(");
  assert.ok(stage>=0&&roll>stage&&light>roll&&head>stage);
  assert.doesNotMatch(flight,/COMBAT\.attack\.reach\s*=/);
  assert.doesNotMatch(flight,/COMBAT\.dodge\.collisionKnockdownMs\s*=/);
  assert.doesNotMatch(flight,/setClientHp|fakeHit|syntheticClick|dispatchEvent\(/);
});
