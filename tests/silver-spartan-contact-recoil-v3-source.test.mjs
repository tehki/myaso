import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const at=(p)=>readFileSync(new URL("../"+p,import.meta.url));
const load=(p)=>JSON.parse(at(p).toString("utf8"));
const hash=(p)=>createHash("sha256").update(at(p)).digest("hex");
const dir="docs/art/silver-spartan-contact-recoil-v3/";
const metrics=load(dir+"source_pose_v2_vs_v3.json");
const bake=load(dir+"spartan_contact_recoil_v3_bake_report.json");
const manifest=load(dir+"spartan_contact_recoil_v3_art_manifest.json");
test("genuine 22-bone Silver V3 knee/chest chamber and planted toe are source-validated",()=>{
 assert.deepEqual(metrics.unchangedAuthoritativeKickPhasesMs,[90,70,220]);
 assert.equal(metrics.sourceVisualOnly,true);
 assert.equal(metrics.realGreyhavenFloorVerified,false);
 assert.equal(metrics.serverHitOrDamageVerified,false);
 assert.equal(metrics.actorWorldTranslationChanged,false);
 assert.ok(metrics.baseline.kneeChamberRiseWorldZSourceUnits>0.18);
 assert.ok(metrics.candidate.kneeChamberRiseWorldZSourceUnits > metrics.baseline.kneeChamberRiseWorldZSourceUnits);
 assert.ok(metrics.candidate.contactBootForwardFromPlantedToeLocalMinusYUnits > metrics.baseline.contactBootForwardFromPlantedToeLocalMinusYUnits);
 assert.ok(metrics.candidate.maxLeftToeJoint3dDriftSourceUnits<0.0002,"V3 original stabilizer at all sampled source phases");
});
test("ten actual authored original Silver source keys include a distinct braced drive and recoil",()=>{
 assert.equal(bake.sourceRigBones,22);
 assert.equal(bake.spartanHighKneeKickOptIn,true);
 assert.equal(bake.spartanHighForwardRevisionOptIn,true);
 assert.equal(bake.spartanContactRecoilV3OptIn,true);
 assert.deepEqual(bake.authoritativePhases,{kickMs:[90,70,220],dashMs:140});
 assert.equal(bake.originalArtReplaced,false);
 assert.equal(bake.worldGroundValidated,false);
 assert.equal(bake.trueServerEvent,false);
 assert.equal(bake.realGreyhaven,false);
 assert.equal(bake.humanVisualApproved,false);
 assert.equal(bake.sourceEditableBlend,true);
 const frames=bake.sourceActionKeys.map(x=>x.blenderFrame);
 assert.deepEqual(frames,[1,3.7,6.4,8.1,9.35,10.6,11.3,13.5,18,23.8]);
 assert.equal(bake.sourceActionKeys[0].sourceMs,0);
 assert.equal(bake.sourceActionKeys.at(-1).sourceMs,380);
 assert.ok(bake.kickSupportFootSourceOnly.plantedKickToeMaxDeviation<0.002);
 assert.equal(bake.kickSupportFootSourceOnly.serverRootTranslation,false);
 assert.equal(bake.kickSupportFootSourceOnly.actualFloorProven,false);
});
test("64 original Blender CyclES 160x160 Silver V3 kick cells across all original eight directions",()=>{
 const renders=bake.rendered.filter(x=>x.clip==="silver_kick_p0");
 assert.equal(renders.length,64);
 const samples=[1,3.7,6.4,8.5,10.6,13.5,18,23.8];
 for(let d=0;d<8;d++) {
  const frames=renders.filter(x=>x.direction===d).sort((x,y)=>x.phase-y.phase);
  assert.equal(frames.length,8);
  assert.deepEqual(frames.map(x=>x.sourceFrame),samples);
  assert.ok(frames.every(x=>x.bytes>400));
 }
 assert.equal(bake.sourceSha256,"d679fccd00df868d600b4c5e2fcf8a4a46cc062dbd432be5b6a7f533eb30141f");
});
test("lossless original V3 Silver atlas, before/after 380ms GIF, and Blender action SHA provenance",()=>{
 assert.equal(manifest.previousSpartanV2KickAtlasSha256,
   hash("docs/art/silver-spartan-high-forward-p0/silver_spartan_high_forward_p0.webp"));
 assert.equal(manifest.newOriginalSpartanV3KickAtlasSha256,
   hash(dir+"silver_spartan_contact_recoil_v3_p0.webp"));
 assert.equal(manifest.contactRecoilComparisonGifSha256,
   hash(dir+"silver_spartan_v2_vs_v3_contact_recoil_8way_380ms.gif"));
 assert.equal(manifest.sourceDrawCount,64);
 assert.equal(manifest.sourceFramesPerFacing,8);
 assert.equal(manifest.directionCount,8);
 assert.deepEqual(manifest.sourceFramePx,[160,160]);
 assert.deepEqual(manifest.atlasPx,[1280,1280]);
 assert.equal(manifest.kickVisualBudgetMs,380);
 assert.equal(manifest.timingsMs.reduce((a,b)=>a+b,0),380);
 assert.ok(manifest.pixelChangesPerFacing.every(n=>n>350));
 assert.equal(manifest.gameplayEnabled,false);
 assert.equal(manifest.serverOrHitboxChanged,false);
 assert.equal(manifest.dashOriginalUnchanged,true);
 assert.equal(manifest.originalSourceArtOnly,true);
 assert.equal(at(dir+"silver_spartan_contact_recoil_v3_p0.webp").toString("ascii",0,4),"RIFF");
 assert.equal(at(dir+"silver_spartan_v2_vs_v3_contact_recoil_8way_380ms.gif").toString("ascii",0,4),"GIF8");
 const blend=at(dir+"Graphics3A_Silver_Spartan_Contact_Recoil_V3_source.blend");
 assert.ok(blend.byteLength>100000);
 assert.equal(hash(dir+"Graphics3A_Silver_Spartan_Contact_Recoil_V3_source.blend"),metrics.newSourceSha256);
 const src=at("tools/art/author_silver_kick_dash_p0.py").toString("utf8");
 assert.match(src,/--spartan-contact-recoil-v3/);
 assert.match(src,/spartaHighChamberV3/);
 assert.match(src,/spartaSnapBackV3/);
 assert.match(src,/args\.plant_kick/);
 assert.match(src,/--kick-only/);
});
