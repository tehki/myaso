import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const read=f=>readFileSync(new URL(f,root));
const doc=f=>JSON.parse(read(f));
const prefix="docs/art/silver-kick-grounding-p0/";
const manifest=doc(prefix+"grounded_kick_art_manifest.json");
const comparison=doc(prefix+"source_foot_motion_before_after.json");
const sha=x=>createHash("sha256").update(x).digest("hex");
test("baseline #558 original source WebP is retained byte-for-byte",()=>{
 assert.equal(sha(read("docs/art/silver-kick-dash-p0/silver_kick_p0.webp")),
   manifest.originalKickAtlasSha256);
 assert.equal(manifest.sourceHead,"72afc96514193e8c8c0fa9ac206b277c1e937fc7");
 assert.equal(manifest.gameplayEnabled,false);
 assert.equal(manifest.serverOrHitboxChanged,false);
 assert.equal(manifest.dashOriginalUnchanged,true);
});
test("corrected Blender original source WebP and 380ms compare GIF hashes match",()=>{
 assert.equal(manifest.sourceDrawCount,64);
 assert.equal(manifest.directionCount,8);
 assert.equal(manifest.sourceFramesPerFacing,8);
 assert.deepEqual(manifest.sourceFramePx,[160,160]);
 assert.deepEqual(manifest.atlasPx,[1280,1280]);
 assert.equal(manifest.kickVisualBudgetMs,380);
 assert.equal(manifest.timingsMs.reduce((a,b)=>a+b,0),380);
 assert.ok(manifest.pixelChangesPerFacing.every(n=>n>350));
 for(const [file,key,magic] of [
  ["silver_kick_planted_p0.webp","newGroundedKickAtlasSha256","RIFF"],
  ["silver_kick_original_vs_planted_8way_380ms.gif","comparisonGifSha256","GIF8"]]){
  const bytes=read(prefix+file);
  assert.equal(sha(bytes),manifest[key]);
  assert.equal(bytes.subarray(0,4).toString("ascii"),magic);
 }
});
test("actual two Blender action sources compare 45+ time samples with lower toe drift",()=>{
 assert.ok(comparison.original.sampleCount>=45);
 assert.equal(comparison.original.sampleCount,comparison.corrected.sampleCount);
 assert.equal(comparison.sourceGroundIsActualWorldGround,false);
 assert.equal(comparison.actorRootMovementChanged,false);
 assert.equal(comparison.humanApproved,false);
 assert.ok(comparison.original.maxToeXYZ>0.08);
 assert.ok(comparison.corrected.maxToeXYZ<comparison.original.maxToeXYZ*0.5);
 assert.ok(comparison.corrected.maxToeXY<comparison.original.maxToeXY*0.5);
 assert.ok(comparison.relativeXYZReductionPct>50);
 assert.equal(comparison.corrected.samples.length,comparison.original.samples.length);
});
test("source pose stabilizer is opt-in, action authored rather than client fake motion",()=>{
 const py=read("tools/art/author_silver_kick_dash_p0.py").toString("utf8");
 assert.match(py,/--plant-kick/);
 assert.match(py,/mixamorig:/);
 assert.match(py,/SOURCE_KICK_SUPPORT_PLANT/);
 assert.match(py,/hip\.keyframe_insert/);
 assert.match(py,/actualFloorProven/);
 const blend=read(prefix+"Graphics3A_Silver_Kick_Dash_grounded_action_source.blend");
 assert.equal(blend.subarray(0,7).toString("ascii"),"BLENDER");
 assert.ok(blend.length>30000);
});
test("browser source review compares original and new without asserting playable game",()=>{
 const js=read("web/silver-kick-grounding-p0-review.mjs").toString("utf8");
 assert.match(js,/realGreyhaven:false/);
 assert.match(js,/realCombat:false/);
 assert.match(js,/humanApproved:false/);
 assert.match(js,/before/);
 assert.match(js,/after/);
 const base=read("web/silver-kick-grounding-p0-review.html").toString("utf8");
 assert.match(base,/SOURCE-ART VISUAL HOLD/);
});
