// LMB is a release-to-strike gesture. A full 320ms charge is held until
// pointerUP: never auto-strike or upgrade while the mouse remains down.
// Space+LMB still commits a jump attack immediately.
export const LEFT_HEAVY_CHARGE_MS = 320;

export function createLeftButtonCharge({
  now = () => performance.now(),
  chargeMs = LEFT_HEAVY_CHARGE_MS,
  onLight,
  onHeavy,
} = {}) {
  if (!Number.isFinite(chargeMs) || chargeMs <= 0) {
    throw new RangeError("charge duration must be positive");
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
    startedMs = 0;
    committed = false;
    return active;
  }

  function press(pointerId, { immediate = false } = {}) {
    if (!Number.isInteger(pointerId) || pointer !== null) return false;
    pointer = pointerId;
    startedMs = now();
    committed = Boolean(immediate);
    if (committed) onLight();
    return true;
  }

  function commitLight() {
    if (pointer === null || committed) return false;
    committed = true;
    onLight();
    return true;
  }

  function release(pointerId) {
    if (pointer === null || pointer !== pointerId) return null;
    const elapsedMs = Math.max(0, now() - startedMs);
    const result = committed ? "committed" : elapsedMs >= chargeMs ? "heavy" : "light";
    cancel(pointerId);
    if (result === "heavy") onHeavy();
    else if (result === "light") onLight();
    return result;
  }

  function progress() {
    if (pointer === null || committed) return 0;
    return Math.max(0, Math.min(1, (now() - startedMs) / chargeMs));
  }

  return Object.freeze({
    press, release, commitLight, cancel, progress,
    isPressed: () => pointer !== null,
    isActivePointer: (pointerId) => pointer !== null && pointer === pointerId,
    isCharging: () => pointer !== null && !committed,
  });
}
