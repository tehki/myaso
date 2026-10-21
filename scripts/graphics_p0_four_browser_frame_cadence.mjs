// Graphics P0, opt-in measurement only. No game module imports or writes.
// These scripts run through WebDriver execute/sync in genuine game documents.
// rAF callback cadence is NOT a GPU presentation / full-frame render timer.
export const GRAPHICS_RAF_SAMPLE_CAP = 240;

export const GRAPHICS_RAF_INSTALL_SCRIPT = [
  "const key = '__MYASO_GRAPHICS_P0_RAF_QA__';",
  "if (window[key]?.running) return { installed: false, alreadyRunning: true };",
  "const state = { running: true, startedAt: performance.now(), previous: null, frames: 0, intervals: [] };",
  "window[key] = state;",
  "const tick = timestamp => {",
  " if (!state.running) return;",
  " state.frames++;",
  " if (state.previous !== null) {",
  "  const delta = timestamp - state.previous;",
  "  if (Number.isFinite(delta) && delta >= 0 && state.intervals.length < 240) state.intervals.push(delta);",
  " }",
  " state.previous = timestamp;",
  " if (state.intervals.length < 240) requestAnimationFrame(tick);",
  " else state.running = false;",
  "};",
  "requestAnimationFrame(tick);",
  "return { installed: true };",
].join("\n");

export const GRAPHICS_RAF_STOP_SCRIPT = [
  "const state = window.__MYASO_GRAPHICS_P0_RAF_QA__;",
  "if (!state) return null;",
  "state.running = false;",
  "const report = { frames: state.frames, intervalsMs: state.intervals.slice(),",
  " durationMs: performance.now() - state.startedAt, visibility: document.visibilityState,",
  " canvasWidth: document.querySelector('#arena')?.width ?? 0,",
  " canvasHeight: document.querySelector('#arena')?.height ?? 0 };",
  "delete window.__MYASO_GRAPHICS_P0_RAF_QA__;",
  "return report;",
].join("\n");

function percentile(sorted, fraction) {
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : null;
}

// A bounded distribution of genuine browser rAF callbacks while the 4 real
// WebTransport sessions run. Never call the result "FPS", "paint", "blit",
// "network latency", or "GPU present".
export function summarizeGraphicsRaf(report) {
  if (!report || !Array.isArray(report.intervalsMs) || report.intervalsMs.length > GRAPHICS_RAF_SAMPLE_CAP
      || !Number.isInteger(report.frames) || report.frames < 0
      || !Number.isFinite(report.durationMs) || report.durationMs < 0) {
    throw new TypeError("invalid real-browser frame-cadence report");
  }
  if (report.intervalsMs.some(x => typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 60000)) {
    throw new RangeError("invalid browser frame interval");
  }
  const sorted = report.intervalsMs.slice().sort((a, b) => a - b);
  return Object.freeze({
    kind: "real-browser-raf-callback-intervals-not-fps",
    sampleCount: sorted.length,
    callbackFrames: report.frames,
    durationMs: report.durationMs,
    browserVisibility: report.visibility,
    canvasWidth: report.canvasWidth,
    canvasHeight: report.canvasHeight,
    p50Ms: percentile(sorted, .50),
    p95Ms: percentile(sorted, .95),
    p99Ms: percentile(sorted, .99),
    over16_7ms: sorted.filter(x => x > 16.7).length,
    over33_3ms: sorted.filter(x => x > 33.3).length,
    longestIntervalMs: sorted.length ? sorted[sorted.length - 1] : null,
    enoughSamplesForDiagnostics: sorted.length >= 3,
  });
}
