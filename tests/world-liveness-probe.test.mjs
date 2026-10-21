import test from "node:test";
import assert from "node:assert/strict";
import {createWorldLivenessProbe,isWorldLivenessProbeEnabled} from "../src/browser/world-liveness-probe.mjs";

test("world liveness probe requires explicit localhost HTTP world mode", () => {
  const base = {hostname:"127.0.0.1",protocol:"http:",search:"?world=1&uiLivenessProbe=1"};
  assert.equal(isWorldLivenessProbeEnabled(base),true);
  for (const change of [{hostname:"myaso.io"},{hostname:"192.168.0.5"},{protocol:"https:"},
    {search:"?world=1"},{search:"?uiLivenessProbe=1"},
    {search:"?world=1&uiLivenessProbe=1&scenario=m151"}]) {
    assert.equal(isWorldLivenessProbeEnabled({...base,...change}),false);
  }
});

test("distinct genuine snapshot ticks, painted frames and HUD status never fabricate progress", () => {
  const p=createWorldLivenessProbe();
  p.recordSnapshot(42,1000);
  p.startPaint(1050);
  p.recordStatus("Online - player #2 - server tick 30",1070);
  let x=p.snapshot(1100);
  assert.deepEqual([x.snapshotTick,x.statusTick,x.snapshots,x.frames],[42,30,1,0]);
  assert.equal(x.paintStartAgeMs,50);
  assert.equal(x.paintAgeMs,null);
  p.endPaint(1500,450,{visible:6,created:3});
  p.recordFrame(1510);
  x=p.snapshot(1520);
  assert.deepEqual([x.paintDurationMs,x.maxPaintMs,x.paints,x.frames],[450,450,1,1]);
  assert.deepEqual([x.visibleTiles,x.createdTiles],[6,3]);
  p.recordSnapshot(43,1540);
  x=p.snapshot(1550);
  assert.equal(x.snapshotTick,43);
  assert.equal(x.statusTick,30);
});

test("invalid timestamps, invalid ticks and malformed status do not invent telemetry", () => {
  const p=createWorldLivenessProbe();
  p.recordSnapshot(-1,0);p.recordSnapshot(2 ** 32,0);p.recordSnapshot(1,NaN);
  p.recordFrame(-2);p.endPaint(12,-1);p.recordStatus(null,10);
  const x=p.snapshot(50);
  assert.deepEqual([x.snapshots,x.frames,x.paints,x.statusUpdates],[0,0,0,0]);
  assert.equal(x.snapshotTick,null);
  assert.equal(x.statusTick,null);
});
