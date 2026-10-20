import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const art=new URL("../assets/environment/greyhaven/a221-review/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,art),"utf8"));
const geom=read("greyhaven_a221_geometry_report.json");
const webp=read("greyhaven_a221_webp_report.json");
const chrome=read("greyhaven_a221_browser_report.json");

test("A2.21 source Blender elevation preserves precisely the flat world XY ground basis",()=>{
 assert.equal(geom.milestone,"Blood & Iron A2.21 authentic Red Lion XY-grounded decorative facade bake");
 assert.equal(geom.sourceGameZoom,ARENA_VIEW_ZOOM);
 assert.deepEqual(geom.canvasPx,[640,640]);
 assert.deepEqual(geom.proposedDoorGameXY,[4365,4075]);
 assert.deepEqual(geom.visualDoorAnchorPixels,[320,320]);
 assert.equal(geom.metersPerWorldUnit,.025);
 assert.ok(Math.abs(geom.gamePixelsPerSourceMeter-33.6)<.000001);
 assert.deepEqual(geom.groundBasisPixelsPerSourceMeter.x,[33.600006,0]);
 assert.deepEqual(geom.groundBasisPixelsPerSourceMeter.y,[0,33.600006]);
 assert.deepEqual(geom.decorativeHeightRisePixelsPerSourceMeter,[0,-28.560009]);
 assert.equal(geom.heightLiftFactor,.85);
 assert.equal(geom.verticalDepthScale,.05);
 assert.equal(geom.geometry.sourceMeshObjects,17);
 assert.equal(geom.geometry.sourceVertices,4318);
 assert.equal(geom.geometry.transformedVertices,4318);
 assert.equal(geom.geometry.groundVerticesUnmoved,12);
 assert.equal(geom.geometry.maxGroundXYDrift,0);
 assert.equal(geom.layers.base.visibleMeshCount,13);
 assert.equal(geom.layers.roof.visibleMeshCount,3);
 assert.equal(geom.sourceSceneSaved,false);
 assert.equal(geom.actualAuthoritativeDoorOrCollisionApproved,false);
 assert.equal(geom.actualNetworkPlayerIntegrationTested,false);
 assert.equal(geom.gameSourceModified,false);
 assert.equal(geom.productionApproved,false);
 assert.equal(geom.roofOcclusionRuntimeApproved,false);
});

test("A2.21 actual source textures are lossless WebP layers with independent visual door anchors",()=>{
 assert.deepEqual(webp.visualDoorPivotPx,[320,320]);
 assert.deepEqual(webp.originalGameGroundBasisPixelsPerMeter,
   geom.groundBasisPixelsPerSourceMeter);
 assert.deepEqual(webp.decorativeHeightRisePixelsPerMeter,
   geom.decorativeHeightRisePixelsPerSourceMeter);
 for(const name of ["base","roof"]){
  const layer=webp.layers[name];
  const path=new URL(layer.file,art);
  const bytes=readFileSync(path);
  assert.equal(bytes.length,layer.bytes);
  assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(bytes.subarray(8,12).toString("ascii"),"WEBP");
  assert.equal(layer.roundtripExactRGBA,true);
  assert.equal(layer.flippedIntoGamePositiveYDown,true);
  assert.ok(layer.croppedPixels.every(n=>n>50&&n<640));
  assert.equal(layer.drawOffsetFromVisualDoorPixels.length,2);
  assert.ok(layer.visualDoorAnchorInCropPixels.every(Number.isFinite));
 }
 const preview=new URL(webp.preview,art);
 assert.ok(statSync(preview).size>20000);
 assert.equal(readFileSync(preview).subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(webp.originalGroundVerticesMovedXY,false);
 assert.equal(webp.collisionOrPortalActivated,false);
 assert.equal(webp.actualGameRenderIntegrated,false);
 assert.equal(webp.originalSceneOrKnightSourcesChanged,false);
 assert.equal(webp.productionApproved,false);
});

test("A2.21 actual Chrome shows XY-grounded facade with approved companion 120% knight",()=>{
 assert.match(chrome.browser,/^Chrome\//);
 assert.equal(chrome.screenshots,3);
 assert.deepEqual(chrome.errors,[]);
 assert.equal(chrome.companionKnightSourceHead,
  "c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(chrome.gameCoordinateSource,"src/browser/arena-viewport.mjs");
 for(const sample of [chrome.atDoor,chrome.southeast,chrome.roll]){
  assert.equal(sample.ready,true);
  const projected=projectArenaPoint(4365+sample.dx,4075+sample.dy,4365,4075,640,640);
  assert.ok(Math.abs(projected.x-sample.gamePoint[0])<.001);
  assert.ok(Math.abs(projected.y-sample.gamePoint[1])<.001);
  assert.ok(sample.elevatedErrorPx<.15);
  assert.equal(sample.gameRuntimeModified,false);
  assert.equal(sample.worldAuthorityChanged,false);
  assert.equal(sample.activePortalValidated,false);
  assert.equal(sample.liveMultiplayerValidated,false);
  assert.equal(sample.knightSourceAssetsCopied,false);
  assert.equal(sample.correctedThreeQuarterCamera,false);
 }
 assert.equal(chrome.atDoor.elevatedErrorPx,0);
 assert.equal(chrome.atDoor.cinematicErrorPx,0);
 assert.deepEqual([chrome.southeast.dx,chrome.southeast.dy],[120,-80]);
 assert.ok(chrome.southeast.elevatedErrorPx<.001);
 assert.ok(chrome.southeast.cinematicErrorPx>270);
 assert.equal(chrome.southeast.knightDraw.w,96);
 assert.equal(chrome.roll.knightDraw.w,134);
 assert.equal(chrome.actualAuthoritativePortalValidated,false);
 assert.equal(chrome.actualGameRuntimeIntegrated,false);
 assert.equal(chrome.atlasCopiedToGraphicsBranch,false);
 assert.equal(chrome.approved120ScalePreserved,true);
 assert.equal(chrome.productionApproved,false);
});

test("A2.21 screenshots and isolated viewer are real but must not touch online gameplay",()=>{
 for(const file of [
  "greyhaven_a221_knight_at_art_door_chrome.png",
  "greyhaven_a221_xy_facade_120_minus80_chrome.png",
  "greyhaven_a221_real_knight_roll_xy_chrome.png"
 ]){
  const path=new URL(file,art);
  assert.ok(statSync(path).size>25000);
  const buf=readFileSync(path);
  assert.equal(buf.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(buf.readUInt32BE(16),1500);
 }
 const viewer=readFileSync(new URL("../web/greyhaven-a221-2p5d.mjs",import.meta.url),"utf8");
 const baker=readFileSync(new URL("../tools/art/render_greyhaven_a221_xy_elevation.py",import.meta.url),"utf8");
 const encoder=readFileSync(new URL("../tools/art/encode_greyhaven_a221_xy_elevation.py",import.meta.url),"utf8");
 assert.match(viewer,/projectArenaPoint/);
 assert.match(viewer,/sourceKnightPrHead/);
 assert.match(viewer,/__a221_knights__/);
 assert.match(viewer,/activePortalValidated:false/);
 assert.match(viewer,/correctedThreeQuarterCamera:false/);
 assert.match(baker,/original_world_to_decorative/);
 assert.match(baker,/groundVerticesUnmoved/);
 assert.match(baker,/sourceSceneSaved/);
 assert.match(encoder,/roundtripExactRGBA/);
 assert.doesNotMatch(viewer,/new WebSocket|localStorage|XMLHttpRequest/);
 assert.doesNotMatch(baker,/save_as_mainfile|export_scene\.gltf/);
});
