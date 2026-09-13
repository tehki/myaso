import { NETWORK } from "./constants.mjs";
import { buildEntityDelta, quantizeEntity, snapshotRecordBytes, SNAPSHOT_FIELDS } from "./snapshot-codec.mjs";

const BUCKET = Object.freeze({
  OWNER: 0,
  DIRECT_INTERACTION: 1,
  STARVED: 2,
  COMBAT: 3,
  NEAR: 4,
  MID: 5,
  FAR: 6,
});
const BUCKET_COUNT = 7;
const STARVATION_TICKS = 120;

/**
 * O(N) replication selection. Candidates are bucketed instead of globally sorted.
 * A rotating start offset prevents a dense, stable candidate list from starving the
 * same tail forever. Production callers should precompute wire state once per frame
 * and pass the client's acknowledged baseline as a Map<netId, wireState>.
 */
export function planReplication({
  viewer,
  candidates,
  baseline = new Map(),
  wireStates = null,
  lastSentTick = new Map(),
  serverTick,
  byteBudget = NETWORK.conservativeDatagramBytes,
}) {
  if (!viewer || !Number.isFinite(viewer.x) || !Number.isFinite(viewer.y)) throw new TypeError("viewer position is required");
  if (!Array.isArray(candidates)) throw new TypeError("candidates must be an array");
  if (!Number.isInteger(serverTick) || serverTick < 0) throw new RangeError("serverTick must be a non-negative integer");
  if (!Number.isInteger(byteBudget) || byteBudget <= SNAPSHOT_FIELDS.HEADER_BYTES) throw new RangeError("byteBudget is too small");

  const baselineMap = normalizeBaseline(baseline);
  const buckets = Array.from({ length: BUCKET_COUNT }, () => []);
  const start = candidates.length ? hashOffset(viewer.netId ?? 0, serverTick, candidates.length) : 0;
  let dueCount = 0;

  for (let offset = 0; offset < candidates.length; offset += 1) {
    const entity = candidates[(start + offset) % candidates.length];
    const dx = entity.x - viewer.x;
    const dy = entity.y - viewer.y;
    const distanceSq = dx * dx + dy * dy;
    const isOwner = entity.netId === viewer.netId;
    if (!isOwner && distanceSq > NETWORK.interest.farRadius ** 2) continue;

    const previousTick = lastSentTick.get(entity.netId) ?? -Infinity;
    const ageTicks = serverTick - previousTick;
    const interval = desiredIntervalTicksSquared(distanceSq, isOwner);
    if (!isOwner && ageTicks < interval) continue;

    const state = wireStateFor(entity, wireStates);
    const record = buildEntityDelta(state, baselineMap.get(state.netId));
    if (!record) continue;
    dueCount += 1;
    const item = { entity, record, bytes: snapshotRecordBytes(record) };
    buckets[classifyBucket({ entity, viewer, distanceSq, ageTicks, isOwner })].push(item);
  }

  const selected = [];
  const records = [];
  let bytes = SNAPSHOT_FIELDS.HEADER_BYTES;
  for (const bucket of buckets) {
    for (const item of bucket) {
      if (bytes + item.bytes > byteBudget) continue;
      selected.push(item.entity);
      records.push(item.record);
      bytes += item.bytes;
    }
  }

  return {
    selected,
    records,
    bytes,
    omittedDueToBudget: dueCount - selected.length,
  };
}

export function desiredIntervalTicks(distance, isOwner = false) {
  return desiredIntervalTicksSquared(distance * distance, isOwner);
}

function desiredIntervalTicksSquared(distanceSq, isOwner) {
  if (isOwner || distanceSq <= NETWORK.interest.nearRadius ** 2) return NETWORK.interest.nearIntervalTicks;
  if (distanceSq <= NETWORK.interest.midRadius ** 2) return NETWORK.interest.midIntervalTicks;
  return NETWORK.interest.farIntervalTicks;
}

function classifyBucket({ entity, viewer, distanceSq, ageTicks, isOwner }) {
  if (isOwner) return BUCKET.OWNER;
  if (entity.recentlyInteractedWith === viewer.netId || viewer.recentlyInteractedWith === entity.netId) return BUCKET.DIRECT_INTERACTION;
  if (ageTicks >= STARVATION_TICKS) return BUCKET.STARVED;
  if (entity.combatHot || distanceSq <= NETWORK.interest.combatRadius ** 2) return BUCKET.COMBAT;
  if (distanceSq <= NETWORK.interest.nearRadius ** 2) return BUCKET.NEAR;
  if (distanceSq <= NETWORK.interest.midRadius ** 2) return BUCKET.MID;
  return BUCKET.FAR;
}

function wireStateFor(entity, wireStates = null) {
  const cached = wireStates?.get(entity.netId);
  return cached ?? (typeof entity.action === "number" ? entity : quantizeEntity(entity));
}

function normalizeBaseline(baseline) {
  if (baseline instanceof Map) return baseline;
  if (!Array.isArray(baseline)) throw new TypeError("baseline must be a Map or array");
  return new Map(baseline.map((entity) => {
    const state = wireStateFor(entity);
    return [state.netId, state];
  }));
}

function hashOffset(netId, serverTick, length) {
  const mixed = (Math.imul(netId >>> 0, 2654435761) ^ (serverTick >>> 0)) >>> 0;
  return mixed % length;
}
