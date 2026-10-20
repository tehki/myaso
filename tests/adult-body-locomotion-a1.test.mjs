import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const root=new URL("../",import.meta.url);
const bodies=["adult-masculine","adult-feminine"];
function read(rel){return readFileSync(new URL(rel,root));}
function json(rel){return JSON.parse(read(rel).toString("utf8"));}
function animations(bytes){
 assert.equal(bytes.subarray(0,4).toString("ascii"),"glTF");
 const version=bytes.readUInt32LE(4);
 assert.equal(version,2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 const jsonLength=bytes.readUInt32LE(12);
 assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
 const payload=JSON.parse(bytes.subarray(20,20+jsonLength).toString("utf8"));
 return {animations:(payload.animations??[]).map(x=>x.name),
  joints:payload.skins?.[0]?.joints?.length};
}
test("original adult models preserve 22-bone source rig and editable three-action A1",()=>{
 for(const body of bodies){
  const base="assets/characters/adult-body-a1/"+body+"-locomotion-a1";
  const blend=read(base+".blend"),glb=read(base+".glb"),report=json(base+".json");
  assert.equal(blend.subarray(0,7).toString("ascii"),"BLENDER");
  const parsed=animations(glb);
  assert.equal(parsed.joints,22);
  for(const clip of ["idle","walk","run"])assert.ok(parsed.animations.includes(clip),body+" "+clip);
  assert.deepEqual(report.clips,["walk","run"]);
  assert.equal(report.rigBones,22);
  assert.equal(report.smoke,false);
  assert.equal(report.renderedFrames,64);
  assert.equal(report.originalA0Unchanged,true);
  assert.equal(report.authoritativeCombatChanged,false);
  assert.equal(report.footGroundContactVerified,false);
  assert.equal(report.productionReady,false);
 }
});
test("two source-rendered clips per body are valid bounded 8-direction WebP atlases",()=>{
 for(const body of bodies){
  for(const clip of ["walk","run"]){
   const base="web/assets/adults/"+body+"_"+clip;
   const bytes=read(base+".webp"),report=json(base+".json");
   assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF");
   assert.equal(bytes.subarray(8,12).toString("ascii"),"WEBP");
   assert.equal(report.bytes,bytes.length);
   assert.equal(report.sha256,createHash("sha256").update(bytes).digest("hex"));
   assert.equal(report.bodyPresentation,body);
   assert.equal(report.clip,clip);
   assert.equal(report.sourceFramePx,160);
   assert.equal(report.atlasWidth,640);
   assert.equal(report.atlasHeight,1280);
   assert.equal(report.directions,8);
   assert.equal(report.framesPerDirection,4);
   assert.equal(report.rgbaTransparency,true);
   assert.equal(report.productionActive,false);
   assert.ok(bytes.length<250000,"A1 stage per-clip atlas budget");
  }
 }
});
test("A1 graphics tooling makes no actual gameplay or source A0 mutation",()=>{
 const builder=read("tools/art/author_adult_locomotion_a1.py").toString("utf8");
 const packer=read("tools/art/pack_adult_locomotion_a1.py").toString("utf8");
 assert.match(builder,/bpy\.ops\.import_scene\.gltf/);
 assert.match(builder,/originalA0Unchanged/);
 assert.match(builder,/LOCOMOTION_ACTION/);
 assert.match(packer,/atlas\.save/);
 assert.ok(!builder.includes("web/online-game.mjs"));
});
