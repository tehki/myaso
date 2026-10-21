import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,knightPresentationRect,
        KNIGHT_ROLL_PRESENTATION_MS} from "../web/knight-sprites.mjs";

const root=new URL("../web/assets/knights/a213-review/",import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root),"utf8"));
const hashes={
  silver_roll:"e4a263d480896fb1069ffc81e913e9aaa7324ff344611f5b69829cfee25c5d94",
  t1_roll:"b89432a621d1f0956b7c06449035e0a055d11b17d6ceb34c9b26264eadcb6aed"
};
const expected={
  silver_roll:{mesh:"geometry_0",vertices:105847,selected:[3318,3390],
    floor:-.51224,frame7:[.00584,.01237]},
  t1_roll:{mesh:"material",vertices:101687,selected:[8508,8245],
    floor:-.0315,frame7:[.28457,.37522]}
};
test("A2.13 original A3 evaluated foot weighted vertices have reliable source provenance",()=>{
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  assert.deepEqual(knightPresentationRect(true),{x:-67,y:-78,width:134,height:134});
  for(const clip of Object.keys(hashes)){
    const r=read(clip+"_a213_skinned_foot_report.json");
    const e=expected[clip];
    assert.equal(r.clip,clip);
    assert.match(r.blender,/4\.5\.14/);
    assert.equal(r.sourceGLBSHA256,hashes[clip]);
    assert.equal(r.sourceGLBBasename,clip==="silver_roll"?
      "silver-knight-roll-A3.glb":"t1-sentinel-roll-A3.glb");
    assert.equal(r.originalBakeCameraScale,1.66);
    assert.deepEqual(r.canvas,[160,160]);
    assert.equal(r.directions,8);
    assert.deepEqual(r.sourceFrames60fps,[1,3,5,7,9,11,15,22]);
    assert.equal(r.skinningWeightThreshold,.35);
    assert.deepEqual(r.selectedBones,["LeftFoot","LeftToeBase","RightFoot","RightToeBase"]);
    assert.equal(r.observations.length,64);
    assert.equal(r.sourcePhaseGeometry.length,8);
    assert.equal(r.meshSelection.length,1);
    assert.equal(r.meshSelection[0].meshName,e.mesh);
    assert.equal(r.meshSelection[0].baseVertices,e.vertices);
    assert.deepEqual([r.meshSelection[0].leftWeightedVertexCount,
      r.meshSelection[0].rightWeightedVertexCount],e.selected);
    assert.equal(r.referenceFloorProxyWorldZ,e.floor);
    assert.equal(r.floorReference,"MIN_OF_FRAME_1_SKIN_WEIGHTED_FOOT_VERTICES_ONLY");
    assert.equal(r.authoritativeFloorZKnown,false);
    assert.equal(r.shoeSoleMaterialOrPartIsolated,false);
    assert.equal(r.groundCollisionContactValidated,false);
    assert.equal(r.footMeshRegionsAreNotShoeSoles,true);
    assert.equal(r.a3PresentationScale,1.2);
    assert.equal(r.originalSourceAssetsModified,false);
    assert.equal(r.spriteOffsetChanged,false);
    assert.equal(r.gameplayPhysicsOrNetworkChanged,false);
    assert.equal(r.productionApproved,false);
    const frame7=r.sourcePhaseGeometry.find(p=>p.frame60fps===7);
    assert.deepEqual([
      frame7.meshFeet.LeftFoot.minimumWorldZ,
      frame7.meshFeet.RightFoot.minimumWorldZ
    ],e.frame7);
  }
});

