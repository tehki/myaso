// Graphics 3C P46: measured actual ORIGINAL online-game.mjs frame callback
// on localhost real Rust WebTransport, not an alleged GPU-present FPS result.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const prefix="assets/environment/greyhaven/3c-p46-real-frame-qa/";
const trials=[
 {file:"solo-local-chromium.json",clients:1},
 {file:"four-first-local-chromium.json",clients:4},
 {file:"four-repeat-local-chromium.json",clients:4},
];

for(const {file,clients} of trials){
 test("P46 native loopback WebTransport actual frame callback source: "+file,()=>{
  const x=JSON.parse(readFileSync(new URL(prefix+file,root),"utf8"));
  assert.equal(x.sourceHead,"0a1e622a356007c70030bff190dd7abf44df4501");
  assert.equal(x.host,"127.0.0.1");
  assert.equal(x.serverBinary,"myaso-server");
  assert.equal(x.serverAuthoritative,true);
  assert.equal(x.worldFlag,true);
  assert.equal(x.browsersIndependentHosts,false);
  assert.equal(x.clientsRequested,clients);
  assert.equal(x.measureMs,6000);
  assert.deepEqual(x.errors,[]);
  assert.equal(x.results.length,clients);
  assert.equal(x.serverSummary.endpointLoopback,true);
  assert.equal(x.serverSummary.clientCount,clients);
  assert.deepEqual(x.serverSummary.admittedPlayerIds,Array.from({length:clients},(_,i)=>i+1));
  assert.ok(!Object.hasOwn(x,"serverLogTail"),
   "Never persist ephemeral certificate/server session tokens");
  const ids=[];
  for(const c of x.results){
   assert.deepEqual(c.errors,[]);
   const m=c.measurement;
   const found=m.status.match(/^Online - player #([0-9]+) - server tick ([0-9]+)$/);
   assert.ok(found,"Real authoritative connection and tick needed");
   ids.push(Number(found[1]));
   assert.ok(Number(found[2])>0);
   assert.equal(m.opaqueCanvas,true);
   assert.equal(m.documentHidden,false);
   assert.ok(m.tileCanvasDrawCalls>=1500);
   assert.equal(m.worldTileBlitCalls,m.tileCanvasDrawCalls);
   assert.ok(Number.isFinite(m.worldTileBlitMs)&&m.worldTileBlitMs>0);
   assert.ok(m.actualGameFrameSamples>=300);
   assert.ok(m.rAFSamples>=300);
   assert.ok(Number.isFinite(m.actualGameFrameP50Ms));
   assert.ok(Number.isFinite(m.actualGameFrameP95Ms));
   assert.ok(Number.isFinite(m.actualGameFrameMaxMs));
   assert.ok(m.actualGameFrameP95Ms<=m.actualGameFrameMaxMs);
   assert.ok(m.measuredCallbackNames.includes("frame"),
    "Capture the actual online-game module's function frame(now)");
   assert.ok(m.measuredCallbackNames.includes("collect"),
    "Capture RAF scheduling separately from actual game frame self-time");
   assert.ok(Number.isFinite(m.rAFGapP95Ms));
   assert.ok(Number.isFinite(m.rAFGapMaxMs));
   assert.ok(m.rAFGapMaxMs>=m.rAFGapP95Ms);
   assert.ok(m.note.includes("NOT GPU presented frame time"));
   assert.match(m.diagnostics,/Input→ACK p50/);
   assert.match(m.diagnostics,/Extra render lag p50/);
   assert.equal(m.scoreboard.length,clients);
  }
  assert.deepEqual(ids,Array.from({length:clients},(_,i)=>i+1));
 });
}

test("P46 second 4-client run retains measured scheduling stutters even when frame JS p95 is low",()=>{
 const x=JSON.parse(readFileSync(new URL(prefix+"four-repeat-local-chromium.json",root),"utf8"));
 assert.ok(x.results.some(c=>c.measurement.rAFGapMaxMs>=100),
  "Preserve sporadic scheduling outliers in evidence; do not claim smooth 60fps");
 assert.ok(x.results.every(c=>c.measurement.actualGameFrameP95Ms<=3.1));
 assert.ok(x.results.some(c=>c.measurement.diagnostics.includes("p95 75ms")),
  "Client #2's extra render lag must not be hidden");
});

test("P46 optional harness uses only pinned actual client/server source and LOCAL server",()=>{
 const src=readFileSync(new URL("tools/art/probe_p46_real_online_render_duration_browser.mjs",root),"utf8");
 const online=readFileSync(new URL("web/online-game.mjs",root),"utf8");
 assert.match(src,/sourcePin="0a1e622a356007c70030bff190dd7abf44df4501"/);
 assert.match(src,/runtimeSourceDiff/);
 assert.match(src,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(src,/new Set\(playerIds\)\.size!==clients/);
 assert.match(src,/callback\.name==="frame"/);
 assert.match(src,/performance\.now\(\)-start/);
 assert.match(src,/actualGameFrameP95Ms/);
 assert.match(src,/worldTileBlitMs/);
 assert.match(src,/rAFGapP95Ms/);
 assert.match(src,/getContext\("2d"\)/);
 assert.match(src,/browser\.close\(\)/);
 assert.doesNotMatch(online,/probe_p46_real_online_render_duration_browser/);
 assert.match(online,/function frame\(now\)/);
 assert.match(online,/canvas\.getContext\("2d", \{ alpha: false \}\)/);
});
