import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {COMBAT} from "../src/combat/model.mjs";
import {knightClip,KNIGHT_CLIPS} from "../web/knight-sprites.mjs";
import {auditKnightCoverage} from "../tools/art/knight_action_gap_matrix.mjs";
const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const art=JSON.parse(read("docs/art/silver-kick-dash-p0/source_art_manifest.json"));
const bake=JSON.parse(read("docs/art/silver-kick-dash-p0/kick_dash_blender_bake_report.json"));
const digest=x=>createHash("sha256").update(x).digest("hex");
test("kick and dash original Blender actions exist but are NOT activated in client",()=>{
 assert.deepEqual(auditKnightCoverage(),
  {total:31,authored:4,missing:27,kickAndDashMissing:4});
 for(const state of ["kickWindup","kickActive","kickRecovery","dash"]){
  assert.equal(knightClip(COMBAT_ACTION[state],"player"),null,
   "no premature source-to-game activation");
 }
 const blender=read("docs/art/silver-kick-dash-p0/Graphics3A_Silver_Kick_Dash_action_source.blend");
 assert.ok(blender.length>30000);
 assert.equal(blender.subarray(0,7).toString("ascii"),"BLENDER");
 assert.equal(bake.sourceRigBones,22);
 assert.equal(bake.originalArtReplaced,false);
 assert.equal(bake.humanVisualApproved,false);
 assert.equal(art.gameplayActivated,false);
});
test("source-authored action names, server timing, and 8-way per-frame genuine source bake",()=>{
 assert.deepEqual(bake.authoritativePhases.kickMs,
  [COMBAT.kick.windupMs,COMBAT.kick.activeMs,COMBAT.kick.recoveryMs]);
 assert.equal(bake.authoritativePhases.dashMs,COMBAT.dash.durationMs);
 assert.equal(art.assets.silver_kick_p0.durationMs,380);
 assert.equal(art.assets.silver_dash_p0.durationMs,140);
 assert.equal(bake.rendered.length,128);
 for(const clip of ["silver_kick_p0","silver_dash_p0"]){
  const frames=bake.rendered.filter(x=>x.clip===clip);
  assert.equal(frames.length,64);
  assert.deepEqual([...new Set(frames.map(x=>x.direction))],[0,1,2,3,4,5,6,7]);
  for(let d=0;d<8;d++)assert.deepEqual(
   frames.filter(x=>x.direction===d).map(x=>x.phase),
   [0,1,2,3,4,5,6,7]);
 }
});
test("new first-party WebP atlas and GIF bytes pinned, both 8-way and nonstatic",()=>{
 for(const [name,record] of Object.entries(art.assets)){
  assert.ok(["silver_kick_p0","silver_dash_p0"].includes(name));
  assert.deepEqual(record.atlasPx,[1280,1280]);
  assert.deepEqual(record.framePx,[160,160]);
  assert.equal(record.directions,8);
  assert.equal(record.frames,8);
  assert.equal(record.humanApproved,false);
  assert.equal(record.integrationReady,false);
  assert.deepEqual(record.perDirectionChangedPixels.length,8);
  assert.ok(record.perDirectionChangedPixels.every(n=>n>90),
   "source image must demonstrate real pose change, not identical idle frames");
  const webp=read("docs/art/silver-kick-dash-p0/"+record.atlas);
  const gif=read("docs/art/silver-kick-dash-p0/"+record.gif);
  assert.equal(webp.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(webp.subarray(8,12).toString("ascii"),"WEBP");
  assert.equal(gif.subarray(0,6).toString("ascii"),"GIF89a");
  assert.equal(digest(webp),record.sha256.atlas);
  assert.equal(digest(gif),record.sha256.gif);
  assert.equal(record.gifTimingsMs.reduce((a,b)=>a+b,0),record.durationMs);
 }
});
test("original Knight assets stay original and source Blender script authors keyed limbs",()=>{
 const script=read("tools/art/author_silver_kick_dash_p0.py").toString("utf8");
 assert.match(script,/mixamorig:/);
 assert.match(script,/source_pose/);
 assert.match(script,/Graphics3A_P0_Silver_Kick_380ms/);
 assert.match(script,/Graphics3A_P0_Silver_Dash_140ms/);
 assert.match(script,/RightUpLeg/);
 assert.match(script,/RightLeg/);
 assert.match(script,/Spine1/);
 assert.match(script,/keyframe_insert/);
 assert.match(script,/use_fake_user=True/);
 assert.equal(KNIGHT_CLIPS.silver_walk,8);
 assert.equal(KNIGHT_CLIPS.silver_roll,8);
 assert.equal(art.originalSilverGlbBundled,false);
});
test("source-only preview has scrubbing/slow motion and no implied live server acceptance",()=>{
 const html=read("web/silver-kick-dash-p0-review.html").toString("utf8");
 const viewer=read("web/silver-kick-dash-p0-review.mjs").toString("utf8");
 assert.match(html,/frame-by-frame|Original|eight-way/i);
 assert.match(viewer,/hasRealItemReceipt:false/);
 assert.match(viewer,/realGame:false/);
 assert.match(viewer,/visualApproved:false/);
 assert.ok(existsSync(new URL("tools/art/verify_silver_kick_dash_browser.mjs",root)));
});
