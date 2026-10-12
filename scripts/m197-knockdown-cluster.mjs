// Plan W3C movement BEFORE any roll or attack begins. No synthetic combat
// inputs, modified world state, or relaxed collision/punish assertions.
export function planM197KnockdownClusterNudge({
  rollRight, firstX, secondX, moveSpeed,
  targetLeadPx = 24, tolerancePx = 9, maxPulseMs = 175,
}) {
  if (typeof rollRight !== "boolean"
    || ![firstX, secondX, moveSpeed, targetLeadPx, tolerancePx, maxPulseMs].every(Number.isFinite)
    || moveSpeed <= 0 || targetLeadPx <= 0 || tolerancePx < 0 || maxPulseMs <= 0) {
    throw new RangeError("M197 cluster plan requires real positions and positive movement parameters");
  }
  const sign = rollRight ? 1 : -1;
  const leadPx = sign * (secondX - firstX);
  const errorPx = targetLeadPx - leadPx;
  if (Math.abs(errorPx) <= tolerancePx) {
    return { aligned: true, leadPx, errorPx, targetLeadPx, key: null, pulseMs: 0 };
  }
  const key = sign * errorPx > 0 ? "d" : "a";
  const pulseMs = Math.min(maxPulseMs, Math.max(20, Math.round(Math.abs(errorPx) * 1000 / moveSpeed)));
  return { aligned: false, leadPx, errorPx, targetLeadPx, key, pulseMs };
}
