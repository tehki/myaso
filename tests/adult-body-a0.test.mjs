import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
import {createUnequippedAdultAppearance,planAdultCharacterLayers} from "../src/browser/character-appearance.mjs";

const ROOT=new URL("../",import.meta.url);
const styleNames=["adult-masculine","adult-feminine"];
const directions=["south","southwest","west","northwest","north","northeast","east","southeast"];
function file(rel){return readFileSync(new URL(rel,ROOT));}
const reportFor=name=>JSON.parse(file("assets/characters/adult-body/"+name+"-source-report.json"));
const atlasFor=name=>JSON.parse(file("web/assets/adults/"+name+"_idle.json"));

test("original adult source models exist as real editable Blender files and exported GLBs",()=>{
 for(const name of styleNames){
  const b=file("assets/characters/adult-body/"+name+".blend");
  const glb=file("assets/characters/adult-body/"+name+".glb");
  assert.equal(b.subarray(0,7).toString("ascii"),"BLENDER");
  assert.equal(glb.subarray(0,4).toString("ascii"),"glTF");
  assert.ok(b.length>100000);
  assert.ok(glb.length>100000);
  const metadata=reportFor(name);
  assert.equal(metadata.bodyPresentation,name);
  assert.equal(metadata.meshVertices>8000,true);
  assert.equal(metadata.rigBoneNames.length,22);
  assert.ok(metadata.rigBoneNames.includes("Head"));
  assert.ok(metadata.rigBoneNames.includes("LeftToeBase"));
  assert.ok(metadata.rigBoneNames.includes("RightHand"));
  assert.equal(metadata.noClothingArmorOrWeapons,true);
  assert.equal(metadata.productionReady,false);
  assert.equal(metadata.authoritativeGameModified,false);
 }
});

test("two original RGBA WebP idle atlases implement precisely eight directions and four phases",()=>{
 for(const name of styleNames){
  const a=atlasFor(name);
  const bin=file("web/assets/adults/"+name+"_idle.webp");
  assert.equal(a.bodyPresentation,name);
  assert.equal(a.clip,"idle");
  assert.equal(a.sourceFramePx,160);
  assert.equal(a.directions,8);
  assert.equal(a.framesPerDirection,4);
  assert.equal(a.atlasWidth,640);
  assert.equal(a.atlasHeight,1280);
  assert.ok(a.hasTransparency);
  assert.ok(a.renderOnly);
  assert.equal(a.activatedInGame,false);
  assert.equal(a.bytes,bin.length);
  assert.equal(createHash("sha256").update(bin).digest("hex"),a.sha256);
  assert.equal(bin.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(bin.subarray(8,12).toString("ascii"),"WEBP");
  assert.ok(bin.length<250000,"stage A0 per-body idle atlas budget");
  assert.deepEqual(reportFor(name).directionOrder,directions);
 }
});

test("appearance contract retains an empty inventory and a visible base-body layer",()=>{
 for(const name of styleNames){
  const appearance=createUnequippedAdultAppearance(name);
  assert.deepEqual(appearance.equipment,{body:null,offHand:null,mainHand:null});
  const planned=planAdultCharacterLayers(appearance);
  assert.equal(planned.supported,true);
  assert.deepEqual(planned.layers,[{kind:"base-body",assetKey:"body/"+name}]);
  assert.equal(Object.isFrozen(appearance),true);
 }
});

test("missing/unknown equipped items fail closed instead of misrepresenting character as bare",()=>{
 const naked=createUnequippedAdultAppearance("adult-masculine");
 assert.equal(planAdultCharacterLayers({...naked,
  equipment:{...naked.equipment,body:"UnmappedArmor"}}).supported,false);
 assert.equal(planAdultCharacterLayers(naked,{concealUnclothedBody:true})
  .layers.some(layer=>layer.kind==="privacy-cover"),true);
});

test("Graphics A0 source assets are isolated from production Knight and authoritative gameplay",()=>{
 const builder=file("tools/art/build_adult_body_a0.py").toString("utf8");
 const packer=file("tools/art/pack_adult_body_a0.py").toString("utf8");
 assert.match(builder,/original procedural/i);
 assert.match(builder,/voxel_remesh/);
 assert.match(builder,/export_scene\.gltf/);
 assert.match(packer,/atlas\.save/);
 assert.match(builder,/noClothingArmorOrWeapons/);
 assert.equal(/web\/online-game|server\/src\/lib\.rs/.test(builder),false);
});
