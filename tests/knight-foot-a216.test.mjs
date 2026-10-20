import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS}
  from "../web/knight-sprites.mjs";

const dataRoot=new URL("../web/assets/knights/a216-review/",import.meta.url);
const priorRoot=new URL("../web/assets/knights/a215-review/",import.meta.url);
const fixtures={
  silver_roll:{
    original:"silver-knight",mesh:"geometry_0",vertices:105847,
    edges:195064,polys:98787,components:9658,footComponents:673,
    leftCount:3318,rightCount:3390,leftComponents:343,rightComponents:340,
    leftLargest:88,rightLargest:93,largestComponent:550
  },
  t1_roll:{
    original:"t1-sentinel",mesh:"material",vertices:101687,
    edges:249720,polys:149880,components:2057,footComponents:348,
    leftCount:8508,rightCount:8245,leftComponents:174,rightComponents:174,
    leftLargest:357,rightLargest:310,largestComponent:921
  }
};

test("A2.16 imported GLB vertex-index topology is fragmented and not a boot sole",()=>{
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  for(const [clip,x] of Object.entries(fixtures)){
    const r=JSON.parse(readFileSync(new URL(clip+"_a216_topology.json",dataRoot),"utf8"));
    const previous=JSON.parse(readFileSync(new URL(
      x.original+"-a215-provenance.json",priorRoot),"utf8"));
    assert.equal(r.sourceGLBBasename,x.original+"-roll-A3.glb");
    assert.equal(r.sourceGLBSHA256,previous.sourceSHA256);
    assert.match(r.blender,/4\.5\.14/);
    assert.equal(r.clip,clip);
    assert.equal(r.sourceMesh,x.mesh);
    assert.equal(r.meshVertices,x.vertices);
    assert.equal(r.meshEdges,x.edges);
    assert.equal(r.meshPolygons,x.polys);
    assert.equal(r.topologyComponentCount,x.components);
    assert.equal(r.footBearingComponentCount,x.footComponents);
    assert.equal(r.skinWeightThreshold,.35);
    assert.equal(r.materials.length,1);
    assert.equal(r.topTenLargestComponents[0].vertexCount,x.largestComponent);
    assert.ok(r.topologyComponentCount>1000);
    assert.equal(r.footMembership.LeftFoot.weightedVertices,x.leftCount);
    assert.equal(r.footMembership.RightFoot.weightedVertices,x.rightCount);
    assert.equal(r.footMembership.LeftFoot.touchingTopologyComponentCount,x.leftComponents);
    assert.equal(r.footMembership.RightFoot.touchingTopologyComponentCount,x.rightComponents);
    assert.equal(r.footMembership.LeftFoot.largestSingleComponentWeightedVertices,x.leftLargest);
    assert.equal(r.footMembership.RightFoot.largestSingleComponentWeightedVertices,x.rightLargest);
    for(const side of ["LeftFoot","RightFoot"]){
      assert.ok(r.footMembership[side].fractionInLargestComponent<.05);
      assert.ok(r.footMembership[side].components.length>10);
    }
    assert.equal(r.componentAnalysisIsNotOutsoleSegmentation,true);
    assert.equal(r.soleMaterialOrSemanticMeshIsolated,false);
    assert.equal(r.actualSoleContactValidated,false);
    assert.equal(r.authoritativeFloorOrGameXYValidated,false);
    assert.equal(r.originalModelOrAtlasModified,false);
    assert.equal(r.approved120VisualScaleUnchanged,true);
    assert.equal(r.combatNetworkOrPhysicsChanged,false);
    assert.equal(r.productionApproved,false);
  }
});
test("A2.16 Blender component audit does not create or save any source asset",()=>{
  const src=readFileSync(new URL("../tools/art/audit_knight_a216_topology.py",import.meta.url),"utf8");
  assert.match(src,/obj\.data\.edges/);
  assert.match(src,/foot_comp_count/);
  assert.match(src,/componentAnalysisIsNotOutsoleSegmentation/);
  assert.match(src,/args\.output\.write_text/);
  assert.doesNotMatch(src,/save_as_mainfile|export_scene\.gltf|bpy\.ops\.render\.render/);
});
