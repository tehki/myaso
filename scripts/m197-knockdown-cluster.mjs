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

// The browser's keyUp response does not guarantee that the ORIGINAL Rust
// snapshots have finished applying a prior W3C pulse. Never issue another
// compensating pulse from one potentially lagging snapshot: first observe a
// series of fresh authoritative ticks with settled positions for both victims.
// This is a nonrelease test-harness wait, not a client or server behavior change.
export async function awaitM197SettledCluster({
  read, sleep, now = Date.now, settleSamples = 4, intervalMs = 100,
  timeoutMs = 2400, tolerancePx = 2,
}) {
  if (typeof read !== "function" || typeof sleep !== "function"
    || typeof now !== "function"
    || ![settleSamples, intervalMs, timeoutMs, tolerancePx].every(Number.isFinite)
    || !Number.isInteger(settleSamples) || settleSamples < 1
    || intervalMs <= 0 || timeoutMs <= intervalMs * (settleSamples + 1)
    || tolerancePx < 0) {
    throw new RangeError("M197 settled cluster requires bounded positive sampling");
  }
  const deadline = now() + timeoutMs;
  const observations = [];
  let previous = null;
  let stable = 0;
  while (now() < deadline) {
    const current = await read();
    const positions = [
      current?.first?.x, current?.first?.y,
      current?.second?.x, current?.second?.y,
    ];
    const tick = current?.serverTick;
    if (!Number.isFinite(tick) || !positions.every(Number.isFinite)) {
      throw new Error("M197 cannot settle without genuine Rust World positions and tick");
    }
    const position = { tick, positions };
    observations.push({ tick, firstX: positions[0], firstY: positions[1],
      secondX: positions[2], secondY: positions[3] });
    if (previous && tick > previous.tick
      && positions.every((value, i) => Math.abs(value - previous.positions[i]) <= tolerancePx)) {
      stable += 1;
    } else {
      stable = 0;
    }
    if (stable >= settleSamples) {
      return { ...current, observations };
    }
    previous = position;
    await sleep(intervalMs);
  }
  throw new Error("M197 genuine World cluster did not settle before next W3C nudge: "
    + JSON.stringify(observations.slice(-12)));
}
