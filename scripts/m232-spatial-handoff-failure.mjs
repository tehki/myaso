// M232: summarize *observed* Firefox DOM MutationObserver ring geometry when
// the existing strict M145 spatial recovery handoff fails. Never synthesize
// a missing focus transition or treat this evidence as successful gameplay.
const MAX_EXCERPT = 24;
const MAX_SAMPLES = 4096;

function boundedNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(2)) : null;
}

function normalizeSample(sample) {
  if (!sample || typeof sample !== "object") return null;
  return {
    focusLabel: typeof sample.focusLabel === "string" ? sample.focusLabel.slice(0, 64) : "",
    count: Number.isSafeInteger(sample.count) && sample.count >= 0 ? sample.count : null,
    centroidX: boundedNumber(sample.centroidX),
    canvasWidth: boundedNumber(sample.canvasWidth),
    t: boundedNumber(sample.t),
  };
}

export function summarizeM232SpatialHandoffFailure(samples, { lightId, jumpId } = {}) {
  const safe = Array.isArray(samples) ? samples.slice(0, MAX_SAMPLES).map(normalizeSample) : [];
  const lightLabel = `PUNISH TARGET #${lightId}`;
  const jumpLabel = `PUNISH TARGET #${jumpId}`;
  const light = safe.filter(sample => sample?.focusLabel === lightLabel);
  const jump = safe.filter(sample => sample?.focusLabel === jumpLabel);
  const first = group => group.find(Boolean) ?? null;
  const recent = safe.filter(Boolean).slice(-MAX_EXCERPT);
  return Object.freeze({
    source: "actual-firefox-focus-label-mutation-and-canvas-readback",
    available: Array.isArray(samples),
    sampleCount: Array.isArray(samples) ? samples.length : 0,
    inspectedCount: safe.length,
    truncatedInput: Array.isArray(samples) && samples.length > MAX_SAMPLES,
    lightLabel,
    jumpLabel,
    observedLightLabels: light.length,
    observedJumpLabels: jump.length,
    firstLight: first(light),
    firstJump: first(jump),
    maxLightRingPixels: light.reduce((max, s) => Math.max(max, s?.count ?? 0), 0),
    maxJumpRingPixels: jump.reduce((max, s) => Math.max(max, s?.count ?? 0), 0),
    lastObservedSamples: recent,
  });
}
