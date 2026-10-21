import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const root = new URL("../", import.meta.url);
const bytes = path => readFileSync(new URL(path,root));
const data = path => JSON.parse(bytes(path).toString("utf8"));
const dir = "docs/art/silver-spartan-high-forward-p0/";
const metrics = data(dir+"source_pose_before_after.json");
const bake = data(dir+"high_forward_blender_bake_report.json");
const manifest = data(dir+"spartan_high_forward_art_manifest.json");
const sha=path=>createHash("sha256").update(bytes(path)).digest("hex");

test("owner higher knee: independent saved original Silver action truly raises knee >2x",()=>{
 assert.deepEqual(metrics.unchangedAuthoritativeKickPhasesMs,[90,70,220]);
 assert.equal(metrics.sourceVisualOnly,true);
 assert.equal(metrics.realGreyhavenFloorVerified,false);
 assert.equal(metrics.serverHitOrDamageVerified,false);
 assert.equal(metrics.actorWorldTranslationChanged,false);
 const old=metrics.baseline.kneeChamberRiseWorldZSourceUnits;
 const v2=metrics.candidate.kneeChamberRiseWorldZSourceUnits;
 assert.ok(old>0.04);
 assert.ok(v2 > old*2.2,JSON.stringify({old,v2}));
});
test("owner farther forward: actual boot projects more than twice as far from planted boot",()=>{
 const old=metrics.baseline.contactBootForwardFromPlantedToeLocalMinusYUnits;
 const v2=metrics.candidate.contactBootForwardFromPlantedToeLocalMinusYUnits;
 assert.ok(old>0.1);
 assert.ok(v2>old*2.0,JSON.stringify({old,v2}));
 assert.ok(metrics.candidate.contactHorizontalBootVsPlantedToeUnits>
    metrics.baseline.contactHorizontalBootVsPlantedToeUnits);
 assert.ok(metrics.candidate.maxLeftToeJoint3dDriftSourceUnits < 0.002);
});
test("64 genuine original Silver Blender subframe renders, immutable server timing",()=>{
 assert.equal(bake.spartanHighForwardRevisionOptIn,true);
 assert.equal(bake.spartanHighKneeKickOptIn,true);
 assert.deepEqual(bake.authoritativePhases.kickMs,[90,70,220]);
 assert.equal(bake.originalArtReplaced,false);
 assert.equal(bake.serverRootTranslation??false,false);
 assert.equal(bake.trueServerEvent,false);
 assert.equal(bake.realGreyhaven,false);
 assert.equal(bake.humanVisualApproved,false);
 const frames=bake.rendered.filter(x=>x.clip==="silver_kick_p0");
 assert.equal(frames.length,64);
 const sampled=[1,3.7,6.4,8.5,10.6,13.5,18,23.8];
 for(let d=0;d<8;d++){
  const row=frames.filter(x=>x.direction===d).sort((a,b)=>a.phase-b.phase);
  assert.equal(row.length,8);
  assert.deepEqual(row.map(x=>x.sourceFrame),sampled);
  assert.deepEqual(row.map(x=>x.sampledBlenderFrame),sampled);
 }
 const py=bytes("tools/art/author_silver_kick_dash_p0.py").toString("utf8");
 assert.match(py,/--spartan-high-forward/);
 assert.match(py,/spartaHighChamberV2/);
 assert.match(py,/spartaFullContactV2/);
 assert.match(py,/args\.plant_kick/);
});
test("all eight genuine source atlases and GIF are SHA pinned, 380ms, source only",()=>{
 assert.equal(manifest.priorSpartan602KickAtlasSha256,sha("docs/art/silver-spartan-kick-p0/silver_spartan_kick_p0.webp"));
 assert.equal(manifest.newHighForwardKickAtlasSha256,sha(dir+"silver_spartan_high_forward_p0.webp"));
 assert.equal(manifest.highForwardComparisonGifSha256,sha(dir+"silver_spartan_602_vs_high_forward_8way_380ms.gif"));
 assert.equal(manifest.sourceDrawCount,64);
 assert.equal(manifest.directionCount,8);
 assert.equal(manifest.sourceFramesPerFacing,8);
 assert.deepEqual(manifest.sourceFramePx,[160,160]);
 assert.equal(manifest.kickVisualBudgetMs,380);
 assert.equal(manifest.timingsMs.reduce((a,b)=>a+b,0),380);
 assert.ok(manifest.pixelChangesPerFacing.every(n=>n>350));
 assert.equal(manifest.gameplayEnabled,false);
 assert.equal(manifest.verifiedRealGround,false);
 assert.equal(manifest.approvedHumanVisual,false);
 assert.equal(bytes(dir+"silver_spartan_high_forward_p0.webp").toString("ascii",0,4),"RIFF");
 assert.equal(bytes(dir+"silver_spartan_602_vs_high_forward_8way_380ms.gif").toString("ascii",0,4),"GIF8");
 const blend=bytes(dir+"Graphics3A_Silver_Spartan_Higher_Forward_Kick_source.blend");
 assert.ok(blend.toString("ascii",0,7)==="BLENDER" ||
  blend.subarray(0,4).equals(Buffer.from([0x28,0xb5,0x2f,0xfd])));
});
test("authentic browser preview remains explicitly not playable, not actual contact",()=>{
 const html=bytes("web/silver-spartan-high-forward-p0-review.html").toString("utf8");
 const js=bytes("web/silver-spartan-high-forward-p0-review.mjs").toString("utf8");
 assert.match(html,/VISUAL HOLD/);
 assert.match(js,/__GRAPHICS3A_SPARTAN_HIGH_FORWARD_QA__/);
 assert.match(js,/silver_spartan_high_forward_p0\.webp/);
 assert.match(js,/realGreyhaven:false/);
 assert.match(js,/realCombat:false/);
 assert.match(js,/humanApproved:false/);
});
