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
const digests={};
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
 digests[name]={gltfSha256:hash(content),bufferByteLength:bin.size,
  referencedImageNames:(gltf.images??[]).map(x=>x.uri)};
}
for(const part of config.sample.parts){
 assert.ok(selected.includes(part.model),"cottage refers to missing Quaternius source model");
 assert.ok(part.at?.length===3&&part.at.every(Number.isFinite),"invalid preview pose");
 assert.ok(Number.isFinite(part.yawDeg),"invalid preview angle");
}
const proof={
 source:"Quaternius CC0 Medieval Village MegaKit Standard (mirror pinned)",
 sourceCommit:commit,sourceEdition:"Standard",sourceModuleCount:modules.length,
 exactSelectedSourceCount:selected.length,assembledOriginalParts:config.sample.parts.length,
 checkedExternalTextures:sourceTextures.size,sourceDigests:digests,
 sourceArchiveCreatorByteParityNotVerified:true,
 noOriginalRedLionChange:true,serverAuthorityUntouched:true,artPreviewOnly:true
};
console.log("GRAPHICS3B_QUATERNIUS_PINNED_STANDARD_SOURCE_PASS "+JSON.stringify(proof));
