import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const root=new URL("../assets/environment/greyhaven/a220-review/",import.meta.url);
const source=new URL("../assets/environment/greyhaven/",import.meta.url);
const report=JSON.parse(readFileSync(new URL("greyhaven_a220_xy_knight_report.json",root),"utf8"));
test("A2.20 chrome comparison uses actual game XY and independently checked real knight",()=>{
 assert.match(report.browser,/^Chrome\//);
 assert.deepEqual(report.errors,[]);
 assert.equal(report.companionKnightSourceHead,
   "c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(report.screenshots,3);
 assert.equal(report.gameCoordinateSource,"src/browser/arena-viewport.mjs");
 assert.equal(report.skinnedFootContactValidated,false);
 assert.equal(report.actualAuthoritativePortalValidated,false);
 assert.equal(report.actualGameRuntimeIntegrated,false);
 assert.equal(report.actualMultiplayerFPSMeasured,false);
 assert.equal(report.roofOcclusionValidated,false);
 assert.equal(report.atlasCopiedToGraphicsBranch,false);
 assert.equal(report.approved120ScalePreserved,true);
 assert.equal(report.gameAuthorityOrCollisionChanged,false);
 assert.equal(report.productionApproved,false);
 const cases=[report.atDoor,report.southeast,report.roll];
 for(const item of cases){
  assert.equal(item.ready,true);
  assert.equal(item.sourceGameZoom,ARENA_VIEW_ZOOM);
  assert.equal(item.sourceKnightPrHead,report.companionKnightSourceHead);
  const point=projectArenaPoint(4365+item.dx,4075+item.dy,
                                4365,4075,640,640);
  assert.ok(Math.abs(point.x-item.gamePoint[0])<.001);
  assert.ok(Math.abs(point.y-item.gamePoint[1])<.001);
  assert.equal(item.gameRuntimeModified,false);
  assert.equal(item.worldAuthorityChanged,false);
  assert.equal(item.activePortalValidated,false);
  assert.equal(item.liveMultiplayerValidated,false);
  assert.equal(item.knightSourceAssetsCopied,false);
  assert.equal(item.correctedThreeQuarterCamera,false);
  assert.ok(item.overheadErrorPx<.15);
 }
 assert.equal(report.atDoor.dx,0);
 assert.equal(report.atDoor.dy,0);
 assert.equal(report.atDoor.overheadErrorPx,0);
 assert.equal(report.atDoor.cinematicErrorPx,0);
 assert.equal(report.southeast.dx,120);
 assert.equal(report.southeast.dy,-80);
 assert.ok(report.southeast.overheadErrorPx<.001);
 assert.ok(report.southeast.cinematicErrorPx>270);
 assert.equal(report.southeast.knightDraw.w,96);
 assert.equal(report.roll.knightDraw.w,134);
 assert.ok(report.roll.cinematicErrorPx>20);
});
test("A2.20 Chrome screenshots are actual 1500px browser captures",()=>{
 for(const name of [
  "greyhaven_a220_real_knight_at_proposed_door_chrome.png",
  "greyhaven_a220_knight_game_xy_120_minus80_chrome.png",
  "greyhaven_a220_120pct_knight_roll_flat_xy_chrome.png"
 ]){
  const path=new URL(name,root);
  assert.ok(statSync(path).size>20000);
  const bytes=readFileSync(path);
  assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16),1500);
  assert.ok(bytes.readUInt32BE(20)>=1130);
 }
});
test("A2.20 original Greyhaven bake metadata preserves production opt-out",()=>{
 const manifest=JSON.parse(readFileSync(new URL("art-manifest.v1.json",source),"utf8"));
 const overhead=JSON.parse(readFileSync(
   new URL("a25-review/greyhaven_a25_webp_report.json",source),"utf8"));
 const cinematic=JSON.parse(readFileSync(
   new URL("a26-review/greyhaven_a26_webp_report.json",source),"utf8"));
 assert.equal(manifest.coordinateConvention.cameraZoom,ARENA_VIEW_ZOOM);
 assert.equal(overhead.productionApproved,false);
 assert.equal(cinematic.browserGameXYAligned,false);
 assert.equal(cinematic.browserRuntimeIntegrated,false);
 assert.equal(cinematic.productionApproved,false);
 assert.deepEqual([
  manifest.firstSlice.approvedBuilding.door.x,
  manifest.firstSlice.approvedBuilding.door.y
 ],[4365,4075]);
});
test("A2.20 projection review cannot edit authoritative player movement",()=>{
 const js=readFileSync(new URL("../web/greyhaven-a220-world-xy.mjs",import.meta.url),"utf8");
 const harness=readFileSync(new URL("../tools/art/verify_greyhaven_a220_browser.mjs",import.meta.url),"utf8");
 assert.match(js,/import \{ARENA_VIEW_ZOOM,projectArenaPoint\}/);
 assert.match(js,/gameRuntimeModified:false/);
 assert.match(js,/activePortalValidated:false/);
 assert.match(js,/correctedThreeQuarterCamera:false/);
 assert.match(js,/__a220_knights__/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/atlasCopiedToGraphicsBranch:false/);
 assert.doesNotMatch(js,/WebSocket|localStorage|fetch\([^)]*,\s*\{\s*method:\s*["']POST/);
});
