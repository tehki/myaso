// Deterministic client gesture. RMB remains handled independently by right-button-gesture.
export const LEFT_HEAVY_CHARGE_MS = 320;

export function createLeftButtonCharge({
  now = () => performance.now(),
  thresholdMs = LEFT_HEAVY_CHARGE_MS,
  onLight,
  onHeavy,
} = {}) {
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) {
    throw new RangeError("left heavy hold threshold must be positive");
  }
  if (typeof onLight !== "function" || typeof onHeavy !== "function") {
    throw new TypeError("both left attack callbacks are required");
  }
  let pointer = null;
  let startedMs = 0;
  let committed = false;

  function cancel(pointerId) {
    if (pointerId !== undefined && pointer !== pointerId) return false;
    const wasActive = pointer !== null;
    pointer = null;
    committed = false;
    return wasActive;
  }

  function press(pointerId, { immediate = false } = {}) {
    if (!Number.isInteger(pointerId) || pointer !== null) return false;
    pointer = pointerId;
    startedMs = now();
    committed = false;
    if (immediate) commitLight();
    return true;
  }

  // Preserve the old simultaneous Space+LMB or RMB-run+LMB combos.
  // A running/jumping chord must not accidentally turn into a charged heavy.
  function commitLight() {
    if (pointer === null || committed) return false;
    committed = true;
    onLight();
    return true;
  }

  function release(pointerId) {
    if (pointer !== pointerId || pointer === null) return null;
    const durationMs = Math.max(0, now() - startedMs);
    const shouldFire = !committed;
    cancel();
    if (!shouldFire) return "committed";
    if (durationMs >= thresholdMs) {
      onHeavy();
      return "heavy";
    }
    onLight();
    return "light";
  }

  function progress() {
    if (pointer === null || committed) return 0;
    return Math.max(0, Math.min(1, (now() - startedMs) / thresholdMs));
  }

  return Object.freeze({
    press, release, commitLight, cancel, progress,
    isPressed: () => pointer !== null,
  });
}
