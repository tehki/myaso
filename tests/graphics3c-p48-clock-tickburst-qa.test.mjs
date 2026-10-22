import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {NETWORK} from "../src/network/constants.mjs";
import {createSnapshotRenderClock} from "../src/browser/smooth-motion.mjs";
import {createRenderGapTelemetry} from "../src/browser/render-gap-telemetry.mjs";
const root=new URL("../",import.meta.url);
const report=JSON.parse(readFileSync(new URL(
 "assets/environment/greyhaven/3c-p48-renderclock-tickburst-qa/original-clock-synthetic-burst-linux.json",root),"utf8"));
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
test("P48 original clock and HUD source remain precisely pinned; no source modification",()=>{
 assert.equal(report.exactParent,"46b63e172c24fd3be4333a4ac52a5ccac95059b6");
 assert.equal(report.pureOriginalClock,true);
 assert.equal(report.syntheticNotRealTraffic,true);
 assert.equal(report.notGPUPresentedFrameTimes,true);
 for(const [file,hash] of Object.entries(report.sourceHashes)){
  assert.equal(sha(readFileSync(new URL(file,root))),hash,"Original source drift: "+file);
 }
 assert.equal(typeof createSnapshotRenderClock,"function");
 assert.equal(typeof createRenderGapTelemetry,"function");
 assert.equal(NETWORK.serverSimulationHz,60);
 assert.equal(NETWORK.reconciliation.remoteInterpolationMs,90);
 assert.equal(NETWORK.reconciliation.maxRemoteExtrapolationMs,100);
 const harness=readFileSync(new URL("tools/art/probe_p48_renderclock_tick_burst_qa.mjs",root),"utf8");
 assert.match(harness,/createSnapshotRenderClock\(\)/);
 assert.match(harness,/createRenderGapTelemetry\(\)/);
 assert.match(harness,/sourceHashes:hashes/);
 assert.match(harness,/noSimulationOfBrowserWork:true/);
 assert.doesNotMatch(readFileSync(new URL("web/online-game.mjs",root),"utf8"),/probe_p48_renderclock_tick_burst_qa/);
});
test("P48 uses regular 60Hz sample calls, 20Hz synthetic snapshots and original 100ms HUD telemetry",()=>{
 const a=report.assumptions;
 assert.equal(a.serverSimulationHz,60);
 assert.equal(a.remoteInterpolationMs,90);
 assert.equal(a.remoteExtrapolationCapMs,100);
 assert.equal(a.frameMs,1000/60);
 assert.equal(a.frames,600);
 assert.equal(a.packetCadenceFrames,3);
 assert.equal(a.noSimulationOfBrowserWork,true);
 assert.equal(a.measurementsSampledEveryMs,100);
 assert.deepEqual(report.runs.map(x=>x.freezeFrames),[0,6,24,30]);
 assert.deepEqual(report.runs.map(x=>x.name),[
  "regular-20hz-packet-arrival",
  "short-100ms-gap-then-catchup",
  "burst-400ms-gap-then-catchup",
  "burst-500ms-gap-then-catchup"
 ]);
 for(const run of report.runs){
  assert.equal(run.frameCount,600);
  assert.equal(run.frameIntervalsMs,1000/60);
  assert.ok(run.observedSamples.length>=95);
  assert.ok(run.finalHUDSnapshot.samples>=95);
  assert.ok(run.ingressTrace.length>40);
  assert.ok(run.ingressTrace.every(s=>Number.isFinite(s.atMs)
   &&Number.isFinite(s.targetDebtMs)&&Number.isInteger(s.authoritativeTick)));
 }
});
test("P48 original bounded catch-up reproduces HUD lag with no skipped synthetic frames",()=>{
 const [regular,short,long,longer]=report.runs;
 assert.equal(regular.maxPresentationDebtMs,0);
 assert.equal(regular.finalHUDSnapshot.p95Ms,0);
 assert.equal(regular.finalBoundedCatchups,0);
 assert.ok(short.maxPresentationDebtMs>0&&short.maxPresentationDebtMs<40);
 assert.equal(short.finalHUDSnapshot.p95Ms,0);
 assert.equal(long.maxPresentationDebtMs,325.833);
 assert.equal(long.finalHUDSnapshot.p95Ms,138.3);
 assert.ok(long.framesWithDebtOver200Ms>5);
 assert.equal(longer.maxPresentationDebtMs,425.833);
 assert.equal(longer.finalHUDSnapshot.p95Ms,238.3);
 assert.ok(longer.framesWithDebtOver200Ms>long.framesWithDebtOver200Ms);
 assert.ok(longer.finalBoundedCatchups>long.finalBoundedCatchups);
 assert.ok(longer.maxPresentationDebtMs>longer.finalHUDSnapshot.p95Ms);
});
