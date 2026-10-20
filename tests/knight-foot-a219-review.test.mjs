import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS,
 knightPresentationRect} from "../web/knight-sprites.mjs";

const root=new URL("../web/assets/knights/",import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),"utf8"));
const configs={
 silver_roll:{model:"silver-knight",mesh:"geometry_0",
  atStart:[-.67101,-.93763,-.86512,-.73438],
  atMid:[.45906,.61344,.73784,.43275]},
 t1_roll:{model:"t1-sentinel",mesh:"material",
  atStart:[-.99687,-.99582,-.99716,-.99969],
  atMid:[.9355,.92165,.97048,.93703]}
};

test("A2.19 original A3 evaluated candidate surface normals rotate but are not sole contact",()=>{
 assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
 assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
 assert.deepEqual(knightPresentationRect(true),{x:-67,y:-78,width:134,height:134});
 for(const [clip,expected] of Object.entries(configs)){
  const data=read("a219-review/"+clip+"_a219_normals.json");
  const basis=read("a218-review/"+clip+"_a218_landmarks.json");
  assert.equal(data.clip,clip);
  assert.match(data.blender,/4\.5\.14/);
  assert.equal(data.sourceGLBBasename,expected.model+"-roll-A3.glb");
  assert.equal(data.sourceGLBSHA256,basis.sourceGLBSHA256);
  assert.equal(data.sourceMeshName,expected.mesh);
  assert.deepEqual(data.originalSourceFrame60fps,[1,7,22]);
  assert.deepEqual(data.reviewViews,["front","side","low"]);
  assert.equal(data.workbenchRenderingOnly,true);
  assert.equal(data.renderedImages,9);
  assert.equal(data.markerSphereRadiusSourceModelUnits,.033);
  assert.equal(data.records.length,3);
  for(const [i,frame] of [1,7,22].entries()){
   const row=data.records[i];
   assert.equal(row.sourceFrame60fps,frame);
   assert.equal(row.originalEvaluatedSourceVertices.length,4);
   const normals=row.originalEvaluatedSourceVertices.map(v=>v.worldNormalDotZ);
   assert.deepEqual(normals,i===1?expected.atMid:expected.atStart);
   assert.ok(normals.every(n=>i===1?n>.4:n<-.6));
   for(const item of row.originalEvaluatedSourceVertices){
    assert.equal(item.sourceVertexIndex,
      basis.landmarkSelection[item.side][item.candidate].vertexIndex);
    assert.equal(item.normalIsNotSoleProof,true);
    assert.equal(item.evaluatedWorldXYZ.length,3);
    assert.equal(item.evaluatedWorldNormalXYZ.length,3);
    const [x,y,z]=item.evaluatedWorldNormalXYZ;
    assert.ok(Math.abs(x*x+y*y+z*z-1)<.001);
    assert.equal(z,item.worldNormalDotZ);
   }
  }
  assert.equal(data.landmarksAreHeuristicFootRegionsNotConfirmedOutsoles,true);
  assert.equal(data.worldNormalDotZIsNotGameFloorContact,true);
  assert.equal(data.authoritativeGameFloorUnknown,true);
  assert.equal(data.anatomicalHeelOrOutsoleVerified,false);
  assert.equal(data.originalGLBOrAtlasModified,false);
  assert.equal(data.originalA3TimingModified,false);
  assert.equal(data.knightPresentation120PercentUnchanged,true);
  assert.equal(data.gameplayOrNetworkingModified,false);
  assert.equal(data.productionApproved,false);
 }
});

test("A2.19 original model review sheets are real Blender outputs, not regenerated gameplay sprites",()=>{
 for(const clip of Object.keys(configs)){
  const qa=read("a219-review/"+clip+"_a219_sheet_report.json");
  const measurements=read("a219-review/"+clip+"_a219_normals.json");
  assert.equal(qa.clip,clip);
  assert.equal(qa.sourceSHA256,measurements.sourceGLBSHA256);
  assert.deepEqual(qa.sourceFrame60fps,[1,7,22]);
  assert.deepEqual(qa.views,["front","side","low"]);
  assert.equal(qa.imagesComposited,9);
  assert.equal(qa.sourceRenderInputs.length,9);
  assert.deepEqual(qa.reviewSheetPixels,[2032,1687]);
  assert.ok(qa.sourceRenderInputs.every(i=>i.bytes>50000));
  assert.equal(qa.originalModelOrGameSpritesAltered,false);
  assert.equal(qa.anatomicalSoleApprovalGranted,false);
  assert.equal(qa.groundPlaneVerified,false);
  assert.equal(qa.gameplayContactMeasured,false);
  assert.equal(qa.productionApproved,false);
  const file=new URL("a219-review/"+clip+"_a219_review_sheet.png",root);
  assert.ok(statSync(file).size>60000);
  const image=readFileSync(file);
  assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(image.readUInt32BE(16),2032);
  assert.equal(image.readUInt32BE(20),1687);
 }
});

test("A2.19 original-source inspection only exports separate review PNG/JSON, no source edits",()=>{
 const src=readFileSync(new URL("../tools/art/inspect_knight_a219_source_landmarks.py",import.meta.url),"utf8");
 const assemble=readFileSync(new URL("../tools/art/assemble_knight_a219_review.py",import.meta.url),"utf8");
 assert.match(src,/read_factory_settings/);
 assert.match(src,/source_sha=hashlib\.sha256/);
 assert.match(src,/normal_transform=mat\.to_3x3\(\)\.inverted\(\)\.transposed\(\)/);
 assert.match(src,/BLENDER_WORKBENCH/);
 assert.match(src,/originalGLBOrAtlasModified/);
 assert.doesNotMatch(src,/save_as_mainfile|export_scene\.gltf|bmesh\.ops\.remove_doubles/);
 assert.match(assemble,/SOURCE LOCAL Z normals/);
 assert.doesNotMatch(assemble,/\.save\(.*webp/);
});
