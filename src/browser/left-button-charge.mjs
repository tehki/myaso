// R2: commit the responsive light immediately, with a bounded early
// windup-to-heavy upgrade for a sustained LMB hold. The authoritative server
// alone decides whether an unlanded light windup may convert to heavy.
// A genuine tap never waits for the heavy-load classifier.
export const LEFT_HEAVY_CHARGE_MS = 80;

export function createLeftButtonCharge({
  now = () => performance.now(),
  thresholdMs = LEFT_HEAVY_CHARGE_MS,
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancelScheduled = (id) => clearTimeout(id),
  onLight,
  onHeavy,
} = {}) {
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0 || thresholdMs >= 135) {
    throw new RangeError("heavy upgrade must fit before the 135ms light windup");
  }
  if (![schedule, cancelScheduled, onLight, onHeavy].every(fn => typeof fn === "function")) {
    throw new TypeError("light, heavy and timer callbacks are required");
  }
  let pointer = null;
  let startedMs = 0;
  let committed = false;
  let upgraded = false;
  let timer = null;

  function stopTimer() {
    if (timer !== null) cancelScheduled(timer);
    timer = null;
  }
  function cancel(pointerId) {
    if (pointerId !== undefined && pointer !== pointerId) return false;
    const active = pointer !== null;
    stopTimer();
    pointer = null;
    committed = false;
    upgraded = false;
    return active;
  }
  function upgrade() {
    timer = null;
    if (pointer === null || committed || upgraded) return false;
    const elapsed = Math.max(0, now() - startedMs);
    if (elapsed < thresholdMs) {
      timer = schedule(upgrade, thresholdMs - elapsed);
      return false;
    }
    upgraded = true;
    onHeavy();
    return true;
  }
  function press(pointerId, { immediate = false } = {}) {
    if (!Number.isInteger(pointerId) || pointer !== null) return false;
    pointer = pointerId;
    startedMs = now();
    committed = Boolean(immediate);
    upgraded = false;
    // Light request starts on the actual pointerDOWN, never delayed until up.
    onLight();
    if (!committed) timer = schedule(upgrade, thresholdMs);
    return true;
  }
  // Jump chord converts the already-issued light; don't issue a second hit
  // or erroneously turn the Space+LMB chord into heavy.
  function commitLight() {
    if (pointer === null || committed || upgraded) return false;
    committed = true;
    stopTimer();
    return true;
  }
  function release(pointerId) {
    if (pointer !== pointerId || pointer === null) return null;
    if (!committed && !upgraded && Math.max(0, now() - startedMs) >= thresholdMs) upgrade();
    const result = upgraded ? "heavy" : committed ? "committed" : "light";
    cancel(pointerId);
    return result;
  }
  function progress() {
    if (pointer === null || committed || upgraded) return 0;
    return Math.max(0, Math.min(1, (now() - startedMs) / thresholdMs));
  }
  return Object.freeze({ press, release, commitLight, cancel, progress,
    isPressed: () => pointer !== null });
}
