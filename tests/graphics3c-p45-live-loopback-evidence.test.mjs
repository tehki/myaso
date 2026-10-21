import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const dir="assets/environment/greyhaven/3c-p45-online-loopback/";
const data=JSON.parse(readFileSync(new URL(dir+"p45-four-local-chromium-authoritative.json",root),"utf8"));
test("P45 actual four real Chromium clients share independent authoritative player IDs and scoreboard",()=>{
 assert.equal(data.sourceHead,"d4f05394f6d45af59ef9cc24f8487d6b5db55f8f");
 assert.equal(data.serverAuthoritative,true);
 assert.equal(data.worldFlag,true);
 assert.equal(data.host,"127.0.0.1");
 assert.equal(data.browsersIndependentHosts,false);
 assert.equal(data.clientsRequested,4);
 assert.equal(data.results.length,4);
 assert.deepEqual(data.errors,[]);
 assert.deepEqual(data.serverSummary.admittedPlayerIds,[1,2,3,4]);
 assert.equal(data.serverSummary.endpointLoopback,true);
 assert.equal(data.serverSummary.clientCount,4);
 assert.equal(data.screenshotFile,"p45-client1-actual-authored-greyhaven.png");
 const ids=data.results.map(r=>+r.measurement.status.match(/^Online - player #([0-9]+) - server tick [0-9]+$/)?.[1]);
 assert.deepEqual(ids,[1,2,3,4]);
 for(const c of data.results){
  assert.deepEqual(c.errors,[]);
  assert.equal(c.measurement.opaqueCanvas,true);
  assert.equal(c.measurement.documentHidden,false);
  assert.ok(c.measurement.tileCanvasDrawCalls>=1000);
  assert.ok(c.measurement.rAFSamples>=250);
  assert.ok(Number.isFinite(c.measurement.rAFGapP95Ms));
  assert.deepEqual(c.measurement.scoreboard,["#10","#20","#30","#40"]);
  assert.match(c.measurement.diagnostics,/Input→ACK p50/);
  assert.match(c.measurement.diagnostics,/Extra render lag/);
  assert.match(c.measurement.note,/NOT GPU presented frame time/);
 }
 assert.ok(data.results.some(c=>c.measurement.diagnostics.includes("p95 174ms")),
  "Do not conceal worst-client network/render lag from the report");
 assert.equal(Object.hasOwn(data,"serverLogTail"),false,"Do not commit ephemeral session tokens/certificate fingerprint");
});
test("P45 screenshot is actual saved 960×720 PNG browser evidence, not generated art",()=>{
 const b=readFileSync(new URL(dir+"p45-client1-actual-authored-greyhaven.png",root));
 assert.ok(b.byteLength>10000);
 assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(b.readUInt32BE(16),960);
 assert.equal(b.readUInt32BE(20),720);
});
test("P45 offline harness invokes genuine compiled Rust and browser with isolated local-only test boundaries",()=>{
 const s=readFileSync(new URL("tools/art/probe_p45_actual_online_loopback_browser.mjs",root),"utf8");
 assert.match(s,/P45_SERVER_BIN/);
 assert.match(s,/P45_CHROME_EXECUTABLE/);
 assert.match(s,/serverCertificateHashes|searchParams.set\("cert"/);
 assert.match(s,/searchParams.set\("world","1"\)/);
 assert.match(s,/MYASO_BIND:"127\.0\.0\.1:0"/);
 assert.match(s,/new Set\(playerIds\)\.size!==clients/);
 assert.match(s,/drawImage=function/);
 assert.match(s,/rAFGapP95Ms/);
 assert.match(s,/sourcePin="d4f05394f6d45af59ef9cc24f8487d6b5db55f8f"/);
 assert.match(s,/runtimeSourceDiff/);
 assert.ok(!s.includes('MYASO_BIND:"0.0.0.0'));
 assert.doesNotMatch(readFileSync(new URL("web/online-game.mjs",root),"utf8"),/probe_p45_actual_online_loopback_browser/);
});
