import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const root=new URL("../assets/environment/greyhaven/",import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),"utf8"));
const baseline=read("a222-review/greyhaven_a222_webp_report.json");
const geo=read("a222-review/greyhaven_a222_geometry_report.json");
const source=read("a224-review/greyhaven_a224_facade_report.json");
const current=read("a224-review/greyhaven_a224_webp_report.json");
const browser=read("a224-review/greyhaven_a224_real_chrome_report.json");

const sha=buf=>createHash("sha256").update(buf).digest("hex");

test("A2.24 preserves original game XY, door anchor, roof and exact facade alpha",()=>{
 assert.equal(source.sourceBaseline,"A2.22 original Blender Red Lion");
 assert.equal(source.sourceArtSceneSaved,false);
 assert.equal(source.originalA222BaseSha256,baseline.layers.base.sha256);
 assert.equal(source.originalA222RoofSha256,baseline.layers.roof.sha256);
 assert.notEqual(source.newBaseSha256,source.originalA222BaseSha256);
 assert.equal(source.newRoofSha256,source.originalA222RoofSha256);
 assert.equal(source.roofBinaryIdenticalToA222,true);
 assert.equal(source.gameViewZoom,ARENA_VIEW_ZOOM);
 assert.deepEqual(source.visualDoorPivotPx,[320,320]);
 assert.deepEqual(source.groundBasisPixelsPerSourceMeter,
                  geo.groundBasisPixelsPerSourceMeter);
 assert.deepEqual(source.originalFacadeAlphaBounds,[209,54,431,345]);
 assert.deepEqual(source.newFacadeAlphaBounds,source.originalFacadeAlphaBounds);
 assert.equal(source.newFacadeAlphaChannelIdentical,true);
 assert.equal(source.doorAndRoofOutlineModified,false);
 assert.equal(source.originalFacePixelColorsChanged,8135);
 assert.deepEqual(source.sourceReviewDifferenceBounds,[209,226,433,324]);
 assert.deepEqual(source.originalBaseDrawOffsetFromVisualDoorPixels,
                  source.newBaseDrawOffsetFromVisualDoorPixels);
 assert.deepEqual(source.newBaseCropPixels,source.sourceBaseCropPixels);
 assert.equal(source.losslessBaseRoundtrip,true);
 assert.equal(source.serverAuthoritativePortalOrCollisionChanged,false);
 assert.equal(source.gameRuntimeOrMultiplayerModified,false);
 assert.equal(source.originalKnightsModified,false);
 assert.equal(source.productionApproved,false);
});

