import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const root=new URL("../",import.meta.url);
const base="assets/environment/greyhaven/";
const data=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(data(p).toString("utf8"));
const sha=p=>createHash("sha256").update(data(p)).digest("hex");
const src=json(base+"a230-review/greyhaven_a230_geometry_proof.json");
const original=json(base+"a230-review/greyhaven_a230_original_source_integrity.json");
const refined=json(base+"a230-review/greyhaven_a230_material_validation.json");
const chrome=json(base+"a230-review/greyhaven_a230_browser_report.json");
const old=json(base+"a226-review/greyhaven_a226_weathering_report.json");
const handoff=json(base+"red-lion-a225-architecture-handoff.json");

test("A2.30 authored Blender derived file preserves 17 originals/4318 vertices exactly",()=>{
 assert.equal(src.sourceMeshObjects,17);
 assert.equal(src.sourceVertices,4318);
 assert.equal(src.originalSceneUntouched,true);
 assert.equal(src.newMeshes,35);
 assert.equal(src.derivedBlenderScene,"blood_iron_red_lion_a230_joinery.blend");
 const asset=base+"a22-review/"+src.originalScene;
 assert.equal(sha(asset),src.originalSceneSha256);
 assert.equal(sha(base+"a230-review/"+src.derivedBlenderScene),src.derivedBlenderSha256);
 // Compressed Blender 5.2 scene uses Zstandard magic, not bare BLENDER bytes.
 // Independently reopened and verified with bpy by verify_red_lion_a230_source.py.
 assert.equal(data(base+"a230-review/"+src.derivedBlenderScene).subarray(0,4).toString("hex"),"28b52ffd");
 assert.equal(original.allOriginalMeshCoordinatesAndMaterialsUnchanged,true);
 assert.equal(original.sourceMeshSignatures && Object.keys(original.sourceMeshSignatures).length,17);
 assert.equal(original.originalRoofMeshUnchanged,true);
 assert.equal(original.extraMeshCount,35);
 assert.equal(new Set(original.extraNames).size,35);
 assert.equal(src.roofGeometryEdited,false);
 assert.equal(src.roofTextureEdited,false);
 assert.equal(src.serverCollisionOrDoorChanged,false);
 assert.equal(src.gameRuntimeChanged,false);
 assert.equal(src.productionApproved,false);
});

test("A2.30 exact XY source-basis and original roof bytes remain unchanged",()=>{
 assert.deepEqual(src.sourceVisualDoorCanvasPx,[320,320]);
 assert.equal(src.cameraZoom,0.84);
 assert.equal(src.metersPerWorldUnit,0.025);
 assert.equal(ARENA_VIEW_ZOOM,src.cameraZoom);
 assert.deepEqual(src.groundBasisPxPerSourceMeter,{x:[33.6,0],y:[0,33.6]});
 assert.deepEqual(refined.sourceDoorPivotPx,[320,320]);
 assert.deepEqual(refined.doorXY,[4365,4075]);
 assert.equal(handoff.proposedWorldPlacement.door.x,4365);
 assert.equal(handoff.proposedWorldPlacement.door.y,4075);
 assert.equal(refined.roofWebp.copiedByteIdentical,true);
 assert.equal(refined.roofWebp.sha256,old.newRoofSha256);
 assert.equal(sha(base+"a230-review/"+refined.roofWebp.file),old.newRoofSha256);
 assert.deepEqual(data(base+"a230-review/"+refined.roofWebp.file),
  data(base+"a226-review/red_lion_a226_roof.webp"));
 const p=projectArenaPoint(4445,4065,4365,4075,640,640);
 assert.deepEqual([p.x,p.y],[387.2,311.6]);
});

