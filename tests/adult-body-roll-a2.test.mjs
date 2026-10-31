import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {
 ADULT_ROLL_PRESENTATION_MS, ADULT_ROLL_SOURCE_PX,
 ADULT_ROLL_FRAME_COUNT, ADULT_ROLL_DIRECTIONS,
 ADULT_ROLL_PRESENTATION_RECT, ADULT_ROLL_SOURCE_FRAMES, ADULT_ROLL_SOURCE_TIMES_MS,
 adultRollPhase,adultRollAtlasRect,
} from "../src/browser/adult-body-roll-a2.mjs";
const root=new URL("../",import.meta.url);
const bodies=["adult-masculine","adult-feminine"];
const bytes=path=>readFileSync(new URL(path,root));
const meta=path=>JSON.parse(bytes(path).toString("utf8"));
function glbAnimationNames(buf){
 assert.equal(buf.subarray(0,4).toString("ascii"),"glTF");
 assert.equal(buf.readUInt32LE(4),2);
 assert.equal(buf.readUInt32LE(8),buf.length);
 assert.equal(buf.readUInt32LE(16),0x4e4f534a);
 const json=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)).toString("utf8"));
 return {names:(json.animations||[]).map(x=>x.name),joints:json.skins?.[0]?.joints?.length};
}
test("A2 roll retains both bare adult source meshes and all four true Blender actions",()=>{
 for(const body of bodies){
  const base="assets/characters/adult-body-a2/"+body+"-roll-a2";
  const blend=bytes(base+".blend"),glb=bytes(base+".glb"),report=meta(base+".json");
  assert.equal(blend.subarray(0,7).toString("ascii"),"BLENDER");
  const parsed=glbAnimationNames(glb);
  assert.equal(parsed.joints,22);
  for(const name of ["idle","walk","run","roll"]) assert.ok(parsed.names.includes(name),body+" "+name);
  assert.equal(new Set(parsed.names).size,4);
  assert.deepEqual(report.preservedActions,["idle","walk","run"]);
  assert.deepEqual(report.rollSampleFrames,[1,3,5,7,9,11,15,22]);
  assert.equal(report.sourceFps,60);assert.equal(report.startFrame,1);assert.equal(report.endFrame,22);
  assert.equal(report.sourceRollDurationMs,350);
  assert.equal(report.combatActiveMs,170);assert.equal(report.combatRecoveryMs,180);
  assert.equal(report.rigBoneCount,22);
  assert.equal(report.renderedFrames,64);assert.equal(report.smoke,false);
  assert.equal(report.footContactVerified,false);
  assert.equal(report.gameplayMovementChanged,false);
  assert.equal(report.authoritativeCombatChanged,false);
  assert.equal(report.noArmorOrWeapons,true);
  assert.equal(report.productionReady,false);
 }
});
test("both adult rolls have original 8x8 WebP source atlases with verified hashes",()=>{
 for(const body of bodies){
  const base="web/assets/adults/"+body+"_roll";
  const atlas=bytes(base+".webp"),report=meta(base+".json");
  assert.equal(atlas.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(atlas.subarray(8,12).toString("ascii"),"WEBP");
  assert.equal(report.bytes,atlas.length);
  assert.equal(report.sha256,createHash("sha256").update(atlas).digest("hex"));
  assert.equal(report.bodyPresentation,body);assert.equal(report.clip,"roll");
  assert.equal(report.framesPerDirection,8);assert.equal(report.directions,8);
  assert.equal(report.atlasWidth,1280);assert.equal(report.atlasHeight,1280);
  assert.equal(report.sourceFramePx,160);assert.equal(report.destinationPx,134);
  assert.equal(report.rollVisualMs,350);
  assert.equal(report.dodgeActiveMs,170);assert.equal(report.recoveryMs,180);
  assert.equal(report.productionActive,false);
  assert.ok(atlas.length<400000,"stage A2 per-body roll WebP bound");
 }
});
test("350ms source roll phase does not reset at 170ms dodge to recovery boundary",()=>{
 assert.equal(ADULT_ROLL_PRESENTATION_MS,350);
 assert.equal(ADULT_ROLL_SOURCE_PX,160);
 assert.equal(ADULT_ROLL_FRAME_COUNT,8);
 assert.deepEqual(ADULT_ROLL_DIRECTIONS,["south","southwest","west","northwest","north","northeast","east","southeast"]);
 assert.deepEqual(ADULT_ROLL_SOURCE_FRAMES,[1,3,5,7,9,11,15,22]);
 assert.deepEqual(ADULT_ROLL_SOURCE_TIMES_MS,[0,1000/30,2000/30,100,4000/30,5000/30,7000/30,350]);
 assert.deepEqual(ADULT_ROLL_PRESENTATION_RECT,{x:-67,y:-78,width:134,height:134});
 const samples=[0,40,87,130,169,170,174.9,175,250,349.9,350,600];
 const phases=samples.map(t=>adultRollPhase(t));
 assert.deepEqual(phases.map(x=>x.frame),[0,1,2,3,5,5,5,5,6,6,7,7]);
 assert.equal(phases[4].phase,"active");assert.equal(phases[5].phase,"recovery");
 assert.equal(phases[5].durationMs,350);
 assert.equal(phases[5].sourceTimeMs,5000/30);
 assert.equal(phases[9].sourceTimeMs,7000/30);
 for(let i=1;i<phases.length;i++)assert.ok(phases[i].frame>=phases[i-1].frame);
 assert.equal(adultRollPhase(-1),null);assert.equal(adultRollPhase(NaN),null);
 assert.equal(adultRollPhase(Infinity),null);
});
test("atlas cell and approved roll rectangle strictly validate direction and elapsed time",()=>{
 assert.deepEqual(adultRollAtlasRect(5,200),{
  source:{x:5*160,y:5*160,width:160,height:160},
  destination:ADULT_ROLL_PRESENTATION_RECT,phase:"recovery",frame:5,
  sourceTimeMs:5000/30,
 });
 for(const direction of [-1,8,Infinity,0.5,"1",null])
  assert.equal(adultRollAtlasRect(direction,30),null);
 assert.equal(adultRollAtlasRect(0,-1),null);
 assert.equal(Object.isFrozen(adultRollAtlasRect(2,175).source),true);
});
test("A2 source tooling is original Blender art and does not touch combat or server",()=>{
 const script=bytes("tools/art/author_adult_roll_a2.py").toString("utf8");
 const pack=bytes("tools/art/pack_adult_roll_a2.py").toString("utf8");
 assert.match(script,/bpy\.ops\.import_scene\.gltf/);
 assert.match(script,/export_scene\.gltf/);
 assert.match(script,/A2_ROLL_COMPLETE/);
 assert.match(pack,/Image\.new\("RGBA"/);
 assert.ok(!script.includes("web/online-game.mjs"));
 assert.ok(!script.includes("MYASO_BIND"));
});
