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
 assert.equal(r.genuineW3cSilverJumpVerified,true,
   "source-backed actual W3C Space jump must be demonstrated in the browser");
 assert.equal(r.genuineW3cJump?.browser,engines[0]);
 assert.equal(r.genuineW3cJump?.actorId,1);
 assert.equal(r.genuineW3cJump?.key,"Space");
 for(const field of ["before","after","draws"])
  assert.ok(Number.isInteger(r.genuineW3cJump[field])&&r.genuineW3cJump[field]>=0,
    "actual original Silver Jump source count must be a nonnegative integer");
 assert.equal(r.genuineW3cJump.draws,r.genuineW3cJump.after-r.genuineW3cJump.before,
   "Jump report must provide true source-atlas drawImage deltas");
 assert.ok(r.genuineW3cJump.draws>=3,
   "real Space gesture must draw the original Blender Silver Jump atlas");
 assert.equal(r.genuineW3cSilverRollVerified,true,
   "real browser-native negative wheel must show original Silver Roll atlas");
 assert.equal(r.genuineW3cRoll?.browser,engines[0]);
 assert.equal(r.genuineW3cRoll?.actorId,1);
 assert.equal(r.genuineW3cRoll?.wheelDeltaY,-120);
 assert.equal(r.genuineW3cRoll?.atlas,"silver_roll.webp",
   "original Roll source intentionally uses untouched native WebP, not fabricated relit");
 for(const key of ["before","after","draws"])
  assert.ok(Number.isInteger(r.genuineW3cRoll[key])&&r.genuineW3cRoll[key]>=0,
    "original Roll counts must be authentic nonnegative integers");
 assert.equal(r.genuineW3cRoll.draws,r.genuineW3cRoll.after-r.genuineW3cRoll.before);
 assert.ok(r.genuineW3cRoll.draws>=3,
   "negative wheel must generate new genuine Silver Roll drawImage calls");
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
 const expectedAdvisory={
  callbackThresholdMs:33,renderDebtThresholdMs:33,
  callbackOverBudget:r.trials.filter(t=>t.data.frameIntervalP95Ms>33).map(t=>({
   browser:t.browser,actorId:t.actorId,p95Ms:t.data.frameIntervalP95Ms})),
  renderDebtOverBudget:r.trials.filter(t=>t.data.presentationDebtP95Ms>33).map(t=>({
   browser:t.browser,actorId:t.actorId,p95Ms:t.data.presentationDebtP95Ms})),
  gpuPresentQualified:false,independentPhysicalHosts:false,performanceReleaseGo:false,
 };
 assert.deepEqual(r.performanceAdvisory,expectedAdvisory,
  "genuine callback and render-gap performance holds must not be omitted or overwritten");
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
  // Independently reparse original game text so a future QA report cannot
  // replace measured transport/snapshot fields with invented zero values.
  const observed=t.data.diagnosticsText;
  const timeValue="(collecting…|\\d+ms)";
  const ak=observed.match(new RegExp("Input→ACK p50\\s+"+timeValue+"\\s*·\\s*p95\\s+"+timeValue));
  const ji=observed.match(new RegExp("Jitter p95\\s+"+timeValue));
  const sn=observed.match(new RegExp("Snapshots p50\\s+"+timeValue+"\\s*·\\s*p95\\s+"+timeValue));
  const sample=observed.match(/\|\s+Samples\s+(\d+)(?:\s*\||$)/);
  assert.ok(ak&&ji&&sn&&sample,"original HUD co-sample requires genuine network telemetry");
  const observedMs=s=>s==="collecting…"?null:Number(s.slice(0,-2));
  assert.deepEqual(t.data.networkUiCoSample,{
   inputAckP50Ms:observedMs(ak[1]),inputAckP95Ms:observedMs(ak[2]),
   ackJitterP95Ms:observedMs(ji[1]),
   snapshotGapP50Ms:observedMs(sn[1]),snapshotGapP95Ms:observedMs(sn[2]),
   inputAckSamples:Number(sample[1]),
   source:"original?netstats=1",timeAlignedCausality:false,gpuPresentQualified:false,
  },"network observations must match unchanged original HUD text");
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
// Nonrelease advisory remains a HOLD even when the original graphics evidence is green.
const observedOverBudget=[
 ...two.performanceAdvisory.callbackOverBudget.map(x=>({worldSeats:2,metric:"callbackP95",...x})),
 ...two.performanceAdvisory.renderDebtOverBudget.map(x=>({worldSeats:2,metric:"renderDebtP95",...x})),
 ...four.performanceAdvisory.callbackOverBudget.map(x=>({worldSeats:4,metric:"callbackP95",...x})),
 ...four.performanceAdvisory.renderDebtOverBudget.map(x=>({worldSeats:4,metric:"renderDebtP95",...x})),
];
console.log("GRAPHICS3C_PERFORMANCE_RELEASE_HOLD "+JSON.stringify({
 exactHead:checkedOutHead,thresholdMs:33,observedOverBudget,
 gpuPresentQualified:false,independentPhysicalHosts:false,performanceReleaseGo:false,
 networkUiCoSamples:[
  ...two.trials.map(t=>({worldSeats:2,browser:t.browser,actorId:t.actorId,
   frameCallbackP95Ms:t.data.frameIntervalP95Ms,
   extraRenderGapP95Ms:t.data.presentationDebtP95Ms,
   ...t.data.networkUiCoSample})),
  ...four.trials.map(t=>({worldSeats:4,browser:t.browser,actorId:t.actorId,
   frameCallbackP95Ms:t.data.frameIntervalP95Ms,
   extraRenderGapP95Ms:t.data.presentationDebtP95Ms,
   ...t.data.networkUiCoSample})),
 ],
}));
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
