import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const base=new URL("../",import.meta.url);
const get=p=>readFileSync(new URL(p,base));
const json=p=>JSON.parse(get(p).toString("utf8"));
const bodies=["adult-masculine","adult-feminine"];
test("R4 has two real original 8x8 roll atlas artifacts with immutable hash manifests",()=>{
 for(const body of bodies){
  const prefix="web/assets/adults-review-r4/"+body+"_roll";
  const raw=get(prefix+".webp"),manifest=json(prefix+".json");
  assert.equal(raw.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(raw.subarray(8,12).toString("ascii"),"WEBP");
  assert.equal(raw.length,manifest.bytes);
  assert.equal(manifest.sha256,createHash("sha256").update(raw).digest("hex"));
  assert.deepEqual(manifest.atlasPx,[1280,1280]);
  assert.equal(manifest.framePx,160);
  assert.equal(manifest.directionCount,8);
  assert.equal(manifest.frameCount,8);
  assert.equal(manifest.artApproved,false);
  assert.equal(manifest.productionEnabled,false);
  assert.equal(manifest.groundContactVerifiedInGame,false);
  assert.equal(manifest.authoritativeMovementModified,false);
 }
});
test("R4 includes editable source pairs + exact CMU-to-game travel samples; no gameplay claims",()=>{
 for(const body of bodies){
  const prefix="assets/characters/adult-mocap-r4/"+body+"-mocap-roll-r4";
  const blender=get(prefix+".blend"),glb=get(prefix+".glb");
  const source=json(prefix+".json");
  assert.equal(blender.subarray(0,7).toString("ascii"),"BLENDER");
  assert.equal(glb.subarray(0,4).toString("ascii"),"glTF");
  assert.equal(source.body,body);
  assert.equal(source.sourceBVH,"128_10.bvh");
  assert.equal(source.sourceLicense,"CMU free for all uses");
  assert.deepEqual(source.selectedBVHFrames,[37,73,97,121,157,193,253,313]);
  assert.equal(source.framesRendered,64);
  assert.equal(source.smoke,false);
  assert.equal(source.rollTargetMs,350);
  assert.equal(source.dodgeActiveMs,170);
  assert.equal(source.recoveryMs,180);
  assert.equal(source.sampledRootContact.length,8);
  assert.equal(source.sampledRootContact[0].rootTravelMeters,0);
  assert.equal(source.sampledRootContact.at(-1).rootTravelMeters,1);
  for(const sample of source.sampledRootContact)assert.ok(Math.abs(sample.contactZ-.035)<.02);
  assert.equal(source.gameplayChanged,false);
  assert.equal(source.productionActive,false);
  assert.equal(source.liveGroundContactVerified,false);
  assert.equal(source.poseApproval,false);
 }
});
test("R4 retains CC0 MakeHuman source + three reviewed ancestry paths",()=>{
 for(const body of bodies){
  const prefix="assets/characters/adult-anatomy-r3/"+body+"-anatomical-shoulderroll-r3";
  assert.equal(get(prefix+".blend").subarray(0,7).toString("ascii"),"BLENDER");
  assert.equal(get(prefix+".glb").subarray(0,4).toString("ascii"),"glTF");
  const source=json(prefix+".json");
  assert.equal(source.sourceLicense,"CC0-1.0");
  assert.equal(source.sourceVertices,19158);
  assert.equal(source.bodyFaces,13378);
  assert.equal(source.sourceBoneCount,22);
  assert.equal(source.productionActive,false);
  assert.equal(source.humanVisualApproved,false);
 }
 const mesh=get("assets/characters/upstream-makehuman-r4/3dobjs/base.obj");
 assert.match(mesh.toString("utf8",0,500),/CC0/);
 for(const kind of ["male","female"])for(const origin of ["caucasian","asian","african"]){
  const path="assets/characters/upstream-makehuman-r4/targets/macrodetails/"+origin+"-"+kind+"-young.target.gz";
  assert.ok(get(path).length>1000,path);
 }
 const bvh=get("assets/characters/upstream-cmu-r4/128_10.bvh").toString("utf8");
 assert.match(bvh,/HIERARCHY\s*ROOT Hips/);
 assert.match(bvh,/Frames:\s*428/);
});
test("R4 only adds a dormant offline preview; source runtime contract unchanged",()=>{
 const html=get("web/adult-roll-r4-review.html").toString("utf8");
 const js=get("web/adult-roll-r4-review.mjs").toString("utf8");
 assert.match(html,/Human visual approval required/);
 assert.match(js,/authoritativeGameplay:false/);
 assert.match(js,/groundContactVerified:false/);
 assert.match(js,/humanVisualApproval:false/);
 assert.match(js,/integrationReady:false/);
 assert.ok(existsSync(new URL("docs/art/adult-roll-review-r4/adult-roll-r4-both-bodies-all-8.gif",base)));
 const p=json("docs/art/adult-roll-review-r4/packaging.json");
 assert.equal(p.loopMs,350);
 assert.equal(p.bodies.length,2);
 assert.equal(p.integrationReady,false);
});
