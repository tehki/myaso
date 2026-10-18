// M251: local-only extra render lag BEHIND the existing 90ms interpolation target.
// Not input RTT or a server clock skew estimate; no coordinates, IDs or network writes.
export function createRenderGapTelemetry({ sampleLimit = 96, sampleIntervalMs = 100, thresholdMs = 33 } = {}) {
  if (!Number.isInteger(sampleLimit) || sampleLimit < 2 || sampleLimit > 1024
    || !Number.isFinite(sampleIntervalMs) || sampleIntervalMs < 16 || sampleIntervalMs > 2000
    || !Number.isFinite(thresholdMs) || thresholdMs < 0 || thresholdMs > 2000) {
    throw new RangeError("invalid render-gap telemetry bounds");
  }
  const gaps = [];
  let lastSampleMs = null;
  function reset() { gaps.length = 0; lastSampleMs = null; }
  function noteFrame(nowMs, targetGapTicks, serverHz) {
    if (![nowMs, targetGapTicks, serverHz].every(Number.isFinite)
      || nowMs < 0 || targetGapTicks < 0 || serverHz <= 0) return false;
    if (lastSampleMs !== null && nowMs < lastSampleMs) reset();
    if (lastSampleMs !== null && nowMs - lastSampleMs < sampleIntervalMs) return false;
    const gapMs = targetGapTicks / serverHz * 1000;
    if (!Number.isFinite(gapMs)) return false;
    lastSampleMs = nowMs;
    gaps.push(gapMs);
    if (gaps.length > sampleLimit) gaps.shift();
    return true;
  }
  function snapshot() {
    const count = gaps.length;
    if (!count) return Object.freeze({ samples: 0, p50Ms: null, p95Ms: null, maxMs: null, overThresholdPct: null });
    const ordered = [...gaps].sort((a, b) => a - b);
    const round = n => Math.round(n * 10) / 10;
    return Object.freeze({
      samples: count,
      p50Ms: round(ordered[Math.ceil((count - 1) * 0.5)]),
      p95Ms: round(ordered[Math.ceil((count - 1) * 0.95)]),
      maxMs: round(ordered[count - 1]),
      overThresholdPct: round(gaps.filter(ms => ms > thresholdMs).length / count * 100),
    });
  }
  return Object.freeze({ noteFrame, snapshot, reset });
}
