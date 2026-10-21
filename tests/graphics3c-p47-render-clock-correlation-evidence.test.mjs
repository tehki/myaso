import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const prefix="assets/environment/greyhaven/3c-p47-raf-longtask-qa/";
const files=["four-trial-a-local-chromium.json","four-trial-b-local-chromium.json","four-trial-c-local-chromium.json"];
const reports=files.map(f=>JSON.parse(readFileSync(new URL(prefix+f,root),"utf8")));

for(let k=0;k<reports.length;k++){
 test("P47 four genuine WebTransport Chrome sessions and main-thread stall trace "+files[k],()=>{
  const x=reports[k];
  assert.equal(x.sourceHead,"f08b627318f0e5998b827779a1ac24cb49c45bc8");
  assert.equal(x.clientsRequested,4);
  assert.equal(x.measureMs,9000);
  assert.equal(x.browsersIndependentHosts,false);
  assert.equal(x.serverAuthoritative,true);
  assert.equal(x.worldFlag,true);
  assert.equal(x.host,"127.0.0.1");
  assert.deepEqual(x.errors,[]);
  assert.equal(x.results.length,4);
  assert.ok(!Object.hasOwn(x,"serverLogTail"),"No ephemeral server tokens/certs in evidence");
  assert.deepEqual(x.serverSummary.admittedPlayerIds,[1,2,3,4]);
  assert.equal(x.serverSummary.endpointLoopback,true);
  for(const [i,r] of x.results.entries()){
   assert.equal(r.index,i+1);
   assert.deepEqual(r.errors,[]);
   const m=r.measurement;
   assert.match(m.status,new RegExp("^Online - player #"+(i+1)+" - server tick [0-9]+$"));
   assert.equal(m.opaqueCanvas,true);
   assert.equal(m.documentHidden,false);
   assert.deepEqual(m.scoreboard,["#10","#20","#30","#40"]);
   assert.ok(m.actualGameFrameSamples>=500);
   assert.ok(m.rAFSamples>=500);
   assert.ok(m.tileCanvasDrawCalls>1000);
   assert.equal(m.worldTileBlitCalls,m.tileCanvasDrawCalls);
   assert.equal(m.longTaskObserverStatus,"observing");
   assert.equal(m.observedLongTaskCount,0);
   assert.equal(m.actualGameFrameGapOver33,0);
   assert.equal(m.actualGameFrameGapOver50,0);
   assert.equal(m.actualGameFrameGapOver100,0);
   assert.equal(m.severeFrameGapsWithoutTaskOverlap,0);
   assert.equal(m.severeFrameGapsWithTaskOverlap,0);
   assert.deepEqual(m.topFrameGaps,[]);
   assert.ok(m.actualGameFrameP95Ms>0&&m.actualGameFrameP95Ms<=3);
   assert.ok(m.actualGameFrameMaxMs>=m.actualGameFrameP95Ms);
   assert.match(m.diagnostics,/Input→ACK p50/);
   assert.match(m.diagnostics,/Extra render lag p50/);
  }
 });
}

test("P47 persistent >200ms render-clock debt despite zero main-thread/RAF stall events",()=>{
 const trial=reports[2].results[2].measurement;
 assert.equal(trial.actualGameFrameGapOver33,0);
 assert.equal(trial.observedLongTaskCount,0);
 assert.equal(trial.actualGameFrameP95Ms,2.5);
 assert.ok(trial.actualGameFrameMaxMs<5);
 assert.match(trial.diagnostics,/Extra render lag p50 0ms · p95 223ms/);
 assert.match(trial.diagnostics,/Input→ACK p50 44ms · p95 45ms/);
});

test("P47 only instruments original game/browser in localhost; render-gap p95 means presentation-clock debt",()=>{
 const harness=readFileSync(new URL("tools/art/probe_p47_raf_longtask_correlation_browser.mjs",root),"utf8");
 const game=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 const clock=readFileSync(new URL("src/browser/smooth-motion.mjs",root),"utf8");
 const telemetry=readFileSync(new URL("src/browser/render-gap-telemetry.mjs",root),"utf8");
 assert.match(harness,/sourcePin="f08b627318f0e5998b827779a1ac24cb49c45bc8"/);
 assert.match(harness,/runtimeSourceDiff/);
 assert.match(harness,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(harness,/callback\.name==="frame"/);
 assert.match(harness,/PerformanceObserver\(list=>/);
 assert.match(harness,/observer\.observe\(\{type:"longtask",buffered:true\}\)/);
 assert.match(harness,/severeFrameGapsWithTaskOverlap/);
 assert.match(harness,/actualGameFrameGapOver33/);
 assert.doesNotMatch(game,/probe_p47_raf_longtask_correlation_browser/);
 assert.match(game,/snapshotRenderClock\.sample\(networkClient\.latestServerTick, nowMs\)/);
 assert.match(game,/snapshotRenderClock\.metrics\(\)\.targetGapTicks/);
 assert.match(clock,/maxCatchUpRate = 1\.45/);
 assert.match(clock,/maxFrameStepMs = 50/);
 assert.match(clock,/targetGapTicks = Math\.max\(0, proposed - result\)/);
 assert.match(telemetry,/const gapMs = targetGapTicks \/ serverHz \* 1000/);
 assert.match(telemetry,/sampleIntervalMs = 100/);
});
