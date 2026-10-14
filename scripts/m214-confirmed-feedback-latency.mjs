// M214: read-only, same-client-clock responsiveness for genuine W3C inputs.
// The browser observer records all *EpochMs fields inside one actor client*.
// Network confirmation means observed authoritative ACK, not the unobserved
// instant of server commitment. Never subtract server/browser-local timestamps.
const METRICS = Object.freeze({
  inputToQueuedMs: ["inputEpochMs", "queuedEpochMs"],
  inputToSubmittedMs: ["inputEpochMs", "submittedEpochMs"],
  inputToConfirmedMs: ["inputEpochMs", "confirmedEpochMs"],
  inputToShownMs: ["inputEpochMs", "shownEpochMs"],
  submittedToConfirmedMs: ["submittedEpochMs", "confirmedEpochMs"],
  confirmedToShownMs: ["confirmedEpochMs", "shownEpochMs"],
});

const rounded = value => Number(value.toFixed(1));

export function summarizeM214ConfirmedFeedback(proofs) {
  const rows = Array.isArray(proofs) ? proofs : [];
  const measures = {};
  for (const [metric, [startKey, endKey]] of Object.entries(METRICS)) {
    const valid = [];
    for (const row of rows) {
      // Per-proof provenance is one browser observer's epoch clock, never
      // a reconstructed combination of unsynchronized Chrome and Firefox.
      if (!row || row.sameBrowserClock !== true) continue;
      const start = row[startKey];
      const end = row[endKey];
      if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start) {
        valid.push(rounded(end - start));
      }
    }
    valid.sort((a, b) => a - b);
    const n = valid.length;
    measures[metric] = Object.freeze({
      samples: n,
      missingOrUnordered: rows.length - n,
      minMs: n ? valid[0] : null,
      p50Ms: n ? valid[Math.ceil(n * 0.50) - 1] : null,
      p95Ms: n ? valid[Math.ceil(n * 0.95) - 1] : null,
      maxMs: n ? valid[n - 1] : null,
    });
  }
  return Object.freeze({
    provenance: "single-actor-browser-epoch",
    scope: "confirmed-authoritative-stamina-denial-only",
    attempts: rows.length,
    metrics: Object.freeze(measures),
  });
}
