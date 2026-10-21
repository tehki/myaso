import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const string=p=>read(p).toString("utf8");
const doc=p=>JSON.parse(string(p));
const dir="docs/art/silver-spartan-kick-p0/";
const report=doc(dir+"source_kinematics.json");
const atlasReport=doc(dir+"spartan_blender_bake_report.json");
const manifest=doc(dir+"spartan_kick_art_manifest.json");
const sha=p=>createHash("sha256").update(read(p)).digest("hex");

test("Spartan kick truly high-chambers original right knee and extends heel forward",()=>{
 assert.equal(report.originalOwnerRig,true);
 assert.deepEqual(report.authoritativeKickPhaseMs,[90,70,220]);
 assert.equal(report.realWorldFloorVerified,false);
 assert.equal(report.impactDamageVerified,false);
 assert.equal(report.realPvPVerified,false);
 assert.ok(report.candidateKneeLift>report.previousKneeLift*1.5,
  "real right knee should rise substantially above previous authored kick");
 assert.ok(report.candidateContactBootHorizontalFromHips>report.previousContactBootHorizontalFromHips,
  "original right boot should project farther forward at contact");
 assert.ok(report.candidateSupportToeMaxSourceDrift<0.002,
  "source toe anchor must remain stable; does not certify the real sole contact");
});
test("all 64 authored Blender original Silver frames, authentic fraction times, immutable Combat",()=>{
 assert.equal(atlasReport.spartanHighKneeKickOptIn,true);
 assert.deepEqual(atlasReport.authoritativePhases.kickMs,[90,70,220]);
 assert.equal(atlasReport.originalArtReplaced,false);
 assert.equal(atlasReport.worldGroundValidated,false);
 assert.equal(atlasReport.humanVisualApproved,false);
 assert.equal(atlasReport.trueServerEvent,false);
 const keys=[1,3.7,6.4,8.5,10.6,13.5,18,23.8];
 const frames=atlasReport.rendered.filter(x=>x.clip==="silver_kick_p0");
 assert.equal(frames.length,64);
 for(let facing=0;facing<8;facing++){
  const clip=frames.filter(x=>x.direction===facing).sort((a,b)=>a.phase-b.phase);
  assert.deepEqual(clip.map(x=>x.sourceFrame),keys);
  assert.deepEqual(clip.map(x=>x.sampledBlenderFrame),keys);
 }
 const source=string("tools/art/author_silver_kick_dash_p0.py");
 assert.match(source,/--spartan-kick/);
 assert.match(source,/spartaHigh/);
 assert.match(source,/spartaContact/);
 assert.match(source,/args\.plant_kick/);
 assert.match(source,/sc\.frame_set\(int\(fr\),subframe=fr-int\(fr\)\)/);
});
test("actual comparison WebP, eight-way loop GIF, and original source remain byte-pinned",()=>{
 assert.equal(manifest.priorPlantedKickAtlasSha256,sha("docs/art/silver-kick-grounding-p0/silver_kick_planted_p0.webp"));
 assert.equal(manifest.newSpartanKickAtlasSha256,sha(dir+"silver_spartan_kick_p0.webp"));
 assert.equal(manifest.spartanComparisonGifSha256,sha(dir+"silver_kick_grounded_vs_spartan_8way_380ms.gif"));
 assert.equal(manifest.sourceDrawCount,64);
 assert.equal(manifest.directionCount,8);
 assert.equal(manifest.sourceFramesPerFacing,8);
 assert.deepEqual(manifest.sourceFramePx,[160,160]);
 assert.equal(manifest.kickVisualBudgetMs,380);
 assert.equal(manifest.timingsMs.reduce((a,b)=>a+b,0),380);
 assert.equal(manifest.gameplayEnabled,false);
 assert.equal(manifest.verifiedRealGround,false);
 assert.equal(manifest.approvedHumanVisual,false);
 assert.ok(manifest.pixelChangesPerFacing.every(n=>n>350));
 assert.equal(read(dir+"silver_spartan_kick_p0.webp").toString("ascii",0,4),"RIFF");
 assert.equal(read(dir+"silver_kick_grounded_vs_spartan_8way_380ms.gif").toString("ascii",0,4),"GIF8");
 const blend=read(dir+"Graphics3A_Silver_Spartan_Power_Kick_action_source.blend");
 assert.ok(blend.toString("ascii",0,7)==="BLENDER" || blend.subarray(0,4).equals(Buffer.from([0x28,0xb5,0x2f,0xfd])), "Blender 5.2 action-only source may be zstd-compressed; independently reopened by Blender source audit");
});
test("separate original-art review never claims a real committed hit or player-world integration",()=>{
 const html=string("web/silver-spartan-kick-p0-review.html");
 const js=string("web/silver-spartan-kick-p0-review.mjs");
 assert.match(html,/VISUAL HOLD/);
 assert.match(js,/__GRAPHICS3A_SPARTAN_KICK_QA__/);
 assert.match(js,/silver_spartan_kick_p0\.webp/);
 assert.match(js,/realGreyhaven:false/);
 assert.match(js,/realCombat:false/);
 assert.match(js,/humanApproved:false/);
 assert.doesNotMatch(js,/online-game\.mjs/);
});
