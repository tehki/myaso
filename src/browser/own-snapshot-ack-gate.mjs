import { isTickNewer32 } from "./reconciliation.mjs";

// A processed-input ACK is not, by itself, a positional snapshot. Replaying
// from an older own-player snapshot discards later input against stale world
// coordinates, which can cause visible camera corrections under WAN jitter.
//
// Keep at most ONE newest pending ACK. Never change combat simulation or
// discard prediction history until the own-player authoritative anchor has
// caught up with that ACK's server tick.
export function createOwnSnapshotAckGate() {
  let pending = null;
  let lastAppliedClientTick = null;
  let deferred = 0;
  let coalesced = 0;
  let applied = 0;

  function offer(ack) {
    if (!Number.isInteger(ack?.processedClientTick) || !Number.isInteger(ack?.serverTick)
      || !Number.isInteger(ack?.playerNetId) || ack.playerNetId <= 0) {
      throw new TypeError("valid processed-input ACK required");
    }
    if (lastAppliedClientTick !== null
      && !isTickNewer32(ack.processedClientTick, lastAppliedClientTick)) return false;
    if (pending) {
      if (!isTickNewer32(ack.processedClientTick, pending.processedClientTick)) return false;
      coalesced += 1;
    }
    pending = { ...ack };
    return true;
  }

  function flush(own, onApplied) {
    if (!pending) return null;
    if (!own || !Number.isInteger(own.serverTick)) {
      deferred += 1;
      return null;
    }
    if (own.serverTick !== pending.serverTick
      && !isTickNewer32(own.serverTick, pending.serverTick)) {
      deferred += 1;
      return null;
    }
    if (typeof onApplied !== "function") throw new TypeError("ACK apply callback is required");
    const ack = pending;
    pending = null;
    lastAppliedClientTick = ack.processedClientTick;
    applied += 1;
    onApplied(ack);
    return ack;
  }

  return Object.freeze({
    offer, flush,
    get pending() { return pending; },
    get lastAppliedClientTick() { return lastAppliedClientTick; },
    metrics: () => ({ deferred, coalesced, applied, waiting: Boolean(pending) }),
  });
}
