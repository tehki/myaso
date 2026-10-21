// Exact upstream snapshots observed by a real browser in native M161.
// This is diagnostic-only: it never manufactures a missing action/knockdown.
export function recordM161IngressTrace(previous, {
  source, serverTick, ownAction, focusAction, epochMs,
}, maxEntries = 96) {
  if (!Array.isArray(previous) || !["datagram", "reliable"].includes(source)
    || !Number.isSafeInteger(serverTick) || serverTick < 0
    || !Number.isFinite(epochMs)
    || !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 256) {
    throw new TypeError("M161 requires bounded genuine source/tick trace");
  }
  // An absent own/focus action is kept as null, NOT interpreted as idle.
  const sample = {
    source, serverTick,
    ownAction: Number.isInteger(ownAction) ? ownAction : null,
    focusAction: Number.isInteger(focusAction) ? focusAction : null,
    epochMs,
  };
  return [...previous.slice(-(maxEntries - 1)), sample];
}
