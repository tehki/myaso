// P0 original-grid-only actual Silver evidence: no preview or synthetic actors.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const [twoDir,fourDir]=process.argv.slice(2);
assert.ok(twoDir&&fourDir,"genuine independent 2-seat and 4-seat Rust/browser reports required");
const hash=b=>createHash("sha256").update(b).digest("hex");
const engines=(process.env.MYASO_KNIGHTS_NATIVE_BROWSERS||"chrome,firefox,chrome,firefox").split(",");
function validate(path,players){
 const r=JSON.parse(readFileSync(join(path,"main0-knights-original-game-native.json"),"utf8"));
 assert.equal(r.actualRustWebTransport,true);
 assert.equal(r.actualOriginalClient,true);
 assert.equal(r.realSeparateNativeBrowserProcesses,players);
 assert.equal(r.independentPhysicalHumanHosts,false);
 assert.equal(r.authenticSilverKnightIntegrationVerified,true);
 assert.equal(r.genuineW3cSilverLocomotionVerified,true,
   "source-backed W3C movement must be demonstrated in the actual browser");
 assert.equal(r.genuineW3cLocomotion?.browser,engines[0]);
 assert.equal(r.genuineW3cLocomotion?.actorId,1);
 assert.equal(r.genuineW3cLocomotion?.key,"KeyD");
 for(const clipCount of ["walk","sprint"])
  assert.ok(Number.isInteger(r.genuineW3cLocomotion[clipCount])
    && r.genuineW3cLocomotion[clipCount]>=0,"trustworthy nonnegative source locomotion clip count");
 assert.ok(r.genuineW3cLocomotion.walk+r.genuineW3cLocomotion.sprint>=8,
   "the actual 2/4-seat browser must draw original relit walk or sprint WebP");
 assert.equal(r.allFiveClipsVisuallyValidated,false);
 assert.equal(r.trueFourIndependentHumanOperators,false);
 assert.equal(r.modeIsOptional,false);
 assert.equal(r.defaultArenaPreserved,true);
 assert.equal(r.optionalTerrainEnabled,false);
 assert.equal(r.genuineFullCombatApproval,false);
 assert.equal(r.includesGpuPresentLatency,false);
 assert.equal(r.presentationClockDebtSampled,true);
 assert.equal(r.browserFrameTimingIsCallbackNotGpu,true);
 assert.equal(r.trials.length,players);
 for(let i=0;i<players;i++){
  const t=r.trials[i];
  assert.equal(t.actorId,i+1);
  assert.equal(t.mode,"grid","Pre-Alpha must use unchanged original grid only");
  assert.equal(t.browser,engines[i]);
  assert.equal(t.data.canvasWidth,960);
  assert.equal(t.data.canvasHeight,540);
  assert.equal(t.data.knightsFlag,"1");
  assert.equal(t.data.knightArt,"relit");
  assert.ok(t.data.frames>=12);
  assert.ok(t.data.roster.length>=players);
  assert.ok(t.data.knightWebPDraws>=8);
  assert.ok(Object.keys(t.data.knightSources).some(x=>/^silver_.*_relit\.webp$/.test(x)));
  for(const metric of ["frameIntervalP50Ms","frameIntervalP95Ms","floorBlitDurationP50Ms","floorBlitDurationP95Ms"]){
   assert.ok(Number.isFinite(t.data[metric])&&t.data[metric]>=0,metric);
  }
  assert.ok(t.data.frameIntervalP95Ms>=t.data.frameIntervalP50Ms);
  assert.ok(t.data.floorBlitDurationP95Ms>=t.data.floorBlitDurationP50Ms);
  assert.ok(t.data.floorBlitSampleCount>=12);
  assert.ok(t.data.presentationDebtSamples>=12,"genuine display diagnostics original render-gap sample count");
  assert.ok(Number.isInteger(t.data.presentationDebtP50Ms)&&t.data.presentationDebtP50Ms>=0);
  assert.ok(Number.isInteger(t.data.presentationDebtP95Ms)&&t.data.presentationDebtP95Ms>=t.data.presentationDebtP50Ms);
  assert.ok(Number.isInteger(t.data.presentationBoundedCatchups)&&t.data.presentationBoundedCatchups>=0);
  assert.ok(t.data.diagnosticsText.includes("Render catch-ups")&&t.data.diagnosticsText.includes("Extra render lag p50"));
  const full=readFileSync(join(path,t.fullCanvasScreenshot));
  assert.equal(full.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(full.readUInt32BE(16),960);
  assert.equal(full.readUInt32BE(20),540);
  assert.equal(full.length,t.fullCanvasBytes);
  assert.equal(hash(full),t.fullCanvasSha256);
  const page=readFileSync(join(path,t.screenshot));
  assert.equal(hash(page),t.pngSha256);
 }
 return r;
}
const two=validate(twoDir,2),four=validate(fourDir,4);
assert.equal(two.sourceCommit,four.sourceCommit,"different source hashes cannot be combined");
const checkedOutHead=execFileSync("git",["-C",fileURLToPath(new URL("../../",import.meta.url)),"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.match(checkedOutHead,/^[0-9a-f]{40}$/,"strict native QA requires an actual Git source head");
assert.equal(two.sourceCommit,checkedOutHead,"native screenshots must be captured from the exact checked-out source SHA");
console.log("GRAPHICS3C_P0_REAL_GRID_FULL_CANVAS_PASS "+JSON.stringify({
 exactHead:two.sourceCommit,sessions:6,worlds:2,engines,realSilver:true,optionalTerrain:false,
 independentHumans:false,gpuPresent:false,presentationClockDebtSampled:true,
 trials:[...two.trials,...four.trials].map(t=>({
  browser:t.browser,mode:t.mode,actor:t.actorId,frames:t.data.frames,
  frameP50Ms:t.data.frameIntervalP50Ms,frameP95Ms:t.data.frameIntervalP95Ms,
  floorBlitP50Ms:t.data.floorBlitDurationP50Ms,
  floorBlitP95Ms:t.data.floorBlitDurationP95Ms,
  presentationDebtP50Ms:t.data.presentationDebtP50Ms,
  presentationDebtP95Ms:t.data.presentationDebtP95Ms,
  presentationCatchUps:t.data.presentationBoundedCatchups,
  imageSha256:t.fullCanvasSha256
 }))}));
