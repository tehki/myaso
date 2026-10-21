import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const root=new URL("../",import.meta.url);
const a="assets/environment/greyhaven/";
const buf=name=>readFileSync(new URL(name,root));
const j=name=>JSON.parse(buf(name).toString("utf8"));
const sha=name=>createHash("sha256").update(buf(name)).digest("hex");
const doc=j(a+"a228-review/greyhaven_a228_facade_report.json");
const browser=j(a+"a228-review/greyhaven_a228_native_browser_report.json");
const handoff=j(a+"red-lion-a225-architecture-handoff.json");
const roof=j(a+"a226-review/greyhaven_a226_weathering_report.json");
const paths=["day","dusk"];

test("A2.28 facade has source provenance and byte-identical historical roof",()=>{
 assert.equal(doc.sourceFacadeSha256,handoff.rasterLayers.base.sha256);
 assert.equal(doc.sourceFacadeSha256,sha(handoff.rasterLayers.base.file));
 assert.equal(doc.sourceRoofSha256,roof.newRoofSha256);
 assert.equal(doc.newRoofSha256,doc.sourceRoofSha256);
 assert.equal(doc.roofBinaryIdenticalToA226,true);
 assert.equal(sha(a+"a228-review/red_lion_a228_roof.webp"),doc.newRoofSha256);
 assert.deepEqual(buf(a+"a228-review/red_lion_a228_roof.webp"),
  buf(a+"a226-review/red_lion_a226_roof.webp"));
 assert.deepEqual(doc.visualDoorCanvasPx,[320,320]);
 assert.deepEqual(doc.originalFacadeAlphaBoundsCanvasPx,[209,54,431,345]);
 assert.deepEqual(doc.sourceGroundBasisPixelsPerSourceMeter,
  handoff.projection.groundBasisPixelsPerSourceMeter);
 assert.equal(doc["3cAtmosphereLightingEngineImplemented"],false);
 assert.equal(doc.worldCollisionPortalOrNetworkModified,false);
 assert.equal(doc.gameRendererIntegrated,false);
 assert.equal(doc.productionApproved,false);
});

test("A2.28 source-derived facade/day/dusk rasters are bounded, lossless and alpha invariant",()=>{
 for(const name of paths){
  const v=doc.variants[name];
  assert.ok(v.changedVisibleRGBPixels>4000);
  assert.equal(v.baseAlphaIdentical,true);
  assert.equal(v.losslessRoundtrip,true);
  assert.deepEqual(v.croppedPixels,[228,297]);
  assert.deepEqual(v.drawOffsetFromVisualDoorPixels,[-114,-269]);
  assert.equal(v.sha256,sha(a+"a228-review/"+v.file));
  assert.ok(v.bytes<65536);
 }
 assert.notEqual(doc.variants.day.sha256,doc.variants.dusk.sha256);
 const totalKB=(doc.variants.day.bytes+doc.variants.dusk.bytes)/1024;
 assert.ok(totalKB<100);
 const painter=buf("tools/art/paint_greyhaven_a228_facade.py").toString("utf8");
 assert.match(painter,/stone foundation/);
 assert.match(painter,/window and threshold warm spill|window and doorway warm light spill|Warm interior apertures/);
 assert.match(painter,/roof.*byte-identical/i);
 assert.doesNotMatch(painter,/bpy\.ops\.wm\.save|export_scene\.gltf/);
});

test("A2.28 real Chrome and Firefox browser QA measures exact source art with independently pinned Knight",()=>{
 assert.equal(browser.results.length,2);
 assert.equal(browser.authenticKnightHead,"c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(browser.originalKnightIdleSha256,
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.equal(browser.actualProjectionModule,"src/browser/arena-viewport.mjs");
 assert.equal(ARENA_VIEW_ZOOM,0.84);
 for(const engine of ["chrome","firefox"]){
  const b=browser.results.find(x=>x.browser===engine);
  assert.ok(b);
  assert.equal(b.screenshots,2);
  assert.deepEqual(b.errors,[]);
  assert.match(b.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\//);
  for(const [kind,dx,dy] of [["entrance",0,0],["east",80,-10]]){
   const state=b[kind];
   assert.equal(state.ready,true);
   assert.equal(state.dx,dx);assert.equal(state.dy,dy);
   assert.equal(state.sourceKnightHead,browser.authenticKnightHead);
   const p=projectArenaPoint(4365+dx,4075+dy,4365,4075,640,640);
   assert.ok(Math.abs(state.gameXY[0]-p.x)<.001);
   assert.ok(Math.abs(state.gameXY[1]-p.y)<.001);
   assert.ok(state.gameXYErrorPx<.001);
   assert.equal(state.sourceToDay.alphaPixelDifferences,0);
   assert.equal(state.sourceToDusk.alphaPixelDifferences,0);
   assert.ok(state.sourceToDay.changedCanvasPixels>20000);
   assert.ok(state.sourceToDusk.changedCanvasPixels>20000);
   assert.equal(state.roofBinaryIdentical,true);
   assert.equal(state.authoritativePortalValidated,false);
   assert.equal(state.dynamicRoofOcclusionValidated,false);
   assert.equal(state.networkGameplayModified,false);
   assert.equal(state.productionApproved,false);
   for(const ms of Object.values(state.frameRenderSamplesMs)){
    assert.ok(ms>=0&&ms<1000);
   }
   const image=buf(a+"a228-review/greyhaven_a228_"+engine+"_"+(kind==="east"?"east80":"entrance")+".png");
   assert.ok(image.length>60000);
   assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(image.readUInt32BE(16),2010);
  }
 }
 assert.equal(browser.originalRoofModified,false);
 assert.equal(browser.sourceBlenderModified,false);
 assert.equal(browser.gameRuntimeModified,false);
 assert.equal(browser.playerCombatReadabilityValidated,false);
 assert.equal(browser.measuredFrameTimesNotLiveGame,true);
 assert.equal(browser.productionApproved,false);
});

test("A2.28 assets have a reproducible separate-browser authoring boundary",()=>{
 const viewer=buf("web/greyhaven-a228-facade-browser.mjs").toString("utf8");
 const browserQA=buf("tools/art/verify_greyhaven_a228_browser.mjs").toString("utf8");
 assert.match(viewer,/projectArenaPoint/);
 assert.match(viewer,/__a228_knights__/);
 assert.match(viewer,/performance\.now\(\)/);
 assert.match(browserQA,/127\.0\.0\.1/);
 assert.match(browserQA,/webDriverBiDi/);
 assert.match(browserQA,/knightHead/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
 assert.ok(statSync(new URL(a+"a228-review/"+doc.preview,root)).size>20000);
});
