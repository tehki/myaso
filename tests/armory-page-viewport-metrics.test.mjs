import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {measureOriginalRackPageVisibility} from "../src/browser/armory-page-viewport-metrics.mjs";
const game=({canvasRect={x:137,y:390,width:1080,height:810},
 viewportWidth=1366,viewportHeight=682,observedActors=[]}={})=>({
 rackScreenRect:{x:373.44,y:65.36,width:240,height:166},
 canvasRect,canvasWidth:1080,canvasHeight:810,
 viewportWidth,viewportHeight,camera:{x:3784,y:4084},zoom:.84,
 observedActors
});
test("P0 original rack intrinsic rectangle can fit game Canvas but still be clipped by actual Firefox page fold",()=>{
 const p=measureOriginalRackPageVisibility(game());
 assert.equal(p.rackFullyInBrowserViewport,true);
 assert.equal(p.rackVisibleFraction,1);
 assert.ok(p.canvasVisibleFraction<0.4);
 assert.equal(p.pageOcclusionVerified,false);
 assert.equal(p.fullSilverAnimationVisibilityVerified,false);
 assert.equal(p.changesGameplay,false);
 // Exact source canvas has 810px height but only 292px visible below top 390.
 assert.ok(p.canvasVisibleFraction>0.35);
});
test("P0 rack fraction remains source-correct when CSS canvas is farther below fold",()=>{
 const p=measureOriginalRackPageVisibility(game({
  canvasRect:{x:137,y:560,width:1080,height:810},viewportHeight:682
 }));
 assert.equal(p.rackFullyInBrowserViewport,false);
 assert.ok(p.rackVisibleFraction>0&&p.rackVisibleFraction<0.4);
 assert.ok(p.canvasVisibleFraction<0.16);
});
test("P0 browser fold logic respects CSS scale, translated canvas and actual source server fighter center",()=>{
 const p=measureOriginalRackPageVisibility(game({
  canvasRect:{x:140,y:490,width:540,height:405},
  viewportWidth:720,viewportHeight:600,
  observedActors:[{netId:1,x:3746,y:4100},{netId:2,x:3784,y:4084}]
 }));
 assert.equal(p.actors.length,2);
 assert.equal(p.actorCentersTotal,2);
 assert.ok(p.rackVisibleFraction>0);
 assert.ok(p.rackCss.width===120);
 assert.equal(p.measuredFromRealDOM,false);
 for(const a of p.actors){
  assert.ok(Number.isFinite(a.pageCenterX));
  assert.ok(Number.isFinite(a.pageCenterY));
 }
});
test("P0 viewport projection fails closed on missing/forged actor or nonfinite dimensions",()=>{
 const invalid=[
  {...game(),viewportHeight:0},
  {...game(),canvasWidth:NaN},
  {...game(),canvasRect:{x:0,y:0,width:0,height:400}},
  {...game(),camera:{x:NaN,y:1}},
  {...game(),observedActors:[{netId:0,x:"3740",y:4088}]},
  {...game(),observedActors:[{netId:2,x:Infinity,y:4088}]}
 ];
 for(const p of invalid)assert.throws(()=>measureOriginalRackPageVisibility(p));
});
test("P0 passive browser-fold diagnostics are localhost opt-in only and do not modify world/Combat/scroll",()=>{
 const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
 const mod=read("src/browser/armory-optin-live-rack.mjs");
 const client=read("web/online-game.mjs");
 const runner=read("scripts/alpha_p0_four_native_rack_at_approaches.mjs");
 assert.match(mod,/measureOriginalRackPageVisibility/);
 assert.match(client,/window\.__MYASO_ARMORY_RACK_REVIEW__/);
 assert.match(client,/armoryRackReview\?\.measurePage/);
 assert.match(client,/params\.get\("armoryart"\) === "1"/);
 assert.match(runner,/browserPageVisibility/);
 assert.doesNotMatch(mod,/scrollIntoView\(|WebSocket\(|sendTryPickup\(/);
 assert.doesNotMatch(client,/window\.scrollTo\(.*armoryRack/);
});
