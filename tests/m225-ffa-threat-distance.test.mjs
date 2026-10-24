import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { planM225ThreatDistanceStaging as plan } from "../scripts/m225-ffa-threat-distance.mjs";

const sample=(left,right)=>[
 {netId:1,x:-left,y:0},{netId:2,x:0,y:0},{netId:3,x:right,y:0},
];
const get=(mode,left,right)=>plan({mode,fighters:sample(left,right),leftId:1,centerId:2,rightId:3});

test("M225 real distance preflight proves ordered primary and secondary threats",()=>{
 const a=get("primary",53,82);
 assert.equal(a.ready,true);
 assert.equal(a.spread,135);
 assert.deepEqual(a.leftMove,{key:null,ms:0});
 const b=get("secondary",61,47);
 assert.equal(b.ready,true);
 assert.equal(b.spread,108);
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
 assert.ok(section.includes("pulseMovementKeyBoundedW3c(left, stage.leftMove.key, stage.leftMove.ms)"));
 assert.ok(section.includes("pulseMovementKeyBoundedW3c(right, stage.rightMove.key, stage.rightMove.ms)"));
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
 const prior=section.indexOf("if (geometryAttempt === 4) break;");
 const safeGap=section.indexOf("await sleep(300);",prior);
 const left=section.indexOf("pulseMovementKeyBoundedW3c(left, stage.leftMove.key, stage.leftMove.ms)",safeGap);
 const right=section.indexOf("pulseMovementKeyBoundedW3c(right, stage.rightMove.key, stage.rightMove.ms)",safeGap);
 assert.ok(prior>=0&&safeGap>prior&&left>safeGap&&right>safeGap);
 const dash=readFileSync(new URL("../src/browser/dash-input.mjs",import.meta.url),"utf8");
 assert.ok(dash.includes("DASH_DOUBLE_TAP_MS = 240;"));
 assert.ok(section.includes("cannot stage genuine ordered attack geometry"));
 const bounded=source.slice(source.indexOf("async function pulseMovementKeyBoundedW3c("),
   source.indexOf("async function resolveArenaElement(", source.indexOf("async function pulseMovementKeyBoundedW3c(")));
 assert.ok(bounded.includes('{ type: "keyDown", value }'));
 assert.ok(bounded.includes('{ type: "pause", duration: durationMs }'));
 assert.ok(bounded.includes('{ type: "keyUp", value }'));
 assert.ok(bounded.includes("durationMs > 250"));
 assert.ok(!section.includes("dispatchEvent("));
});


test("R2 M142 FFA uses one real release-to-light before the jump chord while keeping two-strike evidence", () => {
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=source.indexOf("async function runOnlineUiJumpFfaThreatFlight(");
  const section=source.slice(start,source.indexOf("\nasync function ",start+25));
  const light=section.indexOf("await performArenaAttackBurst(right, 1, 0, 0);");
  const jump=section.indexOf("await pressArenaJumpAttackChord(left, leftArena, 200);");
  assert.ok(light>0&&jump>light,"one native short LMB release precedes genuine Space+LMB jump");
  assert.ok(!section.includes("performArenaAttackBurst(right, 3, 0, 8)"),"obsolete three-tap light must not mistime authoritative attack");
  assert.ok(section.includes('{ primary: "JUMP STRIKE", secondary: "STRIKE", state: "strike" }'));
  assert.ok(section.includes('{ primary: "STRIKE", secondary: "JUMP STRIKE", state: "strike" }'));
  assert.ok(section.includes('event.count === "2 THREATS"'));
  assert.ok(section.includes("leftState.playerHp !== 100 || leftState.playerGuard !== 100"));
  assert.ok(!section.includes("dispatchEvent(")&&!section.includes("new PointerEvent("));
});
