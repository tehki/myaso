#!/usr/bin/env node
// P48: bounded deterministic ORIGINAL source render-only clock + HUD telemetry
// reproduction. This is synthetic tick ingress, NOT observed network packets,
// actual GPU presentation, a Combat fix or an approved catch-up change.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {createSnapshotRenderClock} from "../../src/browser/smooth-motion.mjs";
import {createRenderGapTelemetry} from "../../src/browser/render-gap-telemetry.mjs";
import {NETWORK} from "../../src/network/constants.mjs";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const base="46b63e172c24fd3be4333a4ac52a5ccac95059b6";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",base,"HEAD"]);
const frozenRuntimePaths=["src/browser/smooth-motion.mjs","src/browser/render-gap-telemetry.mjs",
 "src/network/constants.mjs","web/online-game.mjs","src/browser/authored-world-renderer.mjs",
 "src/world/authored-maps.mjs","server"];
const changed=execFileSync("git",["-C",root,"diff","--name-only",base,"HEAD","--",...frozenRuntimePaths],{encoding:"utf8"}).trim();
assert.equal(changed,"","Source truth is exact P47; this child may not modify renderer, telemetry, authority or server");
assert.equal(NETWORK.serverSimulationHz,60);
assert.equal(NETWORK.reconciliation.remoteInterpolationMs,90);
assert.equal(NETWORK.reconciliation.maxRemoteExtrapolationMs,100);
const hashes={};
for(const f of frozenRuntimePaths.slice(0,6)){
 hashes[f]=createHash("sha256").update(await readFile(resolve(root,f))).digest("hex");
}
const frameMs=1000/60, frames=600, baseTick=6000, burstStart=180, burstFrames=24;
const scenarios=[
 {name:"regular-20hz-packet-arrival",pauseFrames:0},
 {name:"short-100ms-gap-then-catchup",pauseFrames:6},
 {name:"burst-400ms-gap-then-catchup",pauseFrames:burstFrames},
 {name:"burst-500ms-gap-then-catchup",pauseFrames:30},
];
const output={type:"P48 original production source render-clock catch-up after synthetic packet stalls",
 exactParent:base,pureOriginalClock:true,syntheticNotRealTraffic:true,notGPUPresentedFrameTimes:true,
 assumptions:{serverSimulationHz:NETWORK.serverSimulationHz,
  remoteInterpolationMs:NETWORK.reconciliation.remoteInterpolationMs,
  remoteExtrapolationCapMs:NETWORK.reconciliation.maxRemoteExtrapolationMs,
  frames,frameMs,initialAuthoritativeTick:baseTick,
  freezeStartFrame:burstStart,packetCadenceFrames:3,
  noSimulationOfBrowserWork:true,measurementsSampledEveryMs:100},
 sourceHashes:hashes,runs:[]};
function latestTickForFrame(i,freezeFrames){
 const heldAt=Math.floor((burstStart-1)/3)*3;
 const normal=baseTick+3*Math.floor(i/3);
 return freezeFrames>0&&i>=burstStart&&i<burstStart+freezeFrames
  ?baseTick+heldAt:normal;
}
for(const scenario of scenarios){
 const clock=createSnapshotRenderClock(),telemetry=createRenderGapTelemetry();
 const framesInfo=[],observedSamples=[];
 let previousRendered=null;
 for(let i=0;i<frames;i++){
  const nowMs=i*frameMs;
  const latestTick=latestTickForFrame(i,scenario.pauseFrames);
  const rendered=clock.sample(latestTick,nowMs);
  const m=clock.metrics();
  assert.ok(Number.isFinite(rendered));
  assert.ok(previousRendered===null||rendered>=previousRendered-1e-9,
   "Visual clock may not move backward");
  previousRendered=rendered;
  const debtMs=m.targetGapTicks/NETWORK.serverSimulationHz*1000;
  const sampled=telemetry.noteFrame(nowMs,m.targetGapTicks,NETWORK.serverSimulationHz);
  if(sampled)observedSamples.push({frame:i,atMs:+nowMs.toFixed(2),debtMs:+debtMs.toFixed(3)});
  framesInfo.push({
   i,atMs:+nowMs.toFixed(3),authoritativeTick:latestTick,
   renderedTick:+rendered.toFixed(5),
   targetGapTicks:+m.targetGapTicks.toFixed(5),
   targetDebtMs:+debtMs.toFixed(3),sampled,
   boundedCatchups:m.boundedCatchups
  });
 }
 const snapshot=telemetry.snapshot();
 const peak=Math.max(...framesInfo.map(x=>x.targetDebtMs));
 const nearPeak=framesInfo.filter(x=>x.targetDebtMs>200).length;
 output.runs.push({
  name:scenario.name,freezeFrames:scenario.pauseFrames,
  frozenDurationMs:+(scenario.pauseFrames*frameMs).toFixed(3),
  frameIntervalsMs:frameMs,frameCount:frames,
  injectedTickIntervalCadence:"once every 3 frames (20Hz)",
  finalHUDSnapshot:snapshot,maxPresentationDebtMs:+peak.toFixed(3),
  framesWithDebtOver200Ms:nearPeak,
  finalBoundedCatchups:clock.metrics().boundedCatchups,
  observedSamples,
  // bounded window around actual synthetic ingress discontinuity,
  // plus representative later samples. 600 x 9K full frame traces avoided.
  ingressTrace:framesInfo.slice(burstStart-5,burstStart+scenario.pauseFrames+50),
  lastFrame:framesInfo.at(-1)
 });
}
const baseResult=output.runs[0],short=output.runs[1],long=output.runs[2],longer=output.runs[3];
assert.ok(baseResult.maxPresentationDebtMs<40);
assert.ok(long.maxPresentationDebtMs>200,"Burst must generate 200+ ms target debt");
assert.ok(long.framesWithDebtOver200Ms>5);
assert.ok(long.finalBoundedCatchups>baseResult.finalBoundedCatchups);
assert.ok(longer.maxPresentationDebtMs>long.maxPresentationDebtMs);
assert.ok(longer.finalHUDSnapshot.p95Ms>long.finalHUDSnapshot.p95Ms);
const out=resolve(process.argv[2]||"p48_original_presentation_clock.json");
await mkdir(dirname(out),{recursive:true});
await writeFile(out,JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({
 scenario:output.runs.map(x=>({name:x.name,maxDebt:x.maxPresentationDebtMs,
  debtFrames200:x.framesWithDebtOver200Ms,hudP95:x.finalHUDSnapshot.p95Ms,
  boundedCatchups:x.finalBoundedCatchups})),report:out}));
