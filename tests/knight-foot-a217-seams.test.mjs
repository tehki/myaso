import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS}
  from "../web/knight-sprites.mjs";

const here=new URL("../web/assets/knights/",import.meta.url);
const expected={
  silver_roll:{original:9658,joined:23,vertices:105847,edges:195064,polys:98787,
    dup:57834,buckets:35963,bridges:35945,
    left:3318,right:3390,sourceName:"silver-knight"},
  t1_roll:{original:2057,joined:1,vertices:101687,edges:249720,polys:149880,
    dup:26827,buckets:22879,bridges:22879,
    left:8508,right:8245,sourceName:"t1-sentinel"}
};
test("A2.17 original A3 meshes have duplicate-position seam fragmentation",()=>{
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  for(const [clip,e] of Object.entries(expected)){
    const r=JSON.parse(readFileSync(
      new URL("a217-review/"+clip+"_a217_seams.json",here),"utf8"));
    const a216=JSON.parse(readFileSync(
      new URL("a216-review/"+clip+"_a216_topology.json",here),"utf8"));
    const a215=JSON.parse(readFileSync(
      new URL("a215-review/"+e.sourceName+"-a215-provenance.json",here),"utf8"));
    assert.equal(r.clip,clip);
    assert.equal(r.sourceGLBBasename,e.sourceName+"-roll-A3.glb");
    assert.equal(r.sourceGLBSHA256,a216.sourceGLBSHA256);
    assert.equal(r.sourceGLBSHA256,a215.sourceSHA256);
    assert.match(r.blender,/4\.5\.14/);
    assert.equal(r.sourceMesh,a216.sourceMesh);
    assert.equal(r.meshVertices,e.vertices);
    assert.equal(r.meshEdges,e.edges);
    assert.equal(r.meshPolygons,e.polys);
    assert.equal(r.sourceMeshIndexEdgeComponents,e.original);
    assert.equal(r.footSkinWeightThreshold,.35);
    for(const kind of ["exactRestPositionEquivalence",
                       "rounded5DecimalRestPositionEquivalence"]){
      const g=r[kind];
      assert.equal(g.componentsAfterHypotheticalCoordinateUnion,e.joined);
      assert.equal(g.componentReductionFromOriginal,e.original-e.joined);
      assert.equal(g.positionGroupsWithDuplicateVertices,e.buckets);
      assert.equal(g.duplicateIndexCountBeyondFirst,e.dup);
      assert.equal(g.duplicateCoordinateGroupsBridgingOriginalIndexIslands,e.bridges);
      assert.equal(g.componentsContainingBothLeftAndRightFootWeights,1);
      assert.deepEqual(g.leftRightWeightedVerticesWithinSharedComponents,
        {LeftFoot:e.left,RightFoot:e.right});
      assert.equal(g.perFoot.LeftFoot.selectedOriginalWeightedVertices,e.left);
      assert.equal(g.perFoot.RightFoot.selectedOriginalWeightedVertices,e.right);
      assert.equal(g.perFoot.LeftFoot.footBearingComponents,1);
      assert.equal(g.perFoot.RightFoot.footBearingComponents,1);
      assert.equal(g.perFoot.LeftFoot.fractionInLargestComponent,1);
      assert.equal(g.perFoot.RightFoot.fractionInLargestComponent,1);
      assert.equal(g.spatialCoincidenceNotProofOfSole,true);
      assert.equal(g.hypotheticalUnionOnly,true);
    }
    assert.equal(r.roundedCoordinatesAreNotEuclideanToleranceTest,true);
    assert.equal(r.coordinateCoincidenceCannotDistinguishArmorFromSole,true);
    assert.equal(r.anyBootSoleGeometryIsolated,false);
    assert.equal(r.environmentGroundPlaneKnown,false);
    assert.equal(r.authoritativeGroundContactProven,false);
    assert.equal(r.originalSourceAssetsModified,false);
    assert.equal(r.actualVertexPositionsOrIndicesModified,false);
    assert.equal(r.approved120VisualScaleUnchanged,true);
    assert.equal(r.a3RollTimingUnchanged,true);
    assert.equal(r.gameplayOrNetworkingChanged,false);
    assert.equal(r.productionApproved,false);
  }
});
test("A2.17 material-free seam diagnostic does not export or rewrite source assets",()=>{
 const s=readFileSync(
   new URL("../tools/art/audit_knight_a217_position_seams.py",import.meta.url),
   "utf8");
 assert.match(s,/positions=\[tuple/);
 assert.match(s,/for i,j in edges:union\(i,j\)/);
 assert.match(s,/exact=inspect/);
 assert.match(s,/rounded=inspect/);
 assert.match(s,/coordinateCoincidenceCannotDistinguishArmorFromSole/);
 assert.match(s,/actualVertexPositionsOrIndicesModified/);
 assert.doesNotMatch(s,/save_as_mainfile|export_scene\.gltf|bpy\.ops\.render\.render|bmesh\.ops\.remove_doubles/);
});
