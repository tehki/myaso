import assert from "node:assert/strict";
import test from "node:test";
import {
  GRAPHICS_RAF_SAMPLE_CAP, GRAPHICS_RAF_INSTALL_SCRIPT, GRAPHICS_RAF_STOP_SCRIPT,
  summarizeGraphicsRaf,
} from "../scripts/graphics_p0_four_browser_frame_cadence.mjs";

test("genuine rAF collector is opt-in, bounded and does not mutate gameplay", () => {
  const window = {};
  const jobs = [];
  let now = 0;
  const performance = { now: () => now };
  const requestAnimationFrame = cb => jobs.push(cb);
  const document = {
    visibilityState: "visible",
    querySelector: query => query === "#arena" ? { width: 960, height: 540 } : null,
  };
  const execute = source =>
    Function("window", "performance", "requestAnimationFrame", "document", source)(
      window, performance, requestAnimationFrame, document);
  assert.deepEqual(execute(GRAPHICS_RAF_INSTALL_SCRIPT), { installed: true });
  assert.deepEqual(execute(GRAPHICS_RAF_INSTALL_SCRIPT),
    { installed: false, alreadyRunning: true });
  assert.equal(jobs.length, 1);
  for (const timestamp of [0, 16, 35, 55, 100]) {
    assert.equal(jobs.length, 1);
    jobs.shift()(timestamp);
  }
  now = 110;
  const record = execute(GRAPHICS_RAF_STOP_SCRIPT);
  assert.equal(jobs.length, 1);
  assert.equal(record.frames, 5);
  assert.deepEqual(record.intervalsMs, [16, 19, 20, 45]);
  jobs.shift()(125);
  assert.equal(jobs.length, 0);
  assert.equal(window.__MYASO_GRAPHICS_P0_RAF_QA__, undefined);
  assert.equal(execute(GRAPHICS_RAF_STOP_SCRIPT), null);
  const summary = summarizeGraphicsRaf(record);
  assert.equal(summary.kind, "real-browser-raf-callback-intervals-not-fps");
  assert.equal(summary.sampleCount, 4);
  assert.equal(summary.p50Ms, 19);
  assert.equal(summary.p95Ms, 45);
  assert.equal(summary.p99Ms, 45);
  assert.equal(summary.over16_7ms, 3);
  assert.equal(summary.over33_3ms, 1);
  assert.equal(summary.browserVisibility, "visible");
  assert.equal(summary.canvasWidth, 960);
  assert.equal(summary.canvasHeight, 540);
  assert.equal(Object.isFrozen(summary), true);
  assert.equal(document.visibilityState, "visible");
});

test("frame summaries fail closed for malformed, invented, or unbounded reports", () => {
  for (const report of [
    null, {}, { frames: 3, durationMs: 10, intervalsMs: null },
    { frames: 3, durationMs: 10, intervalsMs: [NaN] },
    { frames: 3, durationMs: 10, intervalsMs: [-1] },
    { frames: 3, durationMs: 10, intervalsMs: [Infinity] },
    { frames: -1, durationMs: 10, intervalsMs: [] },
    { frames: 1.5, durationMs: 10, intervalsMs: [] },
    { frames: 1, durationMs: -1, intervalsMs: [] },
    { frames: 1, durationMs: 10, intervalsMs: Array(GRAPHICS_RAF_SAMPLE_CAP+1).fill(16) },
  ]) assert.throws(() => summarizeGraphicsRaf(report));
});

test("report accurately distinguishes no samples, pauses and stable intervals", () => {
  const empty = summarizeGraphicsRaf({
    frames: 0, durationMs: 0, intervalsMs: [], visibility: "hidden",
  });
  assert.equal(empty.p95Ms, null);
  assert.equal(empty.enoughSamplesForDiagnostics, false);
  const stall = summarizeGraphicsRaf({
    frames: 5, durationMs: 300,
    intervalsMs: [16, 17, 250, 16], visibility: "visible",
  });
  assert.equal(stall.p95Ms, 250);
  assert.equal(stall.over33_3ms, 1);
  assert.equal(stall.enoughSamplesForDiagnostics, true);
  assert.equal(GRAPHICS_RAF_SAMPLE_CAP, 240);
});
