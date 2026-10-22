import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {readFileSync,statSync,existsSync} from "node:fs";

const root=new URL("../assets/environment/greyhaven/a232-review/",import.meta.url);
const original=new URL("../assets/environment/greyhaven/a230-review/",import.meta.url);
const sha=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
const report=JSON.parse(readFileSync(new URL("red_lion_a232_art_report.json",root),"utf8"));
const source=JSON.parse(readFileSync(new URL("red_lion_a232_blender_source.json",root),"utf8"));
test("A2.32 original editable Blender authoring has actual independent 20 iron meshes",()=>{
 assert.equal(source.addedMeshes,20);
 assert.equal(source.objectNames.length,20);
 assert.equal(new Set(source.objectNames).size,20);
 assert.ok(source.objectNames.every(n=>n.startsWith("A2.32 wrought fittings / ")));
 for(const word of ["hinge","knocker","shutter"])
  assert.ok(source.objectNames.some(n=>n.includes(word)),word);
 assert.equal(source.roofSourceEdited,false);
 assert.equal(source.liveGameIntegrated,false);
 assert.equal(report.gameRenderIntegrated,false);
 assert.equal(report.releaseApproved,false);
 assert.equal(source.sourceUntouched,true);
 assert.equal(source.sourceSha256,sha(new URL("blood_iron_red_lion_a230_joinery.blend",original)));
 assert.equal(source.derivedSha256,sha(new URL(source.derivedBlend,root)));
 assert.ok(statSync(new URL(source.derivedBlend,root)).size>100000);
});
test("A2.32 original Cycles frames, non-roof geometry, 640 to original 228x297 game-crop",()=>{
 assert.equal(report.changedRgbPixels,6792); // original Blender, lower hinge raised 24 cm
 assert.equal(report.changedAlphaPixels,0);
 assert.equal(report.changedBoundaryAlphaPixels,0);
 assert.deepEqual(report.croppedPixels,[228,297]);
 assert.deepEqual(report.drawOffsetFromVisualDoorPx,[-114,-269]);
 assert.deepEqual(report.rendered640AfterAlphaBounds,[209,54,431,345]);
 for(const k of ["baseline","ironwork"]){
  const entry=source.render640[k];
  assert.equal(sha(new URL(entry.file,root)),entry.sha256);
  assert.ok(entry.bytes>100000);
  assert.equal(readFileSync(new URL(entry.file,root)).subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 }
});
test("A2.32 exact day/dusk first-party WebP hashes, unchanged roof, no extra environmental lighting",()=>{
 for(const key of ["dayWebP","duskWebP"]){
  const file=new URL(report[key].file,root);
  assert.equal(sha(file),report[key].sha256);
  assert.ok(readFileSync(file).toString("ascii",0,4)==="RIFF");
  assert.ok(readFileSync(file).toString("ascii",8,12)==="WEBP");
  assert.ok(report[key].bytes>10000);
 }
 const roof=new URL("red_lion_a232_roof_unchanged.webp",root);
 const old=new URL("../assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp",import.meta.url);
 assert.equal(sha(roof),sha(old));
 assert.equal(sha(roof),report.roofSha256);
 assert.equal(report.roofByteIdentical,true);
 assert.equal(report.dayDuskAlphaIdentical,true);
 assert.equal(report.sourceWorldChanged,false);
 assert.equal(report.serverCollisionChanged,false);
 assert.equal(report.realFourPlayerAcceptance,false);
 const review=new URL("red_lion_a232_original_cycles_compare.png",root);
 assert.ok(statSync(review).size>30000);
});
test("A2.32 original Blender is not silently used in production World or Pre-Alpha",()=>{
 const full=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
 assert.match(full("tools/art/build_red_lion_a232_ironwork.py"),/import bpy/);
 assert.match(full("tools/art/build_red_lion_a232_ironwork.py"),/source_sha|original_source_sha/);
 assert.doesNotMatch(full("web/online-game.mjs"),/red_lion_a232/);
 const painter=new URL("../src/browser/authored-world-renderer.mjs",import.meta.url);
 if(existsSync(painter)) assert.doesNotMatch(readFileSync(painter,"utf8"),/red_lion_a232/);
});
