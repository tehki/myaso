import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const prefix="assets/environment/greyhaven/3c-p49-real-ingress-qa/";
const reports=[
 {file:"one-chromium-live-webtransport.json",n:1},
 {file:"four-a-chromium-live-webtransport.json",n:4},
 {file:"four-b-chromium-live-webtransport.json",n:4}
];
for(const {file,n} of reports){
 test("P49 actual original WebTransport snapshot-ingress proof: "+file,()=>{
  const x=JSON.parse(readFileSync(new URL(prefix+file,root),"utf8"));
  assert.equal(x.sourceHead,"893144ef56a64c2395038b4c7ebd3648cfb5f192");
  assert.equal(x.clientsRequested,n);
  assert.equal(x.serverAuthoritative,true);
  assert.equal(x.worldFlag,true);
  assert.equal(x.browsersIndependentHosts,false);
  assert.equal(x.host,"127.0.0.1");
  assert.deepEqual(x.errors,[]);
  assert.equal(x.results.length,n);
  assert.equal(x.serverSummary.endpointLoopback,true);
  assert.equal(x.serverSummary.clientCount,n);
  assert.deepEqual(x.serverSummary.admittedPlayerIds,Array.from({length:n},(_,i)=>i+1));
  assert.ok(!Object.hasOwn(x,"serverLogTail"));
  for(const [i,r] of x.results.entries()){
   assert.deepEqual(r.errors,[]);
   const m=r.measurement;
   assert.match(m.status,new RegExp("^Online - player #"+(i+1)+" - server tick [0-9]+$"));
   assert.equal(m.opaqueCanvas,true);
   assert.equal(m.documentHidden,false);
   assert.equal(m.scoreboard.length,n);
   assert.equal(m.snapshotReaderHooks,1);
   assert.match(m.ingressSource,/WebTransport\.datagrams\.readable\.getReader/);
   assert.ok(m.actualSnapshotPacketCount>=80);
   assert.equal(m.ingressIntervals,m.actualSnapshotPacketCount-1);
   assert.ok(m.ingressGapP50Ms>0);
   assert.ok(m.ingressGapP95Ms>=m.ingressGapP50Ms);
   assert.ok(m.ingressGapMaxMs>=m.ingressGapP95Ms);
   assert.ok(m.ingressTickJumpMax>=1&&m.ingressTickJumpMax<=6);
   assert.equal(m.ingressIntervalsOver400Ms,0,
    "Real observed datagram stream did not exhibit the synthetic P48 400ms gap");
   assert.ok(m.tileCanvasDrawCalls>1000);
   assert.ok(m.actualGameFrameSamples>250);
   assert.match(m.diagnostics,/Extra render lag p50 0ms · p95 0ms/);
   assert.match(m.diagnostics,/Input→ACK p50/);
   assert.ok(m.note.includes("NOT GPU presented frame time"));
   assert.ok(!Object.hasOwn(m,"rawPackets"));
  }
 });
}
test("P49 real 4-client 12s ingress windows are short relative to synthetic 400–500ms hold",()=>{
 const a=JSON.parse(readFileSync(new URL(prefix+"four-a-chromium-live-webtransport.json",root),"utf8"));
 const b=JSON.parse(readFileSync(new URL(prefix+"four-b-chromium-live-webtransport.json",root),"utf8"));
 assert.equal(a.measureMs,12000);
 assert.equal(b.measureMs,12000);
 assert.ok(a.results.every(x=>x.measurement.actualSnapshotPacketCount>=240));
 assert.ok(b.results.every(x=>x.measurement.actualSnapshotPacketCount>=240));
 assert.ok(a.results.every(x=>x.measurement.ingressIntervalsOver100Ms===1));
 assert.ok(b.results.every(x=>x.measurement.ingressIntervalsOver100Ms===0));
 assert.ok(a.results.some(x=>x.measurement.ingressTickJumpMax===6));
 assert.ok(b.results.every(x=>x.measurement.ingressTickJumpMax===3));
 const max=Math.max(...[...a.results,...b.results].map(r=>r.measurement.ingressGapMaxMs));
 assert.equal(max,125.1);
 assert.ok(max<400,"The synthetic P48 large outage was not observed in this real sample");
});

test("P49 passive packet header tap does not rewrite production transport, gameplay or server",()=>{
 const harness=readFileSync(new URL("tools/art/probe_p49_real_webtransport_ingress_correlation_browser.mjs",root),"utf8");
 const transport=readFileSync(new URL("web/network-transport.mjs",root),"utf8");
 const game=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 const codec=readFileSync(new URL("src/network/snapshot-codec.mjs",root),"utf8");
 assert.match(harness,/sourcePin="893144ef56a64c2395038b4c7ebd3648cfb5f192"/);
 assert.match(harness,/runtimeSourceDiff/);
 assert.match(harness,/web\/authoritative-client\.mjs/);
 assert.match(harness,/web\/network-transport\.mjs/);
 assert.match(harness,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(harness,/window\.WebTransport=new Proxy\(OriginalWebTransport/);
 assert.match(harness,/data\[1\]===2&&data\[0\]===1/);
 assert.match(harness,/view\.getUint16\(4,true\)/);
 assert.match(harness,/view\.getUint32\(8,true\)/);
 assert.match(harness,/return result; \/\/ exact same object and same bytes to real client/);
 assert.match(transport,/transport\.datagrams\.readable\.getReader\(\)/);
 assert.match(codec,/view\.setUint32\(8, serverTick, true\)/);
 assert.doesNotMatch(game,/probe_p49_real_webtransport_ingress_correlation_browser/);
});
