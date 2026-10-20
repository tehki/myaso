import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const root = new URL("../",import.meta.url);
const read = path => JSON.parse(readFileSync(new URL(path,root),"utf8"));
const buffer = path => readFileSync(new URL(path,root));
const sha = path => createHash("sha256").update(buffer(path)).digest("hex");
const handoff=read("assets/environment/greyhaven/red-lion-a225-architecture-handoff.json");
const report=read("assets/environment/greyhaven/a226-review/greyhaven_a226_weathering_report.json");
const source=read("assets/environment/greyhaven/a224-review/greyhaven_a224_webp_report.json");
const chrome=read("assets/environment/greyhaven/a224-review/greyhaven_a224_real_chrome_report.json");

test("A2.26 original base unchanged; independent clay roof is source-hash-verified",()=>{
 assert.equal(report.sourceHead,handoff.provenance.graphicsBaseCommit);
 assert.equal(report.sourceRoofSha256,handoff.rasterLayers.roof.sha256);
 assert.equal(report.sourceBaseSha256,handoff.rasterLayers.base.sha256);
 assert.equal(report.baseBinaryIdenticalToA224,true);
 assert.equal(sha(handoff.rasterLayers.base.file),report.sourceBaseSha256);
 assert.equal(sha("assets/environment/greyhaven/a226-review/red_lion_a226_base.webp"),
  report.newBaseSha256);
 assert.equal(report.newBaseSha256,report.sourceBaseSha256);
 assert.notEqual(report.newRoofSha256,report.sourceRoofSha256);
 assert.equal(sha("assets/environment/greyhaven/a226-review/red_lion_a226_roof.webp"),
  report.newRoofSha256);
 assert.equal(sha(handoff.rasterLayers.roof.file),report.sourceRoofSha256);
 assert.deepEqual(buffer("assets/environment/greyhaven/a226-review/red_lion_a226_base.webp"),
  buffer(handoff.rasterLayers.base.file));
 assert.equal(report.roofLosslessRoundtripRGBA,true);
 assert.equal(report.roofAlphaPixelDifferences,0);
 assert.deepEqual(report.roofAlphaBBoxCropPx,[3,3,235,194]);
 assert.deepEqual(report.roofDimensionsCropPx,[238,197]);
});

test("A2.26 muted roof is a bounded RGB material pass, no alpha/XY adjustment",()=>{
 assert.equal(report.roofPixelsChangedRGB,39133);
 assert.ok(report.roofMaxChannelDelta <= 20);
 assert.ok(report.roofMaxChannelDelta > 0);
 assert.ok(report.roofMeanAbsoluteChannelDelta > 1);
 assert.ok(report.roofMeanAbsoluteChannelDelta < 11);
 assert.equal(report.geometrySilhouetteOrGameXYModified,false);
 assert.deepEqual(report.groundBasisPixelsPerSourceMeter,
  handoff.projection.groundBasisPixelsPerSourceMeter);
 assert.deepEqual(report.visualDoorCanvasPx,handoff.projection.visualDoorCanvasPx);
 assert.equal(handoff.projection.cameraZoom,ARENA_VIEW_ZOOM);
 for(const part of ["base","roof"]){
  const expected=handoff.rasterLayers[part];
  const actual=report.layers[part];
  assert.deepEqual(actual.drawOffsetFromVisualDoorPixels,expected.drawOffsetFromVisualDoorPixels);
  assert.deepEqual(actual.croppedPixels,expected.croppedPixels);
  assert.equal(actual.sha256,sha("assets/environment/greyhaven/a226-review/"+actual.file));
 }
 const door=handoff.proposedWorldPlacement.door;
 const p=projectArenaPoint(door.x+120,door.y-80,door.x,door.y,640,640);
 assert.deepEqual([p.x,p.y],[420.8,252.8]);
 assert.equal(chrome.actualAuthoritativeEntranceValidated,false);
});

test("A2.26 reviewed PNG is an original art-only before/after with no authority claims",()=>{
 const path="assets/environment/greyhaven/a226-review/"+report.preview;
 const bytes=buffer(path);
 assert.ok(statSync(new URL(path,root)).size>30000);
 assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(bytes.readUInt32BE(16),1300);
 assert.equal(bytes.readUInt32BE(20),690);
 assert.equal(report.originalBlenderOrKnightSourcesModified,false);
 assert.equal(report.automaticRoofOcclusionImplemented,false);
 assert.equal(report.gameRuntimeOrNetworkModified,false);
 assert.equal(report.serverAuthoritativePortalOrCollisionChanged,false);
 assert.equal(report.productionApproved,false);
 const shader=buffer("tools/art/paint_greyhaven_a226_roof.py").toString("utf8");
 assert.match(shader,/ImageChops\.difference\(result\.getchannel\("A"\), original_alpha\)/);
 assert.match(shader,/source\("roof"\)/);
 assert.match(shader,/source\("base"\)/);
 assert.doesNotMatch(shader,/bpy\.ops\.wm\.save|export_scene\.gltf|WebSocket/);
});
