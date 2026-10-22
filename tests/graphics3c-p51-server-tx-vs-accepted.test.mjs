import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const dir="assets/environment/greyhaven/3c-p51-server-tick-trace/";
const cases=[["solo",1,4500],["four-a",4,12000],["four-b",4,12000]];
const data=cases.map(([key])=>JSON.parse(readFileSync(new URL(dir+key+"-real-server-tx-vs-browser-accepted-chromium.json",root),"utf8")));
const histogram=(list)=>{const counts={};for(let i=1;i<list.length;i++){const d=list[i].tick-list[i-1].tick;counts[d]=(counts[d]||0)+1;}return counts;};

for(let trial=0;trial<cases.length;trial++){
 const [name,n,ms]=cases[trial];
 test("P51 real QA Rust server-transmit and authoritative Chromium proof: "+name,()=>{
  const x=data[trial];
  assert.equal(x.sourceHead,"05f577b7fb8d97ef33c6ddcf9699a3d6432db909");
  assert.equal(x.clientsRequested,n);
  assert.equal(x.measureMs,ms);
  assert.equal(x.serverAuthoritative,true);
  assert.equal(x.browsersIndependentHosts,false);
  assert.equal(x.host,"127.0.0.1");
  assert.equal(x.worldFlag,true);
  assert.deepEqual(x.errors,[]);
  assert.equal(x.results.length,n);
  assert.deepEqual(x.serverSummary.admittedPlayerIds,Array.from({length:n},(_,i)=>i+1));
  assert.ok(!Object.hasOwn(x,"serverLogTail"),"No certificate or session logs in proof");
  assert.ok(x.serverTransmit.length>=n*50);
  assert.ok(x.serverSimulation.length>=100);
  assert.deepEqual(Object.keys(histogram(x.serverSimulation)),["3"],
   "Original replication refresh runs at every three authoritative ticks");
  for(const [i,client] of x.results.entries()){
   const m=client.measurement;
   assert.deepEqual(client.errors,[]);
   assert.equal(client.index,i+1);
   assert.match(m.status,new RegExp("^Online - player #"+(i+1)+" - server tick [0-9]+$"));
   assert.equal(m.opaqueCanvas,true);
   assert.equal(m.scoreboard.length,n);
   assert.ok(m.actualSnapshotPacketCount>=80);
   assert.equal(m.acceptedRealtimeCount,m.actualSnapshotPacketCount);
   assert.equal(m.acceptedReliableCount,0);
   assert.ok(m.actualGameFrameSamples>200);
   assert.ok(m.tileCanvasDrawCalls>1000);
   const received=m.acceptedTimeline.filter(r=>r.kind==="realtime");
   assert.equal(received.length,m.actualSnapshotPacketCount);
   assert.ok(received.every(r=>Number.isFinite(r.epochMs)&&Number.isInteger(r.tick)));
   const sends=x.serverTransmit.filter(e=>e.player===i+1);
   const scoped=sends.filter(e=>e.epochMs>=received[0].epochMs-100
     &&e.epochMs<=received.at(-1).epochMs+100);
   assert.ok(scoped.length>=received.length,"Server must transmit same tick at least as often as genuine client accepted");
   assert.deepEqual(Object.keys(histogram(scoped)),["3"],"No observed 6-tick step at actual server-send time in measured window");
   assert.deepEqual(Object.keys(histogram(received)),["3"],"Client accepted same 3-tick step in these sessions");
   const sentTickTime=new Map(sends.map(e=>[e.tick,e.epochMs]));
   const delays=received.map(e=>e.epochMs-sentTickTime.get(e.tick));
   assert.ok(delays.every(v=>Number.isFinite(v)&&v>=0&&v<70),
    "Match all actual accepted server ticks to transmitted server tick without invented packet drop");
   assert.ok(m.acceptedGapMaxMs>=50);
   assert.match(m.diagnostics,/Extra render lag p50/);
  }
 });
}
test("P51 real B run shows delayed browser receipt without server-side 6-tick transmit",()=>{
 const x=data[2],a=data[1];
 assert.ok(x.results.some(r=>r.measurement.acceptedGapMaxMs>100));
 assert.ok(x.results.some(r=>r.measurement.sampledClockDebtMaxMs>10));
 assert.ok(a.results.every(r=>r.measurement.acceptedTickJumpMax===3));
 assert.ok(x.results.every(r=>r.measurement.acceptedTickJumpMax===3));
 for(const client of x.results){
  const m=client.measurement,tx=x.serverTransmit.filter(e=>e.player===client.index);
  const rx=m.acceptedTimeline.filter(e=>e.kind==="realtime");
  const narrow=tx.filter(e=>e.epochMs>=rx[0].epochMs-100&&e.epochMs<=rx.at(-1).epochMs+100);
  const maximum=Math.max(...narrow.slice(1).map((e,i)=>e.epochMs-narrow[i].epochMs));
  assert.ok(maximum<70);
 }
});
test("P51 Rust instrumented executable staged only in an external QA directory",()=>{
 const stage=readFileSync(new URL("tools/art/stage_p51_server_tick_trace.mjs",root),"utf8");
 const src=readFileSync(new URL("server/src/main.rs",root));
 const testBrowser=readFileSync(new URL("tools/art/probe_p51_server_transmit_vs_accepted_ticks.mjs",root),"utf8");
 assert.equal(createHash("sha256").update(src).digest("hex"),"058c454f566c3db48c230d5b69f768050b6caaf45fc76fdc4469e465247c24a6");
 assert.match(stage,/sourcePin="05f577b7fb8d97ef33c6ddcf9699a3d6432db909"/);
 assert.match(stage,/P51_SIM tick=/);
 assert.match(stage,/P51_TX player=/);
 assert.match(stage,/stagingOutsideRepository:true/);
 assert.match(stage,/sourceFile,"utf8"/);
 assert.doesNotMatch(src.toString("utf8"),/P51_SIM tick=|P51_TX player=/);
 assert.match(testBrowser,/report\.serverTransmit=\[\.\.\.gameOutput\.matchAll/);
 assert.match(testBrowser,/report\.serverSimulation=\[\.\.\.gameOutput\.matchAll/);
 assert.match(testBrowser,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(testBrowser,/epochMs:\+\(performance\.timeOrigin\+t\)/);
 assert.match(testBrowser,/runtimeSourceDiff/);
});
