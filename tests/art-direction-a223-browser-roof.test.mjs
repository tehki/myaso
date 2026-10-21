import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const dir=new URL("../assets/environment/greyhaven/",import.meta.url);
const report=JSON.parse(readFileSync(new URL("a223-review/greyhaven_a223_real_chrome_report.json",dir),"utf8"));
const a221=JSON.parse(readFileSync(new URL("a221-review/greyhaven_a221_geometry_report.json",dir),"utf8"));
const a222=JSON.parse(readFileSync(new URL("a222-review/greyhaven_a222_geometry_report.json",dir),"utf8"));

test("A2.23 authentic Chrome measured A2.22 roof alpha shrink with preserved game XY",()=>{
 assert.match(report.browser,/^Chrome\/154\./);
 assert.equal(report.screenshots,4);
 assert.deepEqual(report.errors,[]);
 assert.equal(report.originalKnightSourceHead,
  "c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(report.actualGameProjectionModule,"src/browser/arena-viewport.mjs");
 assert.equal(report.originalKnightAtlasSha256.silver_idle,
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.equal(report.roofTopLoweredPx,25);
 assert.equal(report.roofBottomShiftPx,1);
 assert.equal(a221.sourceGameZoom,ARENA_VIEW_ZOOM);
 assert.equal(a222.sourceGameZoom,ARENA_VIEW_ZOOM);
 assert.deepEqual(a221.groundBasisPixelsPerSourceMeter,a222.groundBasisPixelsPerSourceMeter);
 assert.equal(a222.geometry.maxGroundXYDrift,0);
 for(const key of ["atDoor","walk","rolling","sentinel"]){
  const sample=report[key];
  assert.equal(sample.ready,true);
  assert.equal(sample.sourceGameZoom,ARENA_VIEW_ZOOM);
  const ref=projectArenaPoint(4365+sample.dx,4075+sample.dy,4365,4075,640,640);
  assert.ok(Math.abs(ref.x-sample.gamePoint[0])<.001);
  assert.ok(Math.abs(ref.y-sample.gamePoint[1])<.001);
  assert.equal(sample.roofTopLoweredPx,25);
  assert.equal(sample.roofBottomShiftPx,1);
  assert.equal(sample.versions.baseline.groundXYErrorPx,
               sample.versions.refined.groundXYErrorPx);
  assert.ok(sample.versions.refined.groundXYErrorPx<.15);
  assert.deepEqual(sample.versions.baseline.roofAlphaBounds,[204,15,436,230]);
  assert.deepEqual(sample.versions.refined.roofAlphaBounds,[204,40,436,231]);
  assert.equal(sample.knightAssetsCopiedToGraphics,false);
  assert.equal(sample.multiplayerRuntimeIntegrated,false);
  assert.equal(sample.authoritativeDoorOrColliderValidated,false);
  assert.equal(sample.dynamicRoofOcclusionValidated,false);
  assert.equal(sample.originalBlenderSceneModified,false);
  assert.equal(sample.productionApproved,false);
 }
 assert.deepEqual([report.atDoor.dx,report.atDoor.dy],[0,0]);
 assert.deepEqual([report.walk.dx,report.walk.dy],[120,-80]);
 assert.deepEqual([report.rolling.dx,report.rolling.dy],[40,40]);
 assert.deepEqual([report.sentinel.dx,report.sentinel.dy],[-60,70]);
 assert.equal(report.atDoor.knightDraw.w,96);
 assert.equal(report.rolling.knightDraw.w,134);
 assert.equal(report.sentinel.knightDraw.w,134);
 assert.equal(report.atDoor.roof,1);
 assert.equal(report.walk.roof,.55);
 assert.equal(report.rolling.roof,0);
 assert.equal(report.sentinel.roof,.8);
});

test("A2.23 browser screenshots exist, are actual 1500px PNGs",()=>{
 for(const name of [
  "greyhaven_a223_at_door_full_roof_chrome.png",
  "greyhaven_a223_120minus80_comparison_chrome.png",
  "greyhaven_a223_roll_roof_removed_chrome.png",
  "greyhaven_a223_sentinel_80roof_chrome.png"
 ]){
  const path=new URL("a223-review/"+name,dir);
  assert.ok(statSync(path).size>20000);
  const bytes=readFileSync(path);
  assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16),1500);
  assert.ok(bytes.readUInt32BE(20)>=1140);
 }
});

test("A2.23 is isolated preview with pinned knight companion, never runtime integration",()=>{
 const js=readFileSync(new URL("../web/greyhaven-a223-roof-browser.mjs",import.meta.url),"utf8");
 const harness=readFileSync(new URL("../tools/art/verify_greyhaven_a223_browser.mjs",import.meta.url),"utf8");
 assert.match(js,/projectArenaPoint/);
 assert.match(js,/__a223_knights__/);
 assert.match(js,/multiplayerRuntimeIntegrated:false/);
 assert.match(js,/authoritativeDoorOrColliderValidated:false/);
 assert.match(js,/dynamicRoofOcclusionValidated:false/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/pinnedKnight/);
 assert.match(harness,/Set\(\["asset-build-report.json"/);
 assert.equal(report.actualAuthoritativeEntranceValidated,false);
 assert.equal(report.roofOcclusionValidatedInActualGame,false);
 assert.equal(report.liveMultiplayerPerformanceMeasured,false);
 assert.equal(report.knightAtlasesCopiedIntoGraphics,false);
 assert.equal(report.sourceBlenderSceneModified,false);
 assert.equal(report.gameplayOrNetworkModified,false);
 assert.equal(report.productionApproved,false);
 assert.doesNotMatch(js,/WebSocket|localStorage|XMLHttpRequest/);
});
