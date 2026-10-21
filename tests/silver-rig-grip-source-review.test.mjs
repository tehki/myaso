import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const source=path=>readFileSync(new URL(path,root));
const JSONfile=path=>JSON.parse(source(path));
const folder="docs/art/rig-gripped-sword/";
const manifest=JSONfile(folder+"review_manifest.json");
const orig=JSONfile(folder+"original_3b_sword_transforms.json");
const contact=JSONfile(folder+"source_sword_clearance_proxy.json");
const bake=JSONfile(folder+"rig_grip_bake_report.json");
const sha=b=>createHash("sha256").update(b).digest("hex");
test("exact original approved Silver Knight roll atlas not modified",()=>{
 const art=source("web/assets/knights/silver_roll.webp");
 assert.equal(sha(art),manifest.originalWebpSha256);
 assert.equal(art.subarray(0,4).toString("ascii"),"RIFF");
 assert.equal(art.subarray(8,12).toString("ascii"),"WEBP");
 assert.equal(manifest.newArtActivated,false);
 assert.equal(manifest.authoritativeEquipment,false);
});
test("3B source mesh matrices retain the ORIGINAL small pommel scale, not enlarged sphere",()=>{
 assert.equal(Object.keys(orig.objects).length,6);
 assert.match(orig.sourceBlendSha256,/^[a-f0-9]{64}$/);
 const pommel=orig.objects["Sword faceted pommel"];
 assert.ok(pommel);
 assert.deepEqual(pommel.worldMatrix.slice(0,3).map((row,i)=>Math.round(row[i]*1000)/1000),
 [0.105,0.1,0.105]);
 assert.equal(pommel.vertices,62);
 for(const [name,o] of Object.entries(orig.objects)){
  assert.match(name,/^Sword /);
  assert.equal(o.worldMatrix.length,4);
  assert.ok(o.vertices>=9);
 }
 const script=source("tools/art/render_rig_gripped_silver_roll_review.py").toString("utf8");
 assert.match(script,/manifest\["sourceBlendSha256"\]/);
 assert.match(script,/Matrix\(manifest\["objects"\]\[o\.name\]\["worldMatrix"\]\)/);
 assert.match(script,/mixamorig:RightHand/);
});
test("64 original rig-bound 3B-mesh frames packaged as two complete source WebP atlases",()=>{
 assert.equal(bake.images.length,64);
 assert.equal(new Set(bake.images.map(x=>x.direction)).size,8);
 assert.equal(new Set(bake.images.map(x=>x.frameIndex)).size,8);
 assert.equal(bake.swordScale,.42);
 assert.equal(bake.realGameplay,false);
 for(const [name,digest] of [
  ["silver_roll_original_bone_gripped_sword_review.webp","atlasRigSwordReviewSha256"],
  ["silver_roll_unarmed_original_reference.webp","atlasOriginalReviewSha256"],
  ["silver_8direction_bone_grip_350ms.gif","animatedGifSha256"]]){
  const art=source(folder+name);
  assert.equal(sha(art),manifest[digest]);
  assert.ok(art.length>10000,name);
 }
 assert.deepEqual(manifest.sourceAtlasPx,[1792,1792]);
 assert.equal(manifest.framesPerDirection,8);
 assert.equal(manifest.directions,8);
 assert.equal(manifest.visualRollMs,350);
 assert.equal(manifest.humanApproved,false);
 const gif=source(folder+"silver_8direction_bone_grip_350ms.gif");
 assert.equal(gif.subarray(0,6).toString("ascii"),"GIF89a");
});
test("actual geometry-derived source proxy openly fails grip clearance, never claims ground proof",()=>{
 assert.equal(contact.poseSamples.length,8);
 assert.equal(contact.worldCollisionVerified,false);
 assert.equal(contact.sourceZ0IsVerifiedGround,false);
 assert.equal(contact.noLiveGame,true);
 const below=contact.poseSamples.filter(x=>x.swordLowerThanBodyBottomBy<0);
 assert.ok(below.length>=5,"unsafe proximity visible in source rig should keep human approval HOLD");
 assert.equal(contact.belowReferencePlaneCount,8);
 assert.ok(contact.poseSamples.every(x=>Number.isFinite(x.swordMinSourceZ)));
});
test("browser reviewer is stand-alone and cannot connect, equip or modify authoritative gameplay",()=>{
 const html=source("web/silver-rig-grip-a3-review.html").toString("utf8");
 const js=source("web/silver-rig-grip-a3-review.mjs").toString("utf8");
 assert.match(html,/NOT live equipment or Greyhaven gameplay/);
 assert.match(js,/realServer:false,realGameplay:false/);
 assert.match(js,/visualRollMs:total/);
 assert.ok(existsSync(new URL("tools/art/verify_silver_rig_grip_browser.mjs",root)));
 assert.equal(manifest.realGameplay,false);
});
