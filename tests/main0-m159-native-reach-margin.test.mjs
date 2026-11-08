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
  assert.match(flight,/const reachStages=\[\]/);
  assert.match(flight,/for\(let correction=0; correction<3/);
  assert.match(flight,/const dx=reachAfter\.target\.x-reachAfter\.own\.x/);
  assert.match(flight,/const dy=reachAfter\.target\.y-reachAfter\.own\.y/);
  assert.match(flight,/const desiredDistance=originalLightReach-12/);
  assert.match(flight,/if\(dy<=55 \|\| Math\.abs\(dx\)>=desiredDistance\)/);
  assert.match(flight,/Math\.sqrt\(desiredDistance\*\*2-dx\*\*2\)/);
  assert.match(flight,/Math\.min\(240,Math\.max\(45,Math\.ceil\(verticalAdvance\*1000\/COMBAT\.moveSpeed\)\)\)/);
  assert.match(flight,/await pulseMovementKeyBoundedW3c\(punisher,"s",pulseMs\)/);
  assert.match(flight,/await sleep\(100\)/);
  assert.match(flight,/reachAfter=await stageM159ReachMargin\(\)/);
  assert.match(flight,/let reachAfter=reachBefore/);
  assert.match(flight,/if\(reachAfter\.distance > originalLightReach-7\)/);
  assert.match(flight,/M159 original World reach margin not demonstrated/);
  assert.match(flight,/M159_NATIVE_REACH_MARGIN_STAGE/);
  assert.match(flight,/const target = fighters\.find\(f => f\.netId === firstVictimId\)/);
  assert.match(flight,/const target = fighters\.find\(f => f\.netId === firstVictimId\)/);
  assert.match(flight,/await aimArenaForExclusiveAuthoritativeTarget\(/);
  assert.match(flight,/verifyM209DualKnockdownServerPunish\(m201ServerOutput\(\)/);
  assert.match(flight,/firstState\?\.playerHp === 66/);
  assert.match(flight,/secondState\?\.playerHp === 100/);
  assert.match(flight,/provenance\.firstKnockdown\.epochMs/);
});

test("M159 stages genuine post-knockback contact geometry BEFORE the original roll without inflating reach",()=>{
  assert.match(flight,/const postRollLaneStages=\[\]/);
  assert.match(flight,/const wantedX=postRollLane\.target\.x\+12/);
  assert.match(flight,/const wantedY=postRollLane\.target\.y-78/);
  assert.match(flight,/await pulseMovementKeyBoundedW3c\(punisher,delta>0\?positive:negative,pulseMs\)/);
  assert.match(flight,/postRollLane=await stageM159ReachMargin\(\)/);
  assert.match(flight,/M159_POST_ROLL_CONTACT_LANE_STAGE/);
  assert.match(flight,/Math\.abs\(laneDx\)>12\|\|Math\.abs\(laneDy\)>12/);
  assert.match(flight,/postRollLane\.target\.y-postRollLane\.own\.y<55/);
  assert.match(flight,/postRollLane\.distance>originalLightReach-7/);
  assert.match(flight,/M159 physical post-roll contact lane not demonstrated/);
  assert.ok(flight.indexOf("M159_POST_ROLL_CONTACT_LANE_STAGE") <
    flight.indexOf("await scrollArenaWheel(roller"));
  assert.doesNotMatch(flight,/COMBAT\.attack\.reach\s*=|COMBAT\.dodge\.collisionKnockdownMs\s*=/);
});
test("M159 left-upper physical lane has a distinct 94px roller exclusion margin in the two retained first-RED geometries",()=>{
  // All positions are read-only original Rust snapshots from the retained
  // first-REDs. These numerical checks are planning evidence, NEVER a
  // replacement for post-roll hit / miss authority in live Chrome CI.
  const cases=[
    {preVictim:{x:136,y:102},postVictim:{x:170,y:102},postRoller:{x:222,y:134}},
    {preVictim:{x:138,y:96},postVictim:{x:172,y:78},postRoller:{x:176,y:110}},
  ];
  const reach=94;
  for(const {preVictim,postVictim,postRoller} of cases){
    const own={x:preVictim.x+12,y:Math.max(18,preVictim.y-78)};
    assert.ok(Math.hypot(postVictim.x-own.x,postVictim.y-own.y)<reach,
      "selected first victim remains within immutable genuine Light reach");
    assert.ok(Math.hypot(postRoller.x-own.x,postRoller.y-own.y)>reach,
      "retained first-RED roller lies beyond immutable genuine Light reach");
  }
  assert.match(flight,/const laneDx=postRollLane\.own\.x-\(postRollLane\.target\.x\+12\)/);
  assert.match(flight,/const laneDy=postRollLane\.own\.y-\(postRollLane\.target\.y-78\)/);
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
