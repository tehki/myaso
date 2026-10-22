import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const report=JSON.parse(readFileSync(new URL(
 "assets/environment/greyhaven/3c-p52-real-tick-jump-triage/p52-three-four-client-trials.json",root),"utf8"));

test("P52 provenance: three genuine independent localhost Rust/WebTransport/4×Chromium trials",()=>{
 assert.equal(report.sourceParent,"10183d131ea10f3f21a2647120f19a72debbf5b2");
 assert.equal(report.qaOnly,true);
 assert.equal(report.realPacketsNotSynthetic,true);
 assert.equal(report.productionSourceChanged,false);
 assert.equal(report.stagedServerIsInstrumented,true);
 assert.equal(report.browserResponseInstrumented,true);
 assert.equal(report.serverAndBrowsersOnePhysicalHost,true);
 assert.equal(report.noGpuPresentTiming,true);
 assert.equal(report.runs.length,3);
 for(const run of report.runs){
  assert.equal(run.measuredMs,15000);
  assert.equal(run.clients.length,4);
  assert.ok(run.serverSimulationRefreshTicks>=400);
  assert.deepEqual(Object.keys(run.simulationRefreshStepHistogram),["3"]);
  assert.deepEqual(run.clients.map(x=>x.authPlayerId),[1,2,3,4]);
  for(const c of run.clients){
   assert.ok(c.received>=300);
   assert.equal(c.matchedAcceptedToServerSends,c.received);
   assert.equal(c.unmatchedAccepted,0);
   assert.ok(c.serverSentInAlignedWindow>=c.received);
   assert.ok(c.maxServerSendGapMs<60);
   assert.ok(c.maxClientReceiptGapMs>0);
   assert.ok(c.serverOutputToClientObservedDeltaP95Ms>=0);
   assert.ok(c.originalGameFrameCallbackP95Ms<4);
   assert.match(c.originalAuthStatus,new RegExp("^Online - player #"+c.player+" - server tick [0-9]+$"));
  }
 }
});
test("P52 A+B clean 3-tick transmission and acceptance even when browser arrival has occasional gaps",()=>{
 for(const run of report.runs.slice(0,2)){
  for(const c of run.clients){
   assert.equal(c.serverTransmitTickStepHistogram["6"]??0,0);
   assert.ok((c.serverTransmitTickStepHistogram["0"]??0)<=1,
    "One sender repeat may occur without a repeated accepted tick");
   assert.ok(c.serverTransmitTickStepHistogram["3"]>=299);
   assert.deepEqual(Object.keys(c.clientAcceptedTickStepHistogram),["3"]);
   assert.equal(c.totalOffCadenceClientTransitions,0);
  }
 }
 assert.ok(report.runs[0].clients.some(c=>c.maxClientReceiptGapMs>=160));
 assert.ok(report.runs[0].clients.every(c=>c.maxServerSendGapMs<55));
 assert.ok(report.runs[0].clients.some(c=>c.sampledOriginalClockDebtMaxMs>=55));
});
test("P52 genuine C player #4: 13 actual Rust-transmitted 0/6 tick pairs, accepted identically",()=>{
 const c=report.runs[2].clients[3];
 assert.equal(c.player,4);
 assert.equal(c.clientAcceptedTickStepHistogram["6"],13);
 assert.equal(c.clientAcceptedTickStepHistogram["0"],13);
 assert.equal(c.serverTransmitTickStepHistogram["6"],13);
 assert.ok(c.serverTransmitTickStepHistogram["0"]>=13);
 assert.equal(c.totalOffCadenceClientTransitions,26);
 assert.equal(c.actualTickJumpEvents.length,26);
 assert.equal(c.sampledOriginalClockDebtMaxMs,27.55);
 assert.equal(c.callbackGapOver33,0);
 assert.equal(c.longTasks,0);
 assert.ok(c.maxClientReceiptGapMs<60);
 for(const e of c.actualTickJumpEvents){
  assert.equal(e.bothReceivedTicksMatchSuccessfulServerTx,true);
  assert.deepEqual(e.intermediateSuccessfulServerSends,[]);
  assert.ok(e.actualServerTransmissionsAroundEvent.length>=2);
  assert.ok(e.rxIntervalMs>=40&&e.rxIntervalMs<=60);
  assert.ok([
   "six-tick-jump-was-transmitted-by-server",
   "repeated-tick-was-transmitted-by-server"
  ].includes(e.classification));
 }
 assert.equal(c.actualTickJumpEvents.filter(e=>e.classification==="six-tick-jump-was-transmitted-by-server").length,13);
 assert.equal(c.actualTickJumpEvents.filter(e=>e.classification==="repeated-tick-was-transmitted-by-server").length,13);
});
test("P52 separate player #3 independent real server six-tick and repeated-tick events",()=>{
 const c=report.runs[2].clients[2];
 assert.equal(c.clientAcceptedTickStepHistogram["6"],1);
 assert.equal(c.clientAcceptedTickStepHistogram["0"],1);
 assert.equal(c.totalOffCadenceClientTransitions,2);
 assert.equal(c.sampledOriginalClockDebtMaxMs,34.97);
 assert.equal(c.callbackGapOver33,0);
 assert.equal(c.longTasks,0);
 assert.deepEqual(c.actualTickJumpEvents.map(e=>e.classification),[
  "six-tick-jump-was-transmitted-by-server","repeated-tick-was-transmitted-by-server"
 ]);
});
test("P52 source only analyzes actual unchanged P51 test-harness reports; server/browser source protected",()=>{
 const src=readFileSync(new URL("tools/art/summarize_p52_real_tick_trace.mjs",root),"utf8");
 const originalServer=readFileSync(new URL("server/src/main.rs",root),"utf8");
 assert.match(src,/const base="10183d131ea10f3f21a2647120f19a72debbf5b2"/);
 assert.match(src,/const protectedPaths=/);
 assert.match(src,/raw\.serverTransmit/);
 assert.match(src,/raw\.serverSimulation/);
 assert.match(src,/m\.acceptedTimeline\.filter/);
 assert.match(src,/intermediateSuccessfulServerSends/);
 assert.match(src,/six-tick-jump-was-transmitted-by-server/);
 assert.match(src,/realPacketsNotSynthetic:true/);
 assert.doesNotMatch(originalServer,/P51_SIM tick=|P51_TX player=|P52_/);
 assert.equal(report.runs.some(r=>r.clients.some(c=>c.totalOffCadenceClientTransitions>0)),true);
});
