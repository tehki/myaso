// P0 original-grid-only actual Silver evidence: no preview or synthetic actors.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
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
 assert.equal(r.allFiveClipsVisuallyValidated,false);
 assert.equal(r.trueFourIndependentHumanOperators,false);
 assert.equal(r.modeIsOptional,false);
 assert.equal(r.defaultArenaPreserved,true);
 assert.equal(r.optionalTerrainEnabled,false);
 assert.equal(r.genuineFullCombatApproval,false);
 assert.equal(r.includesGpuPresentLatency,false);
 assert.equal(r.presentationClockDebtSampled,false);
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
console.log("GRAPHICS3C_P0_REAL_GRID_FULL_CANVAS_PASS "+JSON.stringify({
 exactHead:two.sourceCommit,sessions:6,worlds:2,engines,realSilver:true,optionalTerrain:false,
 independentHumans:false,gpuPresent:false,presentationClockDebtSampled:false,
 trials:[...two.trials,...four.trials].map(t=>({
  browser:t.browser,mode:t.mode,actor:t.actorId,frames:t.data.frames,
  frameP50Ms:t.data.frameIntervalP50Ms,frameP95Ms:t.data.frameIntervalP95Ms,
  floorBlitP50Ms:t.data.floorBlitDurationP50Ms,
  floorBlitP95Ms:t.data.floorBlitDurationP95Ms,
  imageSha256:t.fullCanvasSha256
 }))}));
