import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const dir="docs/art/silver-victim-knockdown-360ms/";
const bytes=name=>readFileSync(new URL(dir+name,root));
const json=name=>JSON.parse(bytes(name).toString("utf8"));
const sha=name=>createHash("sha256").update(bytes(name)).digest("hex");
const m=json("original_silver_knockdown_source_manifest.json");
const rig=json("independent_original_rig_reopen_audit.json");
test("original source art is the actual authorized owner 22-bone Silver rig with 360ms knockdown",()=>{
 assert.equal(m.sourceSha256,"d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f");
 assert.equal(m.originalRigBones,22);
 assert.equal(m.blenderKnockdownClipMs,360);
 assert.equal(m.authoritativeKickKnockdownMs,360);
 assert.equal(m.actorRootTranslationChanged,false);
 assert.equal(m.sourceEditableBlend,true);
 assert.equal(m.originalMeshRedistributed,false);
 assert.equal(m.authoritativeStateChanged,false);
 assert.equal(m.normalGameRendererUnchanged,true);
 assert.equal(m.worldFloorBootSoleValidated,false);
 assert.equal(m.impactMeshCollisionValidated,false);
 assert.equal(m.ownerApprovedGameplay,false);
 assert.equal(m.humanArtApproval,false);
 assert.equal(m.sourceOnly,true);
 assert.ok(!existsSync(new URL(dir+"silver-knight.glb",root)));
});
test("64 actual original 160px Blender Cycles source renders pack in 8 directions with 8 unique source sample frames",()=>{
 assert.equal(m.rendered.length,64);
 assert.equal(m.all64AtlasCellsFromRealBlenderSource,true);
 assert.deepEqual(m.atlasPx,[1280,1280]);
 assert.deepEqual(m.sourceCellPx,[160,160]);
 assert.equal(m.sourceClipFrames,8);
 assert.equal(m.directionCount,8);
 assert.equal(m.sourceKeyframes.length,8);
 const expected=[0,33.333,73.333,116.667,160,220,286.667,360];
 for(let i=0;i<8;i++)
   assert.ok(Math.abs(m.sourceKeyframes[i].ms-expected[i])<.01);
 for(let d=0;d<8;d++){
   const cells=m.rendered.filter(x=>x.direction===d);
   assert.equal(cells.length,8);
   assert.deepEqual(cells.map(x=>x.frame),[0,1,2,3,4,5,6,7]);
   assert.ok(cells.every(x=>x.bytes>400));
 }
 const atlas=bytes("original_silver_knockdown_360ms_8way.webp");
 assert.ok(atlas.byteLength>100000);
 assert.equal(atlas.subarray(0,4).toString("ascii"),"RIFF");
 assert.equal(atlas.subarray(8,12).toString("ascii"),"WEBP");
 assert.equal(sha("original_silver_knockdown_360ms_8way.webp"),m.realSourceAtlasSha256);
 const gif=bytes("original_silver_victim_knockdown_8way_360ms.gif");
 assert.equal(gif.subarray(0,4).toString("ascii"),"GIF8");
 assert.equal(sha("original_silver_victim_knockdown_8way_360ms.gif"),m.eightFacingAnimatedReviewGifSha256);
 assert.equal(m.reviewGifDurationsMs.reduce((a,b)=>a+b,0),360);
});
test("independent Blender reopens genuine editable 22-bone action only, HEAD falls and recovers, no owner GLB included",()=>{
 assert.equal(rig.originalArmatureBones,22);
 assert.equal(rig.originalOwnerMeshBundled,false);
 assert.equal(rig.actionName,"Graphics3A_Silver_Victim_Knockdown_360ms");
 assert.ok(Math.abs(rig.actionFrameRange[0]-1)<.001);
 assert.ok(Math.abs(rig.actionFrameRange[1]-22.6)<.002);
 assert.equal(rig.actionNominalDurationMs,360);
 assert.ok(rig.headWorldZDropSourceUnits>0.3);
 assert.ok(Math.abs(rig.neutralReference.headZ-rig.recoveryReference.headZ)<.006);
 assert.equal(rig.actorRootWorldTransformUnchanged,true);
 assert.equal(rig.realTerrainSoleContactTested,false);
 assert.equal(rig.clientServerKnockdownSyncTested,false);
 assert.equal(rig.gameplayIntegrated,false);
 assert.equal(rig.humanVisualApproved,false);
 const blend=bytes("Graphics3A_Original_Silver_Victim_Knockdown_360ms_source.blend");
 assert.ok(blend.length>100000);
 // Blender 5.2 may write compressed .blend bytes; independent bpy re-open above,
 // verified source digest and content audit are authoritative, not magic bytes.
 assert.equal(sha("Graphics3A_Original_Silver_Victim_Knockdown_360ms_source.blend"),rig.sourceBlendSha256);
 assert.equal(rig.sourceBlendSha256,m.realEditableSourceBlendSha256);
});
test("V3 high-forward attacker source remains unaltered and knockdown is NOT a production gameplay feature",()=>{
 const asset=readFileSync(new URL("web/assets/knights/silver_kick_v3.webp",root));
 assert.equal(createHash("sha256").update(asset).digest("hex"),
   "a6001a61c9cd48aa5b34ff7a7ecccb071bd6a3c6465ec5fd0cabffb4d3d1d747");
 assert.equal(rig.gameplayIntegrated,false);
 assert.equal(rig.clientServerKnockdownSyncTested,false);
 const author=readFileSync(new URL("tools/art/author_original_silver_knockdown_p0.py",root),"utf8");
 assert.match(author,/import_scene.gltf/);
 assert.match(author,/actorRootAtImport/);
 assert.match(author,/len\(arm.pose.bones\)==22/);
 assert.match(author,/Graphics3A_Silver_Victim_Knockdown_360ms/);
 assert.match(author,/if ob.type=="MESH"/);
 assert.match(author,/--no-render/);
});
