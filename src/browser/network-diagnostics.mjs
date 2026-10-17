import { isTickNewer32 } from "./reconciliation.mjs";

// Bounded, local-only telemetry. "ACK RTT" measures input send to a matching
// server processed-input ACK (including simulation/snapshot scheduling), NOT
// ICMP ping or one-way network latency. No identity, address or input payload.
export function createNetworkDiagnostics({
  now = () => performance.now(),
  maxPending = 128,
  sampleLimit = 96,
} = {}) {
  if (!Number.isInteger(maxPending) || maxPending < 2 || maxPending > 1024) throw new RangeError("invalid pending limit");
  if (!Number.isInteger(sampleLimit) || sampleLimit < 2 || sampleLimit > 1024) throw new RangeError("invalid sample limit");
  const pending = new Map();
  const ackRtts = [];
  const ackJitter = [];
  const snapshotGaps = [];
  const cameraCorrections = [];
  let lastAckRtt = null;
  let lastSnapshotMs = null;
  let latestAckTick = null;
  let ackCount = 0;
  let snapshotCount = 0;
  let staleOwnAtAckCount = 0;
  let maxStaleOwnTicks = 0;

  function record(list, value) {
    if (!Number.isFinite(value) || value < 0) return;
    list.push(value);
    if (list.length > sampleLimit) list.shift();
  }

  function noteSentInput(tick) {
    if (!Number.isInteger(tick) || tick < 0 || tick > 0xffffffff) return;
    // Avoid double-counting retransmitted ticks: packet redundancy is not
    // a new sample and must never make ACK latency appear artificially low.
    if (!pending.has(tick)) pending.set(tick, now());
    while (pending.size > maxPending) pending.delete(pending.keys().next().value);
  }

  function noteAck(tick) {
    if (!Number.isInteger(tick) || tick < 0 || tick > 0xffffffff) return;
    if (latestAckTick !== null && !isTickNewer32(tick, latestAckTick)) return;
    latestAckTick = tick;
    ackCount += 1;
    const sentAt = pending.get(tick);
    if (sentAt !== undefined) {
      const rtt = now() - sentAt;
      if (rtt >= 0) {
        record(ackRtts, rtt);
        if (lastAckRtt !== null) record(ackJitter, Math.abs(rtt - lastAckRtt));
        lastAckRtt = rtt;
      }
    }
    for (const key of pending.keys()) {
      if (!isTickNewer32(key, tick)) pending.delete(key);
    }
  }

  function noteSnapshot() {
    const at = now();
    snapshotCount += 1;
    if (lastSnapshotMs !== null && at >= lastSnapshotMs) record(snapshotGaps, at - lastSnapshotMs);
    lastSnapshotMs = at;
  }

  function noteReconciliation(ack, own, distance) {
    record(cameraCorrections, distance);
    if (!Number.isInteger(ack?.serverTick) || !Number.isInteger(own?.serverTick)) return;
    if (isTickNewer32(ack.serverTick, own.serverTick)) {
      staleOwnAtAckCount += 1;
      maxStaleOwnTicks = Math.max(maxStaleOwnTicks, (ack.serverTick - own.serverTick) >>> 0);
    }
  }

  function quantile(list, fraction) {
    if (!list.length) return null;
    const sorted = [...list].sort((a,b) => a-b);
    return Math.round(sorted[Math.ceil((sorted.length - 1) * fraction)] * 10) / 10;
  }

  function snapshot() {
    return Object.freeze({
      inputAckSamples: ackRtts.length,
      ackCount,
      snapshots: snapshotCount,
      inputAckP50Ms: quantile(ackRtts, 0.5),
      inputAckP95Ms: quantile(ackRtts, 0.95),
      ackJitterP95Ms: quantile(ackJitter, 0.95),
      snapshotGapP50Ms: quantile(snapshotGaps, 0.5),
      snapshotGapP95Ms: quantile(snapshotGaps, 0.95),
      cameraCorrectionP95: quantile(cameraCorrections, 0.95),
      staleOwnAtAckCount,
      maxStaleOwnTicks,
      pendingInputs: pending.size,
    });
  }

  return Object.freeze({
    noteSentInput, noteAck, noteSnapshot, noteReconciliation, snapshot,
  });
}
