import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const base="assets/environment/greyhaven/3c-p50-accepted-clock-qa/";
const plans=[["solo",1,4500],["four-a",4,12000],["four-b",4,12000]];
const reports=plans.map(([name])=>JSON.parse(readFileSync(new URL(base+name+"-original-clock-live-chromium.json",root),"utf8")));

plans.forEach(([name,clients,ms],trial)=>test("P50 real original Rust/client acceptance: "+name,()=>{
 const x=reports[trial];
 assert.equal(x.sourceHead,"e7fd51e3e423a9f04a62c187482820b14796a894");
 assert.equal(x.clientsRequested,clients);
 assert.equal(x.measureMs,ms);
 assert.equal(x.serverAuthoritative,true);
 assert.equal(x.browsersIndependentHosts,false);
 assert.equal(x.worldFlag,true);
 assert.equal(x.host,"127.0.0.1");
 assert.deepEqual(x.errors,[]);
 assert.ok(!Object.hasOwn(x,"serverLogTail"));
 assert.equal(x.results.length,clients);
 assert.equal(x.serverSummary.endpointLoopback,true);
 assert.deepEqual(x.serverSummary.admittedPlayerIds,Array.from({length:clients},(_,i)=>i+1));
 x.results.forEach((r,i)=>{
  const m=r.measurement;
  assert.deepEqual(r.errors,[]);
  assert.equal(r.index,i+1);
  assert.match(m.status,new RegExp("^Online - player #"+(i+1)+" - server tick [0-9]+$"));
  assert.equal(m.opaqueCanvas,true);
  assert.equal(m.documentHidden,false);
  assert.equal(m.scoreboard.length,clients);
  assert.equal(m.snapshotReaderHooks,1);
  assert.ok(m.actualSnapshotPacketCount>=85);
  assert.equal(m.acceptedRealtimeCount,m.actualSnapshotPacketCount);
  assert.equal(m.acceptedTotalCount,m.acceptedRealtimeCount+m.acceptedReliableCount);
  assert.equal(m.acceptedReliableCount,0,"No live reliable-stream latest tick advance in these runs");
  assert.ok(m.acceptedGapMaxMs>=m.acceptedGapP95Ms);
  assert.ok(m.acceptedTickJumpMax>=3&&m.acceptedTickJumpMax<=6);
  assert.ok(m.sampledClockCount>=35);
  assert.ok(m.sampledClockDebtMaxMs>=0);
  assert.ok(m.sampledClockDebtP95Ms>=0);
  assert.ok(m.actualGameFrameSamples>200);
  assert.ok(m.tileCanvasDrawCalls>1000);
  assert.match(m.diagnostics,/Extra render lag p50/);
  assert.match(m.diagnostics,/Input→ACK p50/);
  assert.ok(!Object.hasOwn(m,"rawPackets"));
  assert.equal(m.clockCorrelationWindows.length,5);
  for(const item of m.clockCorrelationWindows){
   assert.ok(Number.isInteger(item.tick));
   assert.ok(Number.isFinite(item.renderTick));
   assert.ok(Number.isFinite(item.debtMs));
   assert.ok(item.nearbyAccepted.every(e=>["realtime","reliable"].includes(e.kind)&&Number.isInteger(e.tick)));
  }
 });
}));

test("P50 live 6-tick advances co-observed with 35ms original visual-clock debt and no RAF stalls",()=>{
 const m=reports[1].results[3].measurement;
 assert.equal(m.acceptedTickJumpMax,6);
 assert.equal(m.sampledClockDebtMaxMs,35.12);
 assert.equal(m.sampledClockDebtP95Ms,34.92);
 assert.equal(m.actualGameFrameGapOver33,0);
 assert.equal(m.observedLongTaskCount,0);
 assert.equal(m.actualGameFrameP95Ms,2.5);
 assert.match(m.diagnostics,/Extra render lag p50 0ms · p95 28ms/);
 assert.ok(m.sampledClockCatchupMax>=200);
 const window=m.clockCorrelationWindows.find(x=>x.tick===900);
 assert.ok(window);
 assert.ok(Math.abs(window.renderTick-893.4951)<0.001);
 assert.ok(window.nearbyAccepted.some(x=>x.tick===900));
 assert.ok(window.nearbyAccepted.some((x,i,a)=>i>0&&x.tick-a[i-1].tick===6));
 assert.ok(reports[2].results.every(r=>r.measurement.sampledClockDebtMaxMs===0));
 assert.ok(reports[2].results.every(r=>r.measurement.acceptedTickJumpMax===3));
});

test("P50 only injects passive response-time markers; original stored production source is unchanged",()=>{
 const harness=readFileSync(new URL("tools/art/probe_p50_accepted_tick_clock_correlation_browser.mjs",root),"utf8");
 const client=readFileSync(new URL("web/authoritative-client.mjs",root),"utf8");
 const game=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 assert.match(harness,/sourcePin="e7fd51e3e423a9f04a62c187482820b14796a894"/);
 assert.match(harness,/runtimeSourceDiff/);
 assert.match(harness,/web\/authoritative-client\.mjs/);
 assert.match(harness,/web\/network-transport\.mjs/);
 assert.match(harness,/src\/browser\/smooth-motion\.mjs/);
 assert.match(harness,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(harness,/let bytes=await readFile\(path\)/);
 assert.match(harness,/function appendAfterOnce\(source,marker,added\)/);
 assert.match(harness,/s\.noteAccepted=\(kind,tick\)=>/);
 assert.match(harness,/s\.noteClock=\(at,latest,render,gap,catchups\)=>/);
 assert.match(harness,/return result; \/\/ exact same object and same bytes to real client/);
 assert.ok(client.includes("latestServerTick = snapshotResult.serverTick;"));
 assert.ok(client.includes("latestServerTick = reliableSnapshotResult.serverTick;"));
 assert.ok(game.includes("const renderServerTick = snapshotRenderClock.sample(networkClient.latestServerTick, nowMs);"));
 assert.doesNotMatch(client,/__P50_QA__/);
 assert.doesNotMatch(game,/__P50_QA__/);
});
