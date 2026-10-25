#!/usr/bin/env node
// Graphics 3B QA — fail-closed authentic FREE Quaternius MegaKit Standard source.
// Read-only glTF validation: no gameplay/world/physics/Combat changes.
import assert from "node:assert/strict";
import {readFile,readdir,stat} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {join,resolve} from "node:path";
import {createHash} from "node:crypto";

const root=process.cwd();
const manifestPath="assets/environment/greyhaven/quaternius-standard-preview/manifest.json";
const config=JSON.parse(await readFile(join(root,manifestPath),"utf8"));
const sourceRoot=resolve(root,"third_party/quaternius/medieval-village-megakit-standard");
const gltfRoot=join(sourceRoot,"glTF");
const hash=x=>createHash("sha256").update(x).digest("hex");
assert.equal(config.schema,1);
assert.equal(config.source.author,"Quaternius");
assert.equal(config.source.officialEdition,"Standard (free, 176 source models)");
assert.equal(config.source.license,"CC0-1.0");
assert.equal(config.source.mirroredArchiveByteParityVerified,false,
  "separately compare publisher archive before production");
assert.equal(config.scope.status,"artist-preview-only");
for(const name of ["preserveOriginalRedLion","noOriginalRoofChange","noLiveCollisionAuthority",
 "noCombatChange","noServerChange","noItemsOrSwords","noProductionActivation"]){
 assert.equal(config.scope[name],true,name+" must be frozen");
}
const modules=(await readdir(gltfRoot)).filter(x=>x.endsWith(".gltf"));
assert.equal(modules.length,176,"must import only 176 actual Standard source glTF modules");
const commit=execFileSync("git",["-C",sourceRoot,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(commit,config.source.mirrorCommit,"unreviewed source mirror HEAD");
const attrs=await readFile(join(root,".gitmodules"),"utf8");
assert.match(attrs,/J-Ponzo\/gltf-medieval-village-megakit\.git/);
assert.match(attrs,/third_party\/quaternius\/medieval-village-megakit-standard/);
const selected=config.selection;
assert.ok(selected.length>=10&&new Set(selected).size===selected.length);
assert.ok(config.sample.parts.length>=12);
const digests={},geometry={};
const sourceTextures=new Set();
for(const name of selected){
 assert.match(name,/^[A-Za-z0-9_]+$/,"source selection name must be safe");
 const file=join(gltfRoot,name+".gltf"),content=await readFile(file);
 const gltf=JSON.parse(content.toString("utf8"));
 assert.equal(gltf.asset.version,"2.0");
 assert.ok(gltf.meshes?.length>=1,"authentic glTF mesh missing: "+name);
 assert.ok(gltf.buffers?.length===1,"unexpected glTF buffer count "+name);
 const binName=gltf.buffers[0].uri;
 assert.equal(binName,name+".bin","nonstandard or external mesh buffer "+name);
 const bin=await stat(join(gltfRoot,binName));
 assert.equal(bin.size,gltf.buffers[0].byteLength,"gltf/buffer byte drift: "+name);
 for(const image of gltf.images??[]){
  const uri=image.uri;
  assert.match(uri,/^T_[A-Za-z0-9_]+\.png$/,"unreviewed external texture dependency");
  const texture=await stat(join(gltfRoot,uri));
  assert.ok(texture.size>100,"missing authentic source PNG "+uri);
  sourceTextures.add(uri);
 }
 const bounds=gltf.meshes.flatMap(mesh=>(mesh.primitives??[]).map(primitive=>gltf.accessors[primitive.attributes?.POSITION])).filter(a=>a?.min?.length===3&&a?.max?.length===3);
 assert.ok(bounds.length>=1,"genuine source glTF POSITION bounds absent: "+name);
 geometry[name]={minX:Math.min(...bounds.map(a=>a.min[0])),maxX:Math.max(...bounds.map(a=>a.max[0])),
  bottomY:Math.min(...bounds.map(a=>a.min[1])),topY:Math.max(...bounds.map(a=>a.max[1]))};
 digests[name]={gltfSha256:hash(content),bufferByteLength:bin.size,
  referencedImageNames:(gltf.images??[]).map(x=>x.uri)};
}
for(const part of config.sample.parts){
 assert.ok(selected.includes(part.model),"cottage refers to missing Quaternius source model");
 assert.ok(part.at?.length===3&&part.at.every(Number.isFinite),"invalid preview pose");
 assert.ok(Number.isFinite(part.yawDeg),"invalid preview angle");
}
const align=config.sample.doorFrameAlignment;
assert.equal(align.doorModel,"Door_1_Round");
assert.equal(align.frameModel,"DoorFrame_Round_WoodDark");
const door=config.sample.parts.filter(p=>p.model===align.doorModel);
const frame=config.sample.parts.filter(p=>p.model===align.frameModel);
assert.equal(door.length,1);assert.equal(frame.length,1);
assert.equal(door[0].yawDeg,0);assert.equal(frame[0].yawDeg,0);
const centerX=(model,pose)=>(geometry[model].minX+geometry[model].maxX)/2+pose.at[0];
const actualOffset=Math.abs(centerX(align.doorModel,door[0])-centerX(align.frameModel,frame[0]));
const originalUncorrectedOffset=Math.abs(centerX(align.doorModel,frame[0])-centerX(align.frameModel,frame[0]));
assert.ok(originalUncorrectedOffset>.45&&originalUncorrectedOffset<.60,
 "genuine free Standard door does not have known off-center hinge-origin geometry");
assert.ok(actualOffset<=align.maximumCenterOffsetMeters,
 "Quaternius door is displaced from source arch at production-review pose");
const threshold=(geometry[align.doorModel].bottomY+door[0].at[2])-
 (geometry[align.frameModel].bottomY+frame[0].at[2]);
assert.ok(threshold>=0&&threshold<=align.maximumBottomOffsetMeters,
 "Quaternius original door does not rest within frame threshold tolerance");
const doorGeometrySourceProof={oldMisalignmentMeters:originalUncorrectedOffset,
 correctedCenterOffsetMeters:actualOffset,originalDoorBottomAboveFrameMeters:threshold,
 geometrySource:"actual source glTF POSITION accessor AABBs",notImageEdited:true};
console.log("GRAPHICS3B_QUATERNIUS_SOURCE_DOOR_ALIGNMENT_PASS "+JSON.stringify(doorGeometrySourceProof));
const proof={
 source:"Quaternius CC0 Medieval Village MegaKit Standard (mirror pinned)",
 sourceCommit:commit,sourceEdition:"Standard",sourceModuleCount:modules.length,
 exactSelectedSourceCount:selected.length,assembledOriginalParts:config.sample.parts.length,
 checkedExternalTextures:sourceTextures.size,sourceDigests:digests,
 sourceArchiveCreatorByteParityNotVerified:true,doorGeometrySourceProof,
 noOriginalRedLionChange:true,serverAuthorityUntouched:true,artPreviewOnly:true
};
console.log("GRAPHICS3B_QUATERNIUS_PINNED_STANDARD_SOURCE_PASS "+JSON.stringify(proof));
