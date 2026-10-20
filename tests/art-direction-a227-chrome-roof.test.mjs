import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const root = new URL("../",import.meta.url);
const json = p=>JSON.parse(readFileSync(new URL(p,root),"utf8"));
const data = p=>readFileSync(new URL(p,root));
const digest = p=>createHash("sha256").update(data(p)).digest("hex");
const art = "assets/environment/greyhaven/";
const report=json(art+"a227-review/greyhaven_a227_real_chrome_report.json");
const generated=json(art+"a226-review/greyhaven_a226_weathering_report.json");
const contract=json(art+"red-lion-a225-architecture-handoff.json");

test("A2.27 actual Chrome review compares A2.24 and A2.26 roof WebPs with an untouched 120% source Knight",()=>{
 assert.match(report.browser,/^Chrome\/154\./);
 assert.equal(report.screenshots,4);
 assert.deepEqual(report.errors,[]);
 assert.equal(report.originalKnightSourceHead,
  "c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(report.originalKnightAtlasSha256.silver_idle,
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.equal(report.originalKnightAtlasSha256.silver_roll,
  "31c774ac930a5cf1060640f1fc2914b02d6d5ddccd7d56591123efd098909426");
 assert.equal(report.originalKnightAtlasSha256.t1_roll,
  "16ea4b62867e95e1be7a4c18b3b48cc427b8338badae882692e6b1e051f0a24f");
 assert.equal(report.actualGameProjectionModule,contract.projection.module);
 assert.equal(ARENA_VIEW_ZOOM,contract.projection.cameraZoom);
 assert.equal(digest(art+"a226-review/red_lion_a226_roof.webp"),generated.newRoofSha256);
 assert.equal(digest(contract.rasterLayers.roof.file),generated.sourceRoofSha256);
 assert.equal(digest(art+"a226-review/red_lion_a226_base.webp"),generated.sourceBaseSha256);
 assert.deepEqual(report.roofPixelComparison,{changedVisiblePixels:39090,alphaPixelDifferences:0});
 assert.equal(report.roofTopLoweredPx,0);
 assert.equal(report.roofBottomShiftPx,0);
});

test("A2.27 four genuine Chrome scenario records preserve actor presentation and real game XY",()=>{
 const door=contract.proposedWorldPlacement.door;
 for(const [name,clip,dx,dy,roof] of [
  ["atDoor","silver_idle",0,0,1],
  ["walk","silver_idle",120,-80,0.55],
  ["rolling","silver_roll",40,40,0],
  ["sentinel","t1_roll",-60,70,0.8]
 ]){
  const s=report[name];
  assert.equal(s.ready,true);
  assert.deepEqual([s.clip,s.dx,s.dy,s.roof],[clip,dx,dy,roof]);
  const p=projectArenaPoint(door.x+dx,door.y+dy,door.x,door.y,640,640);
  assert.ok(Math.abs(p.x-s.gamePoint[0])<.001);
  assert.ok(Math.abs(p.y-s.gamePoint[1])<.001);
  assert.equal(s.sourceGameZoom,ARENA_VIEW_ZOOM);
  assert.equal(s.knightDraw.w,clip==="silver_idle"?96:134);
  assert.equal(s.knightDraw.h,s.knightDraw.w);
  assert.deepEqual(s.roofPixelComparison,report.roofPixelComparison);
  assert.deepEqual(s.versions.baseline.roofAlphaBounds,[204,40,436,231]);
  assert.deepEqual(s.versions.refined.roofAlphaBounds,[204,40,436,231]);
  assert.ok(s.versions.baseline.groundXYErrorPx<0.001);
  assert.equal(s.versions.baseline.groundXYErrorPx,
   s.versions.refined.groundXYErrorPx);
  assert.equal(s.authoritativeDoorOrColliderValidated,false);
  assert.equal(s.dynamicRoofOcclusionValidated,false);
  assert.equal(s.multiplayerRuntimeIntegrated,false);
  assert.equal(s.originalBlenderSceneModified,false);
  assert.equal(s.knightAssetsCopiedToGraphics,false);
  assert.equal(s.productionApproved,false);
 }
});

test("A2.27 captures and locally isolated browser harness do not activate gameplay",()=>{
 const filenames=[
  "greyhaven_a227_at_door_full_roof_chrome.png",
  "greyhaven_a227_120minus80_comparison_chrome.png",
  "greyhaven_a227_roll_roof_removed_chrome.png",
  "greyhaven_a227_sentinel_80roof_chrome.png"
 ];
 for(const f of filenames){
  const path=art+"a227-review/"+f,buf=data(path);
  assert.ok(statSync(new URL(path,root)).size>20000);
  assert.equal(buf.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(buf.readUInt32BE(16),1500);
  assert.ok(buf.readUInt32BE(20)>=1000);
 }
 const viewer=data("web/greyhaven-a227-roof-browser.mjs").toString("utf8");
 const harness=data("tools/art/verify_greyhaven_a227_browser.mjs").toString("utf8");
 assert.match(viewer,/projectArenaPoint/);
 assert.match(viewer,/roofPixelComparison/);
 assert.match(viewer,/__a227_knights__/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/pinnedKnight/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
 assert.equal(report.actualAuthoritativeEntranceValidated,false);
 assert.equal(report.roofOcclusionValidatedInActualGame,false);
 assert.equal(report.liveMultiplayerPerformanceMeasured,false);
 assert.equal(report.knightAtlasesCopiedIntoGraphics,false);
 assert.equal(report.sourceBlenderSceneModified,false);
 assert.equal(report.gameplayOrNetworkModified,false);
 assert.equal(report.productionApproved,false);
});
