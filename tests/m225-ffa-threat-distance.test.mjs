import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planM225ThreatDistanceStaging as plan, qualifyM340StableThreatGeometry } from "../scripts/m225-ffa-threat-distance.mjs";

const sample=(left,right)=>[
 {netId:1,x:-left,y:0},{netId:2,x:0,y:0},{netId:3,x:right,y:0},
];
const get=(mode,left,right)=>plan({mode,fighters:sample(left,right),leftId:1,centerId:2,rightId:3});

test("M225 real distance preflight proves ordered primary and secondary threats",()=>{
 const a=get("primary",53,82);
 assert.equal(a.ready,true);
 assert.equal(a.spread,135);
 assert.deepEqual(a.leftMove,{key:null,ms:0});
 const b=get("secondary",57,47);
 assert.equal(b.ready,true);
 assert.equal(b.spread,104);
});
test("M225 corrects genuine wrong ordering using bounded W3C movement pulses",()=>{
 const b=get("secondary",46,70);
 assert.equal(b.ready,false);
 assert.equal(b.correctOrder,false);
 assert.equal(b.leftMove.key,"a");
 assert.equal(b.rightMove.key,"a");
 assert.ok(b.leftMove.ms>=30&&b.leftMove.ms<=145);
 assert.ok(b.rightMove.ms>=30&&b.rightMove.ms<=145);
 const p=get("primary",90,55);
 assert.equal(p.ready,false);
 assert.equal(p.leftMove.key,"d");
 assert.equal(p.rightMove.key,"d");
});
test("M225 rejects too-close rivals even if threat order is correct",()=>{
 assert.equal(get("secondary",53,40).ready,false);
 assert.equal(get("primary",47,50).ready,false);
});
test("M225 rejects missing, invalid, or reversed real position evidence",()=>{
 for(const fighters of [[],[{netId:1,x:0,y:0}],sample(60,46).map(x=>({...x,x:NaN}))]){
   assert.throws(()=>plan({mode:"secondary",fighters,leftId:1,centerId:2,rightId:3}));
 }
 assert.throws(()=>get("irrelevant",60,46));
 assert.throws(()=>plan({mode:"primary",fighters:sample(60,46).map(x=>({...x,x:-x.x})),leftId:1,centerId:2,rightId:3}));
});
test("M225 is read-only, original M142 strict primary/secondary assertions remain",()=>{
 const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const web=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const section=runner.slice(runner.indexOf("async function runOnlineUiJumpFfaThreatFlight("),runner.indexOf("async function runOnlineUiJumpFfa",runner.indexOf("async function runOnlineUiJumpFfaThreatFlight(")+10));
 assert.ok(section.includes("planM225ThreatDistanceStaging({"));
 assert.ok(section.includes("pulseMovementKey(left, stage.leftMove.key, stage.leftMove.ms)"));
 assert.ok(section.includes("pulseMovementKey(right, stage.rightMove.key, stage.rightMove.ms)"));
 assert.ok(section.includes('event.count === "2 THREATS"'));
 assert.ok(section.includes("expectedPrimaryId"));
 assert.ok(section.includes("expectedSecondaryId"));
 assert.ok(web.includes('acceptanceScenario === "uijumpffaprimary"'));
 assert.ok(web.includes('acceptanceScenario === "uijumpffasecondary"'));
});


test("M142 real W3C geometry correction cannot accidentally double-tap dash",()=>{
 const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const start=source.indexOf("async function runOnlineUiJumpFfaThreatFlight(");
 const section=source.slice(start,source.indexOf("\nasync function ",start+25));
 const prior=section.indexOf("if (geometryAttempt === 6) break;");
 const safeGap=section.indexOf("await sleep(300);",prior);
 const left=section.indexOf("pulseMovementKey(left, stage.leftMove.key, stage.leftMove.ms)",safeGap);
 const right=section.indexOf("pulseMovementKey(right, stage.rightMove.key, stage.rightMove.ms)",safeGap);
 assert.ok(prior>=0&&safeGap>prior&&left>safeGap&&right>safeGap);
 const dash=readFileSync(new URL("../src/browser/dash-input.mjs",import.meta.url),"utf8");
 assert.ok(dash.includes("DASH_DOUBLE_TAP_MS = 240;"));
 assert.ok(section.includes("cannot stage stable real ordered attack geometry"));
 assert.ok(!section.includes("dispatchEvent("));
});


test("M340 ensures real secondary jump is comfortably within strict 66px reach",()=>{
  for (const left of [61, 64, 65, 66, 82]) {
    assert.equal(get("secondary",left,47).ready,false, "late/outside jump range " + left);
  }
  const stable = get("secondary",57,47);
  assert.equal(stable.ready,true);
  assert.equal(get("secondary",60,47).ready,true);
  assert.equal(get("primary",60,82).ready,true);
  assert.equal(get("primary",64,82).ready,false);
});

test("M340 rejects a single stale 'ready' authoritative geometry sample",()=>{
  const primary=get("primary",53,82);
  const secondary=get("secondary",57,47);
  assert.equal(qualifyM340StableThreatGeometry(primary, primary).ready,true);
  assert.equal(qualifyM340StableThreatGeometry(secondary, secondary).ready,true);
  assert.equal(qualifyM340StableThreatGeometry(secondary,get("secondary",59,48)).ready,true);
  // Runner load delayed genuine key releases; those moved the jumping fighter
  // from 64px to 82px. Reject even when the initial state was ready.
  const drift=qualifyM340StableThreatGeometry(secondary,get("secondary",82,36));
  assert.equal(drift.ready,false);
  assert.equal(drift.leftDrift,25);
  assert.equal(qualifyM340StableThreatGeometry(secondary,get("secondary",60,47)).ready,true);
  assert.equal(qualifyM340StableThreatGeometry(secondary,get("secondary",60,51)).ready,false);
  assert.equal(qualifyM340StableThreatGeometry(primary,get("primary",61,82)).ready,false);
  assert.throws(()=>qualifyM340StableThreatGeometry(null,primary),TypeError);
});

test("M340 samples real authoritative positions after W3C correction and before attack",()=>{
  const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=runner.indexOf("async function runOnlineUiJumpFfaThreatFlight(");
  const section=runner.slice(start,runner.indexOf("\nasync function ",start+28));
  const stage=section.indexOf("let geometryReady = false");
  const correction=section.indexOf("pulseMovementKey(left, stage.leftMove.key, stage.leftMove.ms)");
  const confirmed=section.indexOf("qualifyM340StableThreatGeometry(stage, confirmed)");
  const preflight=section.indexOf("qualifyM340StableThreatGeometry(qualifiedGeometry, certified)");
  const attack=section.indexOf("await pressArenaJumpAttackChord(left, leftArena, 200)");
  assert.ok(stage>=0 && confirmed>stage && correction>stage && preflight>confirmed && attack>preflight);
  assert.ok(section.includes("await sleep(300);"));
  assert.ok(section.includes("await sleep(180);"));
  assert.ok(section.includes("await sleep(85);"));
  assert.ok(section.includes("cannot stage stable real ordered attack geometry"));
  assert.ok(section.includes("authoritative positions drifted after final native aim"));
  assert.ok(section.includes('event.count === "2 THREATS"'));
  assert.ok(!section.includes("dispatchEvent("));
});