test("A2.13 mesh minimum projection maps to exact unchanged 120% visual roll rectangle",()=>{
  for(const clip of Object.keys(hashes)){
    const r=read(clip+"_a213_skinned_foot_report.json");
    for(let i=0;i<r.observations.length;i++){
      const o=r.observations[i];
      assert.equal(o.direction,Math.floor(i/8));
      assert.equal(o.atlasColumn,i%8);
      assert.equal(o.sourceFrame60fps,r.sourceFrames60fps[i%8]);
      for(const side of ["LeftFoot","RightFoot"]){
        const f=o.feet[side];
        assert.equal(f.selectedVertexCount,
          expected[clip].selected[side==="LeftFoot"?0:1]);
        assert.equal(f.sourceMesh,expected[clip].mesh);
        assert.ok(f.minimumWorldZ<=f.p10WorldZ);
        assert.ok(f.minimumVertexWorldXYZ.every(Number.isFinite));
        assert.ok(f.relativeClearanceFromFrame1FootMinMeters > -1);
        assert.ok(f.relativeClearanceFromFrame1FootMinMeters < 1);
        const px=f.lowestSkinWeightedVertexProjection.sourceFramePx;
        const dst=f.lowestSkinWeightedVertexProjection.approved120PresentationOffsetPx;
        assert.equal(px.length,2);
        assert.equal(dst.length,2);
        assert.ok(px.every(Number.isFinite));
        assert.ok(dst.every(Number.isFinite));
        assert.ok(Math.abs(dst[0]-(-67+px[0]*134/160))<.001);
        assert.ok(Math.abs(dst[1]-(-78+px[1]*134/160))<.001);
      }
    }
    // World geometry is camera-independent; only the projected screen point
    // may change when rotating between the 8 original sprite directions.
    for(let i=0;i<8;i++){
      const a=r.observations[i],b=r.observations[48+i];
      for(const side of ["LeftFoot","RightFoot"]){
        assert.deepEqual(a.feet[side].minimumVertexWorldXYZ,
          b.feet[side].minimumVertexWorldXYZ);
        assert.equal(a.feet[side].minimumWorldZ,b.feet[side].minimumWorldZ);
      }
    }
  }
});
test("A2.13 separate atlas annotations prove source foot-mesh proximity only, not real floor",()=>{
  for(const clip of Object.keys(hashes)){
    const q=read(clip+"_a213_overlay_report.json");
    assert.equal(q.glbSHA256,hashes[clip]);
    assert.equal(q.atlasFilename,clip+".webp");
    assert.equal(q.spriteAtlasUnmodified,true);
    assert.deepEqual(q.reviewDirections,[0,6]);
    assert.equal(q.framesEachDirection,8);
    assert.equal(q.footVertexSampleCount,32);
    assert.equal(q.meshLowestVertexNearOpaqueCount,32);
    assert.equal(q.samples.length,32);
    assert.equal(q.boneTailIsNotSole,true);
    assert.equal(q.weightedMeshLowestIsNotProvenBootSole,true);
    assert.equal(q.floorReferenceIsNotAuthoritative,true);
    assert.equal(q.gamePivotOrPhysicsModified,false);
    assert.equal(q.productionApproved,false);
    assert.ok(q.samples.every(s=>s.meshMinimumNearOpaque3px===true));
    const png=new URL(clip+"_a213_skinned_foot_overlay.png",root);
    assert.ok(statSync(png).size>10000);
    const bytes=readFileSync(png);
    assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16),1488);
    assert.equal(bytes.readUInt32BE(20),480);
  }
});
test("A2.13 Blender analysis does not save source GLB/Blender or modify render/game",()=>{
  const analyzer=readFileSync(
    new URL("../tools/art/measure_knight_a213_skinned_foot_geometry.py",import.meta.url),"utf8");
  const overlay=readFileSync(
    new URL("../tools/art/review_knight_a213_mesh_contacts.py",import.meta.url),"utf8");
  assert.match(analyzer,/scene\.render\.fps=60/);
  assert.match(analyzer,/evaluated\.to_mesh\(\)/);
  assert.match(analyzer,/evaluated\.to_mesh_clear\(\)/);
  assert.match(analyzer,/footMeshRegionsAreNotShoeSoles/);
  assert.match(analyzer,/authoritativeFloorZKnown/);
  assert.match(overlay,/weightedMeshLowestIsNotProvenBootSole/);
  assert.doesNotMatch(analyzer,/save_as_mainfile|export_scene\.gltf|bpy\.ops\.render\.render/);
  assert.doesNotMatch(overlay,/\.save\(a\.atlas\)/);
});
