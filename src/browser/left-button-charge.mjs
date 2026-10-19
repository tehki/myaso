// Restored R1 hold-to-release classification. A normal short click commits
// exactly one light on release; only a >=320ms sustained hold commits heavy.
// This prevents a premature 135ms light from hitting during heavy loading.
export const LEFT_HEAVY_CHARGE_MS = 320;

export function createLeftButtonCharge({
  now = () => performance.now(),
  thresholdMs = LEFT_HEAVY_CHARGE_MS,
  onLight,
  onHeavy,
} = {}) {
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) {
    throw new RangeError("left heavy charge threshold must be positive");
  }
  if (typeof onLight !== "function" || typeof onHeavy !== "function") {
    throw new TypeError("light and heavy callbacks are required");
  }
  let pointer = null;
  let startedMs = 0;
  let committed = false;

  function cancel(pointerId) {
    if (pointerId !== undefined && pointer !== pointerId) return false;
    const active = pointer !== null;
    pointer = null;
    committed = false;
    return active;
  }
  function commitLight() {
    if (pointer === null || committed) return false;
    committed = true;
    onLight();
    return true;
  }
  function press(pointerId, { immediate = false } = {}) {
    if (!Number.isInteger(pointerId) || pointer !== null) return false;
    pointer = pointerId;
    startedMs = now();
    committed = false;
    if (immediate) commitLight(); // Preserve simultaneous jump attack chord.
    return true;
  }
  function release(pointerId) {
    if (pointer === null || pointer !== pointerId) return null;
    if (committed) { cancel(pointerId); return "committed"; }
    const heavy = Math.max(0, now() - startedMs) >= thresholdMs;
    cancel(pointerId);
    if (heavy) { onHeavy(); return "heavy"; }
    onLight();
    return "light";
  }
  function progress() {
    if (pointer === null || committed) return 0;
    return Math.max(0, Math.min(1, (now() - startedMs) / thresholdMs));
  }
  return Object.freeze({ press, release, commitLight, cancel, progress,
    isPressed: () => pointer !== null });
}
