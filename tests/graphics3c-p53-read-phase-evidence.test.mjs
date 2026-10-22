import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const report=JSON.parse(readFileSync(new URL(
 "assets/environment/greyhaven/3c-p53-frame-selection-phase/p53-actual-read-vs-simulation-refresh.json",root),"utf8"));
const hist=(arr)=>arr.reduce((a,v)=>(a[v.step]=(a[v.step]||0)+1,a),{});
test("P53 two real 4-player Rust/WebTransport sessions with exact original source ancestry",()=>{
 assert.equal(report.parent,"e8cb752ee31407534b4c2a0a32305b020a98c70d");
 assert.equal(report.realWebTransport,true);
 assert.equal(report.realServerAuthority,true);
 assert.equal(report.samePhysicalHost,true);
 assert.equal(report.loopbackOnly,true);
 assert.equal(report.noSyntheticLoss,true);
 assert.equal(report.noProductionSourceEdited,true);
 assert.equal(report.stagedOnlyOutsideRepo,true);
 assert.equal(report.serverInstrumentedStdoutOnly,true);
 assert.equal(report.clientHTTPPassiveInstrumentation,true);
 assert.equal(report.notGPUPresentedFrameTiming,true);
 assert.equal(report.runs.length,2);
 for(const trial of report.runs){
  assert.equal(trial.clients.length,4);
  assert.ok(trial.simRefreshes>300);
  assert.deepEqual(Object.keys(trial.simRefreshTickSteps),["3"]);
  assert.deepEqual(trial.clients.map(c=>c.player),[1,2,3,4]);
  for(const c of trial.clients){
   assert.ok(c.rxCount>=300);
   assert.ok(c.txWindowCount>=c.rxCount);
   assert.equal(c.successfulTxWithMatchedFrameRead,c.txWindowCount);
   assert.equal(c.acceptedAllMatchSuccessfulRustTx,true);
   assert.ok(c.originalFrameP95Ms<4);
   assert.equal(c.repeatedAndJumpEvents.length,c.eventCount);
   assert.ok(c.actualClockDebtPeakMs>=0);
  }
 }
});
test("P53 first true browser player #2 5 server read-phase repeated and 5 six-tick transitions",()=>{
 const c=report.runs[0].clients[1];
 assert.equal(c.player,2);
 assert.equal(c.eventCount,10);
 assert.deepEqual(hist(c.repeatedAndJumpEvents),{"0":5,"6":5});
 assert.equal(c.actualClockDebtPeakMs,42.53);
 assert.equal(c.originalRAFCallbackGapOver33,0);
 assert.ok(c.repeatedAndJumpEvents.every(x=>x.toTick===x.mostRecentSimulationRefreshTick));
 assert.ok(c.repeatedAndJumpEvents.filter(x=>x.step===6).every(x=>x.msAfterLatestRefresh<1));
 assert.ok(c.repeatedAndJumpEvents.filter(x=>x.step===0).every(x=>x.msUntilNextRefresh<5));
});
test("P53 second real player #3 75 repeated +74 six; TRUE original sender sampled around refresh boundary",()=>{
 const c=report.runs[1].clients[2];
 assert.equal(c.player,3);
 assert.equal(c.eventCount,149);
 assert.deepEqual(hist(c.repeatedAndJumpEvents),{"0":75,"6":74});
 assert.equal(c.actualClockDebtPeakMs,35.12);
 assert.ok(c.repeatedAndJumpEvents.every(x=>x.toTick===x.mostRecentSimulationRefreshTick));
 const repeated=c.repeatedAndJumpEvents.filter(x=>x.step===0);
 const advanced=c.repeatedAndJumpEvents.filter(x=>x.step===6);
 assert.ok(repeated.filter(x=>x.msUntilNextRefresh<=5).length>=74);
 assert.ok(advanced.every(x=>x.msAfterLatestRefresh<=5));
 assert.ok(advanced.every(x=>x.rustSelectedNextTick-x.rustSelectedOriginalTick===6));
 const median=items=>items.toSorted((a,b)=>a-b)[Math.floor(items.length/2)];
 assert.equal(median(repeated.map(x=>x.msUntilNextRefresh)),1.628);
 assert.equal(median(advanced.map(x=>x.msAfterLatestRefresh)),0.439);
});
test("P53 exact real Rust frame read immediately after original latest cached frame select",()=>{
 const staging=readFileSync(new URL("tools/art/stage_p53_server_read_phase_trace.mjs",root),"utf8");
 const browser=readFileSync(new URL("tools/art/probe_p53_snapshot_read_phase_browser.mjs",root),"utf8");
 const analyzer=readFileSync(new URL("tools/art/summarize_p53_snapshot_read_phase.mjs",root),"utf8");
 const server=readFileSync(new URL("server/src/main.rs",root));
 assert.equal(createHash("sha256").update(server).digest("hex"),
  "058c454f566c3db48c230d5b69f768050b6caaf45fc76fdc4469e465247c24a6");
 assert.match(staging,/sourcePin="e8cb752ee31407534b4c2a0a32305b020a98c70d"/);
 assert.match(staging,/let server_tick = frame.server_tick\(\)/);
 assert.match(staging,/P53_READ player=/);
 assert.match(staging,/P51_SIM tick=/);
 assert.match(staging,/P51_TX player=/);
 assert.match(staging,/stagingOutsideRepository:true/);
 assert.match(browser,/sourcePin="e8cb752ee31407534b4c2a0a32305b020a98c70d"/);
 assert.match(browser,/report\.serverRead=\[\.\.\.gameOutput\.matchAll/);
 assert.match(browser,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(analyzer,/const parent="e8cb752ee31407534b4c2a0a32305b020a98c70d"/);
 assert.match(analyzer,/actualRustFrameReadTickSteps/);
 assert.match(analyzer,/msUntilNextRefresh/);
 assert.match(analyzer,/msAfterLatestRefresh/);
 assert.doesNotMatch(server.toString("utf8"),/P53_READ player=|P51_SIM tick=|P51_TX player=/);
});