test("A2.30 Cycles before/after source results and lossless WebPs are pinned",()=>{
 assert.equal(refined.newMeshCount,35);
 assert.equal(refined.sourceMeshCount,17);
 assert.equal(refined.originalSourceVertices,4318);
 assert.equal(refined.sourceBlendSha256,src.originalSceneSha256);
 assert.equal(refined.derivedBlendSha256,src.derivedBlenderSha256);
 assert.equal(refined.newGeometryArtOnly,true);
 assert.equal(refined.actualGameRenderIntegration,false);
 assert.equal(refined.productionApproved,false);
 for(const stage of ["baseline","dimensional"]){
  const v=src.renderProof[stage];
  const path=base+"a230-review/"+v.file;
  assert.equal(sha(path),v.sha256);
  assert.ok(v.bytes>100000);
 }
 assert.equal(refined.changedRGBAVisiblePixels,15192);
 assert.equal(refined.alphaPixelsChanged,69);
 assert.equal(refined.newOutsideOldAlphaPixels,51);
 assert.deepEqual(refined.beforeAlphaBounds,refined.afterAlphaBounds);
 assert.deepEqual(refined.afterAlphaBounds,[209,54,431,345]);
 for(const entry of ["baselineWebp","baseWebp"]){
  const item=refined[entry];
  const path=base+"a230-review/"+item.file;
  assert.equal(sha(path),item.sha256);
  assert.equal(item.losslessRoundtrip,true);
  assert.ok(item.bytes<65536);
 }
 assert.deepEqual(refined.baseWebp.crop,[228,297]);
 assert.deepEqual(refined.baseWebp.drawOffsetFromDoorPixels,[-114,-269]);
 const png=data(base+"a230-review/"+refined.comparison);
 assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(png.readUInt32BE(16),1300);
 assert.equal(png.readUInt32BE(20),690);
 assert.ok(png.length>25000);
});

test("A2.30 native Chrome and Firefox show pinned real Knight and dimensional art",()=>{
 assert.equal(chrome.nativeBrowsers.length,2);
 assert.equal(chrome.authenticKnightHead,"c74fcf90e227f3bc4788728f000cfe6aa083c7ef");
 assert.equal(chrome.originalKnightSha256,"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 for(const mode of ["chrome","firefox"]){
  const b=chrome.nativeBrowsers.find(x=>x.engine===mode);
  assert.ok(b);
  assert.match(b.version,mode==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(b.errors,[]);
  assert.equal(b.screenCaptures,2);
  for(const [scenario,dx,dy] of [["door",0,0],["street",80,-10]]){
   const item=b.observations.find(x=>x.screenshot.includes("_"+scenario+".png"));
   assert.ok(item);
   const state=item.state;
   assert.equal(state.ready,true);
   assert.deepEqual([state.dx,state.dy],[dx,dy]);
   assert.equal(state.originalBlenderSourceIntegrity,true);
   assert.equal(state.newSourceMeshes,35);
   assert.equal(state.roofUnchanged,true);
   assert.equal(state.originalKnightSha256,chrome.originalKnightSha256);
   assert.ok(state.changedOnScreenRGBPixels>1000);
   assert.equal(state.onScreenAlphaDifferences,0);
   assert.ok(state.gameXYErrorPx<0.001);
   assert.equal(state.actualGameRendererValidated,false);
   assert.equal(state.automaticOcclusionValidated,false);
   assert.equal(state.authoritativePortalValidated,false);
   assert.equal(state.productionApproved,false);
   const png=data(base+"a230-review/"+item.screenshot);
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(png.readUInt32BE(16),1460);
   assert.ok(png.length>100000);
  }
 }
 for(const k of ["dynamicRoofOcclusionValidated","gameRuntimeIntegrated","productionApproved"])
  assert.equal(chrome[k],false);
 const html=data("web/greyhaven-a230-dimensional-browser.html").toString("utf8");
 const harness=data("tools/art/verify_greyhaven_a230_browser.mjs").toString("utf8");
 assert.match(html,/art-only 2\.5D preview/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/webDriverBiDi/);
 assert.match(harness,/knight/);
 assert.doesNotMatch(harness,/productionApproved:true/);
});
