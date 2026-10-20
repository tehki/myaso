import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM} from "../src/browser/arena-viewport.mjs";
const dir=new URL("../assets/environment/greyhaven/",import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,dir),"utf8"));
const old=read("a221-review/greyhaven_a221_geometry_report.json");
const updated=read("a222-review/greyhaven_a222_geometry_report.json");
const baked=read("a222-review/greyhaven_a222_webp_report.json");
const visual=read("a222-review/greyhaven_a222_roof_comparison_report.json");

test("A2.22 compresses original Red Lion roof and gables without shifting ground XY",()=>{
 assert.equal(updated.sourceScene,old.sourceScene);
 assert.equal(updated.sourceSceneSaved,false);
 assert.equal(updated.productionApproved,false);
 assert.equal(updated.gameSourceModified,false);
 assert.equal(updated.roofOcclusionRuntimeApproved,false);
 assert.equal(updated.actualAuthoritativeDoorOrCollisionApproved,false);
 assert.equal(updated.sourceGameZoom,ARENA_VIEW_ZOOM);
 assert.deepEqual(updated.groundBasisPixelsPerSourceMeter,
  old.groundBasisPixelsPerSourceMeter);
 assert.deepEqual(updated.visualDoorAnchorPixels,[320,320]);
 assert.deepEqual(updated.proposedDoorGameXY,[4365,4075]);
 assert.equal(updated.heightLiftFactor,.85);
 assert.equal(updated.roofEaveSourceZ,3.45);
 assert.equal(updated.roofPitchCompression,.45);
 assert.equal(updated.eavePositionPreserved,true);
 assert.equal(updated.groundCoordinateInvarianceApprovedForReview,true);
 assert.equal(updated.geometry.sourceMeshObjects,17);
 assert.equal(updated.geometry.sourceVertices,4318);
 assert.equal(updated.geometry.transformedVertices,4318);
 assert.equal(updated.geometry.groundVerticesUnmoved,12);
 assert.equal(updated.geometry.maxGroundXYDrift,0);
 assert.ok(updated.geometry.roofOrGableVerticesCompressed>1500);
 assert.ok(updated.geometry.maxRoofVisualRiseReductionPx>20);
 assert.ok(updated.geometry.maxRoofVisualRiseReductionPx<30);
 assert.ok(updated.layers.base.visibleMeshCount>=12);
 assert.ok(updated.layers.roof.visibleMeshCount>=3);
});

test("A2.22 new art assets restore lossless RGBA independently and remain opt-out",()=>{
 assert.deepEqual(baked.visualDoorPivotPx,[320,320]);
 assert.deepEqual(baked.originalGameGroundBasisPixelsPerMeter,
   old.groundBasisPixelsPerSourceMeter);
 assert.equal(baked.originalGroundVerticesMovedXY,false);
 assert.equal(baked.collisionOrPortalActivated,false);
 assert.equal(baked.actualGameRenderIntegrated,false);
 assert.equal(baked.originalSceneOrKnightSourcesChanged,false);
 assert.equal(baked.productionApproved,false);
 for(const name of ["base","roof"]){
  const layer=baked.layers[name];
  const data=readFileSync(new URL("a222-review/"+layer.file,dir));
  assert.equal(data.subarray(0,4).toString(),"RIFF");
  assert.equal(data.subarray(8,12).toString(),"WEBP");
  assert.equal(data.length,layer.bytes);
  assert.equal(createHash("sha256").update(data).digest("hex"),layer.sha256);
  assert.equal(layer.roundtripExactRGBA,true);
  assert.equal(layer.flippedIntoGamePositiveYDown,true);
  assert.ok(layer.croppedPixels.every(n=>n>25&&n<640));
 }
});

test("A2.22 reviewed original roof silhouette gets shorter with fixed eaves and the same real knight",()=>{
 assert.deepEqual(visual.visualDoorAnchorPixels,[320,320]);
 assert.equal(visual.groundXYDrift,0);
 assert.deepEqual(visual.groundBasisPixelsPerSourceMeter,updated.groundBasisPixelsPerSourceMeter);
 assert.equal(visual.sourceKnightWebP,"silver_idle.webp");
 assert.equal(visual.knightSpriteSha256,
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.deepEqual(visual.knightDrawPixels,[96,96]);
 assert.equal(visual.knightSourceCopied,false);
 assert.equal(visual.sourceVerticesEditedInMemory,4318);
 assert.equal(visual.highRoofAndGableVerticesCompressed,
  updated.geometry.roofOrGableVerticesCompressed);
 assert.equal(visual.roofAlphaTopMovedDownPx,25);
 assert.equal(visual.roofAlphaBottomShiftPx,1);
 assert.equal(visual.oldRoofAlphaBounds[0],visual.newRoofAlphaBounds[0]);
 assert.equal(visual.oldRoofAlphaBounds[2],visual.newRoofAlphaBounds[2]);
 for(const name of ["actualAuthoritativeDoorOrCollision",
 "originalRedLionBlenderSceneEdited","originalApprovedKnightsEdited",
 "gameplayPhysicsOrMultiplayerChanged","roofRuntimeOcclusionApproved","productionApproved"]){
  assert.equal(visual[name],false);
 }
 const png=new URL("a222-review/"+visual.artifact,dir);
 const buf=readFileSync(png);
 assert.ok(statSync(png).size>20000);
 assert.equal(buf.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(buf.readUInt32BE(16),1300);
 assert.equal(buf.readUInt32BE(20),710);
});

test("A2.22 Blender script is review-only and guards ground invariants",()=>{
 const script=readFileSync(new URL("../tools/art/render_greyhaven_a222_roof_profile.py",
 import.meta.url),"utf8");
 const compare=readFileSync(new URL("../tools/art/compare_greyhaven_a222_roof.py",
 import.meta.url),"utf8");
 assert.match(script,/roof.pitch.compression/i);
 assert.match(script,/roofOrGableVerticesCompressed/);
 assert.match(script,/maxGroundXYDrift/);
 assert.match(script,/bpy.ops.wm.open_mainfile/);
 assert.doesNotMatch(script,/bpy.ops.wm.save_as_mainfile|export_scene.gltf/);
 assert.match(compare,/knightSpriteSha256/);
 assert.doesNotMatch(compare,/\.save\(a\.knight\)/);
});
