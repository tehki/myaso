import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {KNIGHT_PRESENTATION_SCALE,KNIGHT_ROLL_PRESENTATION_MS,
  knightPresentationRect} from "../web/knight-sprites.mjs";

const dir=new URL("../web/assets/knights/a212-review/",import.meta.url);
function json(file){return JSON.parse(readFileSync(new URL(file,dir),"utf8"));}
const sourceSHA={
  silver_roll:"e4a263d480896fb1069ffc81e913e9aaa7324ff344611f5b69829cfee25c5d94",
  t1_roll:"b89432a621d1f0956b7c06449035e0a055d11b17d6ceb34c9b26264eadcb6aed"
};
test("A2.12 real A3 foot bones projected through original 160px 8-direction bake",()=>{
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  assert.deepEqual(knightPresentationRect(true),{x:-67,y:-78,width:134,height:134});
  for(const clip of ["silver_roll","t1_roll"]){
    const data=json(clip+"_a212_foot_report.json");
    assert.equal(data.clip,clip);
    assert.equal(data.sourceSha256,sourceSHA[clip]);
    assert.equal(data.sourceGLBBasename,
      clip==="silver_roll"?"silver-knight-roll-A3.glb":"t1-sentinel-roll-A3.glb");
    assert.match(data.blender,/4\.5\.14/);
    assert.equal(data.spriteCameraOrthoScale,1.66);
    assert.equal(data.samples,64);
    assert.equal(data.directionRows,8);
    assert.deepEqual(data.sourceFrames60fps,[1,3,5,7,9,11,15,22]);
    assert.deepEqual(data.canvas,[160,160]);
    assert.deepEqual(data.renderedRollDimensionsPx,[134,134]);
    assert.deepEqual(data.renderedRollOffsetFromFighterOriginPx,[-67,-78]);
    assert.deepEqual(data.boneJointNames,["mixamorig:LeftFoot","mixamorig:RightFoot"]);
    assert.equal(data.footOrSoleContactMeasured,false);
    assert.equal(data.meshIntersectionOrGroundClearanceMeasured,false);
    assert.equal(data.authoritativeWorldPivotApproved,false);
    assert.equal(data.blenderOrOriginalGLBModified,false);
    assert.equal(data.originalAtlasesModified,false);
    assert.equal(data.gameCombatOrNetworkChanged,false);
    assert.equal(data.productionApproved,false);
    assert.deepEqual(new Set(data.observations.map(x=>x.direction)),
      new Set([0,1,2,3,4,5,6,7]));
    for(let i=0;i<64;i++){
      const item=data.observations[i];
      assert.equal(item.direction,Math.floor(i/8));
      assert.equal(item.atlasColumn,i%8);
      assert.equal(item.sourceFrame60fps,data.sourceFrames60fps[i%8]);
      for(const side of ["LeftFoot","RightFoot"]){
        const b=item.bones[side];
        for(const k of ["headAtlasFramePx","tailAtlasFramePx",
          "headPresentationOffsetPx","tailPresentationOffsetPx"])
          assert.ok(b[k].length===2&&b[k].every(Number.isFinite),clip+" "+k);
        const px=b.tailAtlasFramePx;
        const dest=b.tailPresentationOffsetPx;
        assert.ok(Math.abs(dest[0]-(-67+px[0]*134/160))<.001);
        assert.ok(Math.abs(dest[1]-(-78+px[1]*134/160))<.001);
      }
    }
  }
});
test("A2.12 source rig markers explain pose-dependent offsets, not verified shoe contact",()=>{
  const allowed={silver_roll:[-45,44],t1_roll:[-19,47]};
  for(const clip of Object.keys(allowed)){
    const data=json(clip+"_a212_foot_report.json");
    const offsets=data.observations.flatMap(o=>[
      o.bones.LeftFoot.tailPresentationOffsetPx[1],
      o.bones.RightFoot.tailPresentationOffsetPx[1]]);
    assert.ok(Math.min(...offsets)>allowed[clip][0]-.5);
    assert.ok(Math.max(...offsets)<allowed[clip][1]+.5);
    assert.ok(Math.max(...offsets)-Math.min(...offsets)>50);
    const qa=json(clip+"_a212_overlay_report.json");
    assert.equal(qa.sourceClip,clip);
    assert.equal(qa.sourceGLBSHA256,data.sourceSha256);
    assert.equal(qa.annotationNotActualFootSoleContact,true);
    assert.equal(qa.originalAtlasModified,false);
    assert.equal(qa.spritePivotChanged,false);
    assert.equal(qa.gameCombatChanged,false);
    assert.equal(qa.productionApproved,false);
    assert.deepEqual(qa.frameDirections,[0,6]);
    assert.equal(qa.frameCountPerDirection,8);
    assert.equal(qa.jointTailSampleCount,32);
    assert.equal(qa.samples.length,32);
    assert.equal(qa.nearOpaqueJointTailCount,clip==="silver_roll"?32:26);
    const png=new URL(clip+"_a212_foot_joint_overlay.png",dir);
    assert.ok(statSync(png).size>10000);
    assert.equal(readFileSync(png).subarray(0,8).toString("hex"),
      "89504e470d0a1a0a");
  }
});
test("A2.12 source scripts only read original Blender/atlas assets",()=>{
  const measure=readFileSync(new URL("../tools/art/measure_knight_a212_foot_bones.py",import.meta.url),"utf8");
  const overlay=readFileSync(new URL("../tools/art/review_knight_a212_foot_bones.py",import.meta.url),"utf8");
  assert.match(measure,/frame[s]? = \(1, 3, 5, 7, 9, 11, 15, 22\)/);
  assert.match(measure,/scene\.render\.fps = 60/);
  assert.match(measure,/spriteCameraOrthoScale/);
  assert.match(overlay,/nearOpaquePixel3pxRadius/);
  assert.doesNotMatch(measure,/save_as_mainfile|export_scene\.gltf|bpy\.ops\.render\.render/);
  assert.doesNotMatch(overlay,/\.save\(args\.atlas\)|\.write_bytes\(.*atlas/);
});
