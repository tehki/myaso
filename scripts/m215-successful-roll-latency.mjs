// M215 reads successful, genuine W3C roll evidence AFTER the original M162
// multi-browser authoritative/no-refresh/HP/guard acceptance has passed.
// An authoritative action epoch is the browser-observed replicated transition,
// not the unmeasured instant the server first committed to that action.
const CUE_TEXT = "Dodging - use the movement to reset spacing.";

const percentile = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const n = sorted.length;
  return Object.freeze({
    samples: n,
    missing: values.length - n,
    minMs: n ? sorted[0] : null,
    p50Ms: n ? sorted[Math.ceil(n / 2) - 1] : null,
    p95Ms: n ? sorted[Math.ceil(0.95 * n) - 1] : null,
    maxMs: n ? sorted[n - 1] : null,
  });
};

const elapsed = (from, to) =>
  Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to >= from
    ? Number((to - from).toFixed(1)) : null;

export function summarizeM215SuccessfulRollLatency(samples) {
  const inputs = Array.isArray(samples) ? samples : [];
  const observations = inputs.map((entry) => {
    const validWheel = entry?.sameBrowserClock === true
      && entry.wheel?.deltaY < 0
      && Number.isFinite(entry.wheel?.epochMs)
      && Number.isFinite(entry.wheel?.t);
    // Both epochMs values are collected and stamped by the SAME actor
    // browser observer, NOT the wall clock of an authoritative server.
    const wheelToObservedActionMs = validWheel
      ? elapsed(entry.wheel.epochMs, entry.observedAction?.epochMs) : null;
    const limit = Number.isFinite(entry?.nextWheelT) ? entry.nextWheelT : Infinity;
    // Both .t fields are in the same actor browser performance clock.
    // Bound duplicate cue lookup to the genuine next wheel of that browser.
    const candidates = validWheel && Array.isArray(entry.eventTransitions)
      ? entry.eventTransitions
        .filter(e => e?.text === CUE_TEXT && Number.isFinite(e.t)
          && e.t >= entry.wheel.t && e.t < limit)
        .sort((a, b) => a.t - b.t)
      : [];
    const wheelToVisibleCueMs = candidates.length
      ? elapsed(entry.wheel.t, candidates[0].t) : null;
    return Object.freeze({
      browser: typeof entry?.browser === "string" ? entry.browser : "unknown",
      phase: typeof entry?.phase === "string" ? entry.phase : "unknown",
      serverTick: Number.isInteger(entry?.observedAction?.serverTick)
        ? entry.observedAction.serverTick : null,
      wheelToObservedActionMs,
      wheelToVisibleCueMs,
    });
  });
  return Object.freeze({
    provenance: "same-actor-browser-only",
    scope: "M162 genuine successful W3C wheel forward -> replicated dodge / DOM cue",
    sampleCount: observations.length,
    wheelToObservedAction: percentile(observations.map(x => x.wheelToObservedActionMs)),
    wheelToVisibleCue: percentile(observations.map(x => x.wheelToVisibleCueMs)),
    observations,
  });
}
