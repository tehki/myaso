import { NETWORK } from "../network/constants.mjs";
import { isTickNewer32 } from "./reconciliation.mjs";

// Rendering only: server and client simulation retain the original fixed ticks.
// Between 20Hz snapshots, advance the presentation clock at 60Hz so remote
// fighters do not freeze for 50ms then jump to the next replicated position.
export function createSnapshotRenderClock({
  serverHz = NETWORK.serverSimulationHz,
  interpolationMs = NETWORK.reconciliation.remoteInterpolationMs,
  maxAdvanceMs = NETWORK.reconciliation.maxRemoteExtrapolationMs,
} = {}) {
  if (![serverHz, interpolationMs, maxAdvanceMs].every(Number.isFinite)
    || serverHz <= 0 || interpolationMs < 0 || maxAdvanceMs <= 0) {
    throw new RangeError("render clock parameters must be finite and positive");
  }
  let latestTick = null;
  let arrivalMs = 0;
  let previousRenderTick = null;
  const behindTicks = (interpolationMs / 1000) * serverHz;

  function reset() {
    latestTick = null;
    arrivalMs = 0;
    previousRenderTick = null;
  }

  function sample(serverTick, nowMs) {
    if (!Number.isFinite(nowMs) || !Number.isInteger(serverTick) || serverTick < 0 || serverTick > 0xffffffff) {
      throw new TypeError("valid server uint32 tick and monotonic browser time required");
    }
    if (latestTick === null || nowMs < arrivalMs) {
      latestTick = serverTick;
      arrivalMs = nowMs;
      previousRenderTick = null;
    } else if (isTickNewer32(serverTick, latestTick)) {
      // Tick wrap is rare; reset interpolation rather than sending a huge
      // fractional timestamp through the existing remote sample ring.
      if (serverTick < latestTick) {
        latestTick = serverTick;
        arrivalMs = nowMs;
        previousRenderTick = null;
      } else {
        latestTick = serverTick;
        arrivalMs = nowMs;
      }
    }
    const elapsedMs = Math.max(0, Math.min(maxAdvanceMs, nowMs - arrivalMs));
    const proposed = Math.max(0, latestTick + elapsedMs * serverHz / 1000 - behindTicks);
    // Never make an opponent step backwards because of packet arrival jitter.
    // Long outages freeze at maxAdvanceMs instead of extrapolating forever.
    const result = previousRenderTick === null ? proposed : Math.max(previousRenderTick, proposed);
    previousRenderTick = result;
    return result;
  }

  return Object.freeze({ sample, reset });
}

// Rendering only. Preserve the pre-reconciliation *visual* camera coordinate,
// then fade small correction offsets while world hitboxes, own movement and
// all server-authoritative combat state use the corrected local position.
export function createReconciliationCamera({
  halfLifeMs = 58,
  maxOffset = 22,
  snapDistance = NETWORK.reconciliation.hardSnapDistance,
} = {}) {
  if (![halfLifeMs, maxOffset, snapDistance].every(Number.isFinite)
    || halfLifeMs <= 0 || maxOffset <= 0 || snapDistance < maxOffset) {
    throw new RangeError("camera smoothing bounds must be finite and valid");
  }
  let dx = 0;
  let dy = 0;
  let lastMs = null;
  let corrections = 0;
  let largestCorrection = 0;
  const state = { x: 0, y: 0 };

  function decay(nowMs) {
    if (!Number.isFinite(nowMs)) throw new TypeError("finite browser time required");
    if (lastMs !== null && nowMs >= lastMs) {
      const deltaMs = Math.min(250, nowMs - lastMs);
      const factor = Math.exp(-Math.LN2 * deltaMs / halfLifeMs);
      dx *= factor;
      dy *= factor;
      if (Math.hypot(dx, dy) < 0.01) { dx = 0; dy = 0; }
    } else if (lastMs !== null && nowMs < lastMs) {
      dx = 0;
      dy = 0;
    }
    lastMs = nowMs;
  }

  function absorb(before, corrected, nowMs) {
    if (![before?.x, before?.y, corrected?.x, corrected?.y].every(Number.isFinite)) {
      return { ignored: true };
    }
    decay(nowMs);
    const amount = Math.hypot(before.x - corrected.x, before.y - corrected.y);
    if (amount < 0.01) return { ignored: false, snapped: false, distance: 0 };
    corrections += 1;
    largestCorrection = Math.max(largestCorrection, amount);
    if (amount >= snapDistance) {
      dx = 0;
      dy = 0;
      return { ignored: false, snapped: true, distance: amount };
    }
    dx += before.x - corrected.x;
    dy += before.y - corrected.y;
    const length = Math.hypot(dx, dy);
    if (length > maxOffset) { dx *= maxOffset / length; dy *= maxOffset / length; }
    return { ignored: false, snapped: false, distance: amount };
  }

  function sample(local, nowMs, target = state) {
    decay(nowMs);
    target.x = local.x + dx;
    target.y = local.y + dy;
    return target;
  }

  function reset() {
    dx = 0;
    dy = 0;
    lastMs = null;
  }

  function metrics() {
    return { corrections, largestCorrection, visibleOffset: Math.hypot(dx, dy) };
  }

  return Object.freeze({ absorb, sample, reset, metrics });
}
