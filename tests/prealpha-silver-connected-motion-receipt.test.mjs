import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {qualifyPrealphaSilverConnectedMotions} from "../scripts/graphics3a-prealpha-connected-motion-receipt.mjs";
const frames=(clip,d=0)=>(clip==="silver_roll"
 ? Array.from({length:8},(_,i)=>({
   clip,sourceFrame:i,facing:(d+i)%8,x:120+i,y:140,
   epochMs:1792600000000+i*45
 }))
 : [{
   clip,sourceFrame:0,facing:d,x:120,y:140,epochMs:1792600000000
  },{
   clip,sourceFrame:5,facing:(d+1)%8,x:180,y:240,epochMs:1792600000310
  }]);
const mk=(label,clip,initiator)=>({
 label,clip,initiator,nativeGestureObserved:true,
 clients:[{engine:"chrome",draws:frames(clip,2)},
   {engine:"firefox",draws:frames(clip,4)}],
});
const base=()=>({
 players:[{engine:"chrome",serverPlayerId:1},{engine:"firefox",serverPlayerId:2}],
 phases:[mk("jump","silver_jump","chrome"),mk("roll","silver_roll","firefox")]
});
function fail(rx,mutate){const data=base();mutate(data);assert.throws(()=>qualifyPrealphaSilverConnectedMotions(data),new RegExp(rx));}
test("genuine native original Silver jump/roll gate is strict but does not assert Greyhaven or human operation",()=>{
 const value=qualifyPrealphaSilverConnectedMotions(base());
 assert.equal(value.genuineConnectedOriginalSilverJumpAndRoll,true);
 assert.equal(value.originalSilverRollLateFramesBothBrowsers,true);
 assert.equal(value.server350msActionTimingValidated,false);
 assert.deepEqual(value.motions[1].views.map(x=>x.frames.at(-1)),[7,7]);
 assert.deepEqual(value.serverPlayers,[1,2]);
 assert.deepEqual(value.motions.map(x=>x.label),["jump","roll"]);
 assert.deepEqual(value.motions.map(x=>x.views.length),[2,2]);
 for(const f of ["actualServerActionStartTickValidated","actualTwoIndependentHumanOperators",
   "originalWorldFloorProven","realGreyhavenProven","fourPlayerProven",
   "damageHitReceiptProven","productionReleaseApproved"])assert.equal(value[f],false);
});
test("fake duplicate or missing server player identities and browser engines never pass",()=>{
 fail("distinct server",d=>d.players[1].serverPlayerId=1);
 fail("distinct server",d=>d.players[0].serverPlayerId=0);
 fail("Chrome Firefox",d=>d.players[1].engine="mock");
 fail("Chrome Firefox",d=>d.players.reverse());
 fail("Chrome Firefox",d=>d.players.pop());
});
test("cannot pass a roll as a jump, forged native gestures, or a single browser view",()=>{
 fail("ordered",d=>d.phases.reverse());
 fail("ordered",d=>d.phases[1].initiator="chrome");
 fail("ordered",d=>d.phases[0].clip="silver_roll");
 fail("W3C gesture",d=>d.phases[1].nativeGestureObserved=false);
 fail("W3C gesture",d=>d.phases[0].nativeGestureObserved=false);
 fail("both browser",d=>d.phases[0].clients.pop());
 fail("missing source",d=>d.phases[1].clients[0].draws=[]);
});
test("genuine source-only crop bounds, eight-way facings and real browser epochs required",()=>{
 fail("invalid",d=>d.phases[0].clients[0].draws[0].sourceFrame=6);
 fail("invalid",d=>d.phases[1].clients[1].draws[0].sourceFrame=8);
 fail("invalid",d=>d.phases[1].clients[0].draws[0].facing=9);
 fail("invalid",d=>d.phases[0].clients[0].draws[0].epochMs=NaN);
 fail("invalid",d=>d.phases[0].clients[0].draws[0].x=Infinity);
 fail("invalid",d=>d.phases[0].clients[1].draws[0].clip="sentinel_jump");
});
test("never certify full 350ms Silver roll from only first/source middle frames or short span",()=>{
 fail("roll incomplete",d=>{
   d.phases[1].clients[0].draws=d.phases[1].clients[0].draws.slice(0,2);
 });
 fail("roll incomplete",d=>{
   d.phases[1].clients[1].draws=d.phases[1].clients[1].draws.slice(0,5);
 });
 fail("roll incomplete",d=>{
   d.phases[1].clients[0].draws.forEach((f,i)=>f.epochMs=1792600000000+i*16);
 });
 fail("roll incomplete",d=>{
   d.phases[1].clients[1].draws.forEach(f=>f.sourceFrame=0);
 });
});
test("proof comes from W3C real Rust server M47 opt-in; default renderer unchanged",()=>{
 const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 const workflow=readFileSync(new URL("../.github/workflows/ci.yml",import.meta.url),"utf8");
 assert.match(source,/MYASO_GRAPHICS3A_PREALPHA_MOTION_FLIGHT/);
 assert.match(source,/prealphaSilverMotionFlight && !prealphaSilverFlight/);
 assert.match(source,/performArenaJumpPress\(chrome,90\)/);
 assert.match(source,/scrollArenaWheel\(firefox,element,-120,0\)/);
 assert.match(source,/await sleep\(490\)/);
 assert.match(source,/const rolling=await captured\(preRoll,"silver_roll"\)/);
 assert.match(source,/GRAPHICS3A_PREALPHA_CONNECTED_ROLL_JUMP/);
 assert.match(source,/qualifyPrealphaSilverConnectedMotions/);
 assert.match(workflow,/MYASO_GRAPHICS3A_PREALPHA_MOTION_FLIGHT: "1"/);
 assert.match(workflow,/graphics3a-real-silver-2p/);
});
