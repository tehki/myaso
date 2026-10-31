// Generic source-time animation sampler for reusable human clips.
// Pure presentation math only; it never advances gameplay or Combat state.
export function isValidAnimationTimeline({
  durationMs,
  frameTimesMs,
  loop = false,
} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return false;
  if (!Array.isArray(frameTimesMs) || frameTimesMs.length < 1 ||
      frameTimesMs.length > 128) return false;
  if (typeof loop !== "boolean" || frameTimesMs[0] !== 0) return false;

  let previous = -Infinity;
  for (const time of frameTimesMs) {
    if (!Number.isFinite(time) || time < 0 || time <= previous ||
        time > durationMs) return false;
    previous = time;
  }

  // A looping clip samples its first frame at the next cycle boundary; an
  // endpoint sample at durationMs would duplicate frame zero on wrap.
  if (loop && previous >= durationMs) return false;
  return true;
}

export function sampleAnimationFrame({
  elapsedMs,
  durationMs,
  frameTimesMs,
  loop = false,
} = {}) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 ||
      !isValidAnimationTimeline({durationMs, frameTimesMs, loop})) return null;

  const sampleMs = loop ? elapsedMs % durationMs : Math.min(elapsedMs, durationMs);
  let low = 0;
  let high = frameTimesMs.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frameTimesMs[middle] <= sampleMs) low = middle;
    else high = middle - 1;
  }

  return Object.freeze({
    frame: low,
    elapsedMs: sampleMs,
    sourceTimeMs: frameTimesMs[low],
    durationMs,
    progress: sampleMs / durationMs,
    complete: !loop && elapsedMs >= durationMs,
    loop,
  });
}