test("A2.24 standalone base is distinct while roof WebP is byte-identical",()=>{
 assert.deepEqual(current.visualDoorPivotPx,baseline.visualDoorPivotPx);
 assert.deepEqual(current.originalGameGroundBasisPixelsPerMeter,
                  baseline.originalGameGroundBasisPixelsPerMeter);
 assert.equal(current.baseAlphaUnchanged,true);
 assert.equal(current.originalFacadeGroundBasisPreserved,true);
 assert.equal(current.originalRoofBinaryPreserved,true);
 assert.equal(current.productionApproved,false);
 const originals={
  base:readFileSync(new URL("a222-review/"+baseline.layers.base.file,root)),
  roof:readFileSync(new URL("a222-review/"+baseline.layers.roof.file,root))
 };
 const newer={
  base:readFileSync(new URL("a224-review/"+current.layers.base.file,root)),
  roof:readFileSync(new URL("a224-review/"+current.layers.roof.file,root))
 };
 assert.notDeepEqual(originals.base,newer.base);
 assert.deepEqual(originals.roof,newer.roof);
 for(const part of ["base","roof"]){
  const layer=current.layers[part];
  const buf=newer[part];
  assert.equal(buf.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(buf.subarray(8,12).toString("ascii"),"WEBP");
  assert.equal(buf.length,layer.bytes);
  assert.equal(sha(buf),layer.sha256);
  assert.equal(layer.roundtripExactRGBA,true);
  assert.equal(layer.flippedIntoGamePositiveYDown,true);
  assert.deepEqual(layer.drawOffsetFromVisualDoorPixels,
                   baseline.layers[part].drawOffsetFromVisualDoorPixels);
  assert.deepEqual(layer.croppedPixels,baseline.layers[part].croppedPixels);
 }
 const preview=readFileSync(new URL("a224-review/"+source.imageFiles.preview,root));
 assert.ok(preview.length>25000);
 assert.equal(preview.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(preview.readUInt32BE(16),1300);
 assert.equal(preview.readUInt32BE(20),690);
});

test("A2.24 real Chrome visual inspection confirms unchanged alpha/roof/game XY",()=>{
 assert.match(browser.browser,/^Chrome\/154\./);
 assert.equal(browser.screenshots,4);
 assert.deepEqual(browser.errors,[]);
 assert.equal(browser.originalKnightSourceHead,
  "c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(browser.originalKnightAtlasSha256.silver_idle,
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.deepEqual(browser.facadePixelComparison,{
  changedVisiblePixels:8070,
  alphaPixelDifferences:0
 });
 assert.equal(browser.roofTopLoweredPx,0);
 assert.equal(browser.roofBottomShiftPx,0);
 for(const name of ["atDoor","walk","rolling","sentinel"]){
  const s=browser[name],expected=projectArenaPoint(
   4365+s.dx,4075+s.dy,4365,4075,640,640);
  assert.equal(s.ready,true);
  assert.ok(Math.abs(expected.x-s.gamePoint[0])<.001);
  assert.ok(Math.abs(expected.y-s.gamePoint[1])<.001);
  assert.deepEqual(s.facadePixelComparison,browser.facadePixelComparison);
  assert.deepEqual(s.versions.baseline.roofAlphaBounds,[204,40,436,231]);
  assert.deepEqual(s.versions.refined.roofAlphaBounds,[204,40,436,231]);
  assert.ok(s.versions.baseline.groundXYErrorPx<.001);
  assert.equal(s.versions.baseline.groundXYErrorPx,
               s.versions.refined.groundXYErrorPx);
  assert.equal(s.knightDraw.w,s.clip==="silver_idle"?96:134);
  assert.equal(s.knightAssetsCopiedToGraphics,false);
  assert.equal(s.authoritativeDoorOrColliderValidated,false);
  assert.equal(s.dynamicRoofOcclusionValidated,false);
  assert.equal(s.multiplayerRuntimeIntegrated,false);
  assert.equal(s.originalBlenderSceneModified,false);
  assert.equal(s.productionApproved,false);
 }
 assert.equal(browser.actualAuthoritativeEntranceValidated,false);
 assert.equal(browser.roofOcclusionValidatedInActualGame,false);
 assert.equal(browser.liveMultiplayerPerformanceMeasured,false);
 assert.equal(browser.knightAtlasesCopiedIntoGraphics,false);
 assert.equal(browser.sourceBlenderSceneModified,false);
 assert.equal(browser.gameplayOrNetworkModified,false);
 assert.equal(browser.productionApproved,false);
});

test("A2.24 four real browser captures and isolated source code survive",()=>{
 for(const name of [
  "greyhaven_a224_at_door_full_roof_chrome.png",
  "greyhaven_a224_120minus80_comparison_chrome.png",
  "greyhaven_a224_roll_roof_removed_chrome.png",
  "greyhaven_a224_sentinel_80roof_chrome.png"
 ]){
  const file=new URL("a224-review/"+name,root);
  assert.ok(statSync(file).size>20000);
  const bytes=readFileSync(file);
  assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16),1500);
 }
 const viewer=readFileSync(new URL("../web/greyhaven-a224-facade-browser.mjs",import.meta.url),"utf8");
 const paint=readFileSync(new URL("../tools/art/paint_greyhaven_a224_facade.py",import.meta.url),"utf8");
 const harness=readFileSync(new URL("../tools/art/verify_greyhaven_a224_browser.mjs",import.meta.url),"utf8");
 assert.match(viewer,/projectArenaPoint/);
 assert.match(viewer,/facadePixelComparison/);
 assert.match(viewer,/__a224_knights__/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/pinnedKnight/);
 assert.match(paint,/original_alpha/);
 assert.match(paint,/newFacadeAlphaChannelIdentical/);
 assert.doesNotMatch(paint,/bpy\.ops\.wm\.save|export_scene\.gltf/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
});
