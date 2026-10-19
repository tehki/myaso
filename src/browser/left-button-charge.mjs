// Normal LMB is immediate on genuine pointerDOWN. An internal early hold
// classifier promotes an as-yet-unlanded light before its 135ms windup expires.
// The HEAVY attack itself still has its original 320ms authoritative loading;
// do not mistake the 80ms gesture-arbitration interval for the heavy windup.
export const LEFT_HEAVY_CHARGE_MS = 320;
export const LEFT_HEAVY_UPGRADE_MS = 80;

export function createLeftButtonCharge({
  now = () => performance.now(),
  thresholdMs = LEFT_HEAVY_UPGRADE_MS,
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
  let upgradedAtMs = 0;

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
    upgradedAtMs = 0;
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
    upgradedAtMs = now();
    onHeavy();
    return true;
  }
  function press(pointerId, { immediate = false } = {}) {
    if (!Number.isInteger(pointerId) || pointer !== null) return false;
    pointer = pointerId;
    startedMs = now();
    committed = Boolean(immediate);
    upgraded = false;
    upgradedAtMs = 0;
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
    // Do not show a charging bar for quick taps. Only a classified heavy
    // (which already issued its one real server request) earns a charge HUD.
    if (pointer === null || committed || !upgraded) return 0;
    return Math.max(0, Math.min(1, (now() - upgradedAtMs) / LEFT_HEAVY_CHARGE_MS));
  }
  return Object.freeze({ press, release, commitLight, cancel, progress,
    isPressed: () => pointer !== null });
}
