import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS}
  from "../web/knight-sprites.mjs";

const root=new URL("../web/assets/knights/a215-review/",import.meta.url);
const verified={
  "silver-knight":{mesh:"geometry_0",vertices:105847,polygons:98787,
    material:"Material_0",sourceSHA256:"e4a263d480896fb1069ffc81e913e9aaa7324ff344611f5b69829cfee25c5d94"},
  "t1-sentinel":{mesh:"material",vertices:101687,polygons:149880,
    material:"Material.001",sourceSHA256:"b89432a621d1f0956b7c06449035e0a055d11b17d6ceb34c9b26264eadcb6aed"}
};

test("A2.15 original A3 GLBs lack independent sole-material labels",()=>{
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  for(const [name,e] of Object.entries(verified)){
    const src=readFileSync(new URL(name+"-a215-provenance.json",root),"utf8");
    const r=JSON.parse(src);
    assert.match(r.blenderVersion,/4\.5\.14/);
    assert.equal(r.sourceName,name+"-roll-A3.glb");
    assert.equal(r.sourceSHA256,e.sourceSHA256);
    assert.equal(r.skinnedMeshCount,1);
    assert.equal(r.skinnedMaterialCount,1);
    assert.equal(r.skinnedMeshPolygonCount,e.polygons);
    assert.equal(r.hasDedicatedOutsoleLabel,false);
    assert.equal(r.materialBasedBootSoleIsolationSupported,false);
    const mesh=r.meshInventory.find(m=>m.skinned);
    assert.equal(mesh.meshName,e.mesh);
    assert.equal(mesh.vertices,e.vertices);
    assert.equal(mesh.polygons,e.polygons);
    assert.deepEqual(mesh.materials,[e.material]);
    assert.deepEqual(mesh.polygonsByMaterial,{[e.material]:e.polygons});
    assert.deepEqual(mesh.shoeOrSoleSemanticLabels,[]);
    assert.ok(mesh.footSkinGroups.some(n=>n.endsWith("LeftFoot")));
    assert.ok(mesh.footSkinGroups.some(n=>n.endsWith("RightFoot")));
    assert.equal(r.authoritativeFloorKnown,false);
    assert.equal(r.anatomicalSoleContactValidated,false);
    assert.equal(r.a3TimingChanged,false);
    assert.equal(r.spritePresentationScaleChanged,false);
    assert.equal(r.originalGLBOrBlenderModified,false);
    assert.equal(r.productionApproved,false);
  }
});

test("A2.15 provenance tool is read-only and explicitly rejects collision claims",()=>{
  const python=readFileSync(new URL("../tools/art/audit_knight_a215_footwear_provenance.py",import.meta.url),"utf8");
  assert.match(python,/read_factory_settings/);
  assert.match(python,/polygonsByMaterial/);
  assert.match(python,/anatomicalSoleContactValidated/);
  assert.match(python,/originalGLBOrBlenderModified/);
  assert.doesNotMatch(python,/save_as_mainfile|export_scene\.gltf|bpy\.ops\.render\.render/);
});
