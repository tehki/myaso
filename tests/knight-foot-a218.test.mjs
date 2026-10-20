import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS,
  knightPresentationRect} from "../web/knight-sprites.mjs";

const dir=new URL("../web/assets/knights/",import.meta.url);
const read=(path)=>JSON.parse(readFileSync(new URL(path,dir),"utf8"));
const expected={
  silver_roll:{
    source:"silver-knight",
    mesh:"geometry_0",
    vertices:105847,
    weighted:{LeftFoot:3318,RightFoot:3390},
    selected:{LeftFoot:{heelSide:71894,toeSide:71908},
              RightFoot:{heelSide:22498,toeSide:22501}}
  },
  t1_roll:{
    source:"t1-sentinel",
    mesh:"material",
    vertices:101687,
    weighted:{LeftFoot:8508,RightFoot:8245},
    selected:{LeftFoot:{heelSide:6073,toeSide:192},
              RightFoot:{heelSide:21619,toeSide:14705}}
  }
};
test("A2.18 fixed source-vertex candidate IDs remain stable across 8 original A3 poses",()=>{
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  assert.deepEqual(knightPresentationRect(true),{x:-67,y:-78,width:134,height:134});
  for(const [clip,x] of Object.entries(expected)){
    const r=read("a218-review/"+clip+"_a218_landmarks.json");
    const prev=read("a217-review/"+clip+"_a217_seams.json");
    assert.match(r.blender,/4\.5\.14/);
    assert.equal(r.clip,clip);
    assert.equal(r.sourceGLBBasename,x.source+"-roll-A3.glb");
    assert.equal(r.sourceGLBSHA256,prev.sourceGLBSHA256);
    assert.equal(r.meshName,x.mesh);
    assert.equal(r.sourceMeshVertexCount,x.vertices);
    assert.deepEqual(r.sourceFrames60fps,[1,3,5,7,9,11,15,22]);
    assert.deepEqual(r.spriteSourceCanvasPx,[160,160]);
    assert.deepEqual(r.approved120RollDrawRectPx,[-67,-78,134,134]);
    assert.equal(r.skinningThreshold,.35);
    assert.equal(r.phaseLandmarks.length,8);
    assert.equal(r.directionalLandmarks.length,64);
    for(const side of ["LeftFoot","RightFoot"]){
      assert.equal(r.landmarkSelection[side].totalWeightedVertices,x.weighted[side]);
      const ids=Object.fromEntries(["heelSide","toeSide"].map(kind=>
        [kind,r.landmarkSelection[side][kind].vertexIndex]));
      assert.deepEqual(ids,x.selected[side]);
      assert.notEqual(ids.heelSide,ids.toeSide);
      assert.ok(r.landmarkSelection[side].frame1LongitudinalQuartiles[0]
        <r.landmarkSelection[side].frame1LongitudinalQuartiles[1]);
      assert.equal(r.landmarkSelection[side].frame1AnkleToToeXYUnitAxis.length,2);
      for(const pose of r.phaseLandmarks){
        for(const kind of ["heelSide","toeSide"]){
          const actual=pose.feet[side][kind];
          assert.equal(actual.vertexIndex,ids[kind]);
          assert.equal(actual.worldXYZ.length,3);
          assert.ok(actual.worldXYZ.every(Number.isFinite));
        }
      }
    }
    for(let i=0;i<64;i++){
      const sample=r.directionalLandmarks[i];
      assert.equal(sample.direction,Math.floor(i/8));
      assert.equal(sample.column,i%8);
      assert.equal(sample.sourceFrame60fps,r.sourceFrames60fps[i%8]);
      for(const side of ["LeftFoot","RightFoot"]){
        for(const kind of ["heelSide","toeSide"]){
          const pt=sample.feet[side][kind];
          assert.equal(pt.vertexIndex,x.selected[side][kind]);
          const [sx,sy]=pt.projection.sourceAtlasPx;
          const [dx,dy]=pt.projection.approved120DrawOffsetPx;
          assert.ok([sx,sy,dx,dy].every(Number.isFinite));
          assert.ok(Math.abs(dx-(-67+sx*134/160))<.001);
          assert.ok(Math.abs(dy-(-78+sy*134/160))<.001);
        }
      }
    }
    assert.equal(r.anatomicalHeelOrOutsoleVerified,false);
    assert.equal(r.candidateGeometricBandsMayContainArmor,true);
    assert.equal(r.environmentGroundHeightKnown,false);
    assert.equal(r.rigContactWithGroundVerified,false);
    assert.equal(r.sourceModelModified,false);
    assert.equal(r.atlasModified,false);
    assert.equal(r.combatOrNetworkChanged,false);
    assert.equal(r.productionApproved,false);
  }
});
test("A2.18 independent original atlas annotations retain non-contact provenance",()=>{
  for(const [clip,x] of Object.entries(expected)){
    const qa=read("a218-review/"+clip+"_a218_overlay_report.json");
    const r=read("a218-review/"+clip+"_a218_landmarks.json");
    assert.equal(qa.clip,clip);
    assert.equal(qa.originalGLBSHA256,r.sourceGLBSHA256);
    assert.equal(qa.atlasName,clip+".webp");
    assert.deepEqual(qa.reviewDirections,[0,6]);
    assert.equal(qa.eightFramesPerDirection,8);
    assert.equal(qa.candidateMarkers,64);
    assert.equal(qa.insideImageFrame,64);
    assert.equal(qa.markersNearOpaqueAtlasPixelsWithin3px,64);
    assert.equal(qa.samples.length,64);
    assert.equal(qa.sourceWebPModified,false);
    assert.equal(qa.anatomicalOutsoleVerified,false);
    assert.equal(qa.worldFloorOrPlayerPivotVerified,false);
    assert.equal(qa.productionApproved,false);
    const path=new URL("a218-review/"+clip+"_a218_overlay.png",dir);
    assert.ok(statSync(path).size>30000);
    const bytes=readFileSync(path);
    assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16),1488);
    assert.equal(bytes.readUInt32BE(20),502);
  }
});
test("A2.18 landmark and overlay tools cannot weld, export or change source GLBs",()=>{
  const blender=readFileSync(new URL("../tools/art/measure_knight_a218_landmarks.py",
                                    import.meta.url),"utf8");
  const overlay=readFileSync(new URL("../tools/art/review_knight_a218_landmarks.py",
                                    import.meta.url),"utf8");
  assert.match(blender,/Foot.*ToeBase|Foot.*replace/);
  assert.match(blender,/vertexIndex/);
  assert.match(blender,/anatomicalHeelOrOutsoleVerified/);
  assert.match(blender,/scene\.render\.fps=60/);
  assert.match(overlay,/candidateMarkers/);
  assert.match(overlay,/anatomicalOutsoleVerified/);
  assert.doesNotMatch(blender,/save_as_mainfile|export_scene\.gltf|bmesh\.ops\.remove_doubles/);
  assert.doesNotMatch(overlay,/\.save\(a\.atlas\)/);
});
