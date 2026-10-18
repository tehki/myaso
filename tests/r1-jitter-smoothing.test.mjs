import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSnapshotRenderClock } from "../src/browser/smooth-motion.mjs";
import { createRemoteInterpolator } from "../src/browser/remote-interpolation.mjs";

test("bursting WAN snapshots never teleport multiple remote ticks on one 60Hz render frame",()=>{
  const clock=createSnapshotRenderClock();
  const remote=createRemoteInterpolator();
  const anchor={netId:2,x:100,y:0,facing:0,hp:100,guard:100,action:0,flags:0};
  remote.push(anchor,100);
  let presentation=clock.sample(100,1000);
  clock.sample(100,1016);
  remote.push({...anchor,x:200},112);
  const before=clock.sample(100,1032);
  const next=clock.sample(112,1048);
  // 12 ticks arrived in a burst. Renderer advances <=1.45x simulation.
  assert.ok(next-before>0);
  assert.ok(next-before<1.5);
  const p=remote.sample(2,next);
  assert.ok(Number.isFinite(p.x) && p.x>=100 && p.x<200);
  assert.ok(clock.metrics().boundedCatchups>0);
  assert.ok(clock.metrics().targetGapTicks>0);
  for(let i=0;i<40;i++) presentation=clock.sample(112,1064+i*16);
  assert.ok(presentation>=next);
  assert.ok(clock.metrics().targetGapTicks<1);
});

test("jitter cap respects outages, monotonicity, backwards time and uint32 wrap",()=>{
  const clock=createSnapshotRenderClock();
  const ticks=[
    clock.sample(500,1000),
    clock.sample(500,1016),
    clock.sample(510,1032),
    clock.sample(510,1048),
    clock.sample(509,1064),
    clock.sample(510,4000),
  ];
  assert.ok(ticks.every(Number.isFinite));
  for(let i=1;i<ticks.length;i++) assert.ok(ticks[i]>=ticks[i-1]);
  assert.ok(ticks.at(-1)<510+6);
  clock.reset();
  assert.deepEqual(clock.metrics(),{boundedCatchups:0,targetGapTicks:0});
  assert.ok(clock.sample(0xfffffff0,5000)>0);
  assert.ok(clock.sample(8,5050)<10);
  assert.throws(()=>createSnapshotRenderClock({maxCatchUpRate:2.1}),RangeError);
  assert.throws(()=>createSnapshotRenderClock({maxFrameStepMs:-2}),RangeError);
});

test("zero-time duplicate render must not sneak forward across a WAN packet burst",()=>{
  const clock=createSnapshotRenderClock();
  clock.sample(300,1000);
  const first=clock.sample(300,1016);
  const sameTime=clock.sample(340,1016);
  assert.equal(sameTime,first,"no advancement without wall time, even after newer snapshot");
  const next=clock.sample(340,1017);
  assert.ok(next>sameTime && next-sameTime<=1.45*60/1000+1e-9);
});

test("R1 smoothing is render-only, never alters input ACK, camera, or hit geometry",()=>{
 const src=readFileSync(new URL("../src/browser/smooth-motion.mjs",import.meta.url),"utf8");
 const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(src,/maxCatchUpRate = 1\.45/);
 assert.match(src,/boundedCatchups\+\+/);
 assert.match(online,/snapshotRenderClock\.sample\(networkClient\.latestServerTick, nowMs\)/);
 assert.match(online,/visualCamera\.absorb\(before, local, performance\.now\(\)\)/);
 assert.match(online,/Deferred reconciles/);
 assert.match(online,/Render catch-ups/);
 assert.match(online,/networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\)/);
});

import { createRenderGapTelemetry } from "../src/browser/render-gap-telemetry.mjs";

test("M251 reports bounded true extra render gap not cumulative cap counts", () => {
 const t = createRenderGapTelemetry({sampleLimit:4,sampleIntervalMs:100});
 assert.deepEqual(t.snapshot(), {samples:0,p50Ms:null,p95Ms:null,maxMs:null,overThresholdPct:null});
 assert.equal(t.noteFrame(1000,0,60),true);
 assert.equal(t.noteFrame(1050,600,60),false);
 for(const [ms,ticks] of [[1100,0.6],[1200,2.4],[1300,6]]) assert.equal(t.noteFrame(ms,ticks,60),true);
 assert.deepEqual(t.snapshot(),{samples:4,p50Ms:10,p95Ms:100,maxMs:100,overThresholdPct:50});
 t.noteFrame(1400,0.3,60); // 5ms, evicts oldest 0ms
 assert.deepEqual(t.snapshot(),{samples:4,p50Ms:10,p95Ms:100,maxMs:100,overThresholdPct:50});
 t.noteFrame(1500,0.12,60); // 2ms, evicts 10ms
 assert.deepEqual(t.snapshot(),{samples:4,p50Ms:5,p95Ms:100,maxMs:100,overThresholdPct:50});
 t.noteFrame(1600,0,60); // 0ms, evicts 40ms
 assert.equal(t.snapshot().overThresholdPct,25);
});

test("M251 resets measurements on tab visibility or backwards browser time", () => {
 const t=createRenderGapTelemetry();
 assert.equal(t.noteFrame(500,3,60),true);
 assert.equal(t.noteFrame(480,0,60),true);
 assert.deepEqual(t.snapshot(),{samples:1,p50Ms:0,p95Ms:0,maxMs:0,overThresholdPct:0});
 t.reset();
 assert.equal(t.snapshot().samples,0);
 assert.equal(t.noteFrame(2000,1,60),true);
 assert.equal(t.noteFrame(2090,2,60),false);
 assert.equal(t.noteFrame(2100,2,60),true);
 assert.equal(t.snapshot().samples,2);
});

test("M251 refuses invalid telemetry without changing strict combat or input/render paths", () => {
 const t=createRenderGapTelemetry();
 for(const tuple of [[NaN,1,60],[1000,-1,60],[1000,1,0],[1000,1,Infinity],[Infinity,1,60],[1000,Infinity,60]]) {
   assert.equal(t.noteFrame(...tuple),false);
 }
 assert.equal(t.snapshot().samples,0);
 for(const config of [{sampleLimit:1},{sampleLimit:2048},{sampleIntervalMs:0},
     {sampleIntervalMs:3000},{thresholdMs:-1},{thresholdMs:Infinity}]) {
   assert.throws(()=>createRenderGapTelemetry(config),RangeError);
 }
 const src=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.ok(src.includes('const renderGapTelemetry = diagnosticsVisible ? createRenderGapTelemetry() : null;'));
 assert.ok(src.includes("snapshotRenderClock.metrics().targetGapTicks, NETWORK.serverSimulationHz"));
 assert.equal(src.match(/if \(renderGapTelemetry\) renderGapTelemetry.reset\(\)/g)?.length,2);
 assert.ok(src.includes("Extra render lag p50"));
 assert.ok(src.includes("renderGap.overThresholdPct"));
 assert.ok(src.includes("const renderServerTick = snapshotRenderClock.sample(networkClient.latestServerTick, nowMs)"));
 assert.ok(src.includes("networkClient.sendInput({ tick: outgoingTick, ...currentInput })"));
});
