// D11: optional, sampled-collision-checked rejoin advice for OFFLINE preview.
// Never routes the actor, authorizes live movement, claims arbitrary dynamic
// obstacles are clear, gives quest progress, or executes runtime pathfinding.
import { MAP_IDS } from "./authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "./authored-preview-collision.mjs";
import { certifiedTrailForNext } from "./local-trails.mjs";
import { localTrailPosition, LOCAL_TRAIL_NEAR_RADIUS } from "./local-trail-progress.mjs";

export const LOCAL_REJOIN_VERSION = 1;
export const LOCAL_REJOIN_MAX_DISTANCE = 256;
export const LOCAL_REJOIN_SAMPLE_STEP = 4;
export const LOCAL_REJOIN_CANDIDATES = 12;
const OFFSETS = Object.freeze([0, -32, 32]);
const COMPASS = Object.freeze(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]);

// Finite swept samples are the SAME conservative preview model as D9 trail
// verification. This does not provide continuous collision or dynamic LOS.
export function isSampledPreviewSegmentClear(mapId, ax, ay, bx, by) {
  if (mapId !== MAP_IDS.overworld ||
    ![ax, ay, bx, by].every(Number.isFinite)) return false;
  const distance = Math.hypot(bx - ax, by - ay);
  if (distance > LOCAL_REJOIN_MAX_DISTANCE ||
    !isAuthoredPreviewWalkable(mapId, ax, ay) ||
    !isAuthoredPreviewWalkable(mapId, bx, by)) return false;
  const steps = Math.max(1, Math.ceil(distance / LOCAL_REJOIN_SAMPLE_STEP));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isAuthoredPreviewWalkable(mapId, ax + (bx - ax) * t,
      ay + (by - ay) * t)) return false;
  }
  return true;
}

// Bounded candidate search: at most three geometrically projected points on
// each of the max 4 currently-authored D9 segments (hard cap 12 evaluations).
// Candidates are ordered nearest-first; return null instead of inventing an
// unsafe route if each nearby straight-line approach intersects obstacles.
export function localSampledTrailRejoin(state, mapId, x, y) {
  const progress = localTrailPosition(state, mapId, x, y);
  if (!progress || progress.nearTrail ||
    progress.offTrailDistance > LOCAL_REJOIN_MAX_DISTANCE) return null;
  const trail = certifiedTrailForNext(state, mapId);
  if (!trail || trail.points.length < 2 ||
    trail.points.length - 1 > LOCAL_REJOIN_CANDIDATES / OFFSETS.length) return null;
  const candidates = [];
  for (let i = 1; i < trail.points.length; i++) {
    const [ax, ay] = trail.points[i - 1], [bx, by] = trail.points[i];
    const dx = bx - ax, dy = by - ay;
    const squared = dx * dx + dy * dy;
    if (!(squared > 0)) return null;
    const length = Math.sqrt(squared);
    const projected = Math.max(0, Math.min(1,
      ((x - ax) * dx + (y - ay) * dy) / squared));
    for (const offset of OFFSETS) {
      const t = Math.max(0, Math.min(1, projected + offset / length));
      const targetX = ax + t * dx, targetY = ay + t * dy;
      const distance = Math.hypot(targetX - x, targetY - y);
      if (distance > LOCAL_REJOIN_MAX_DISTANCE) continue;
      candidates.push({targetX, targetY, distance, segmentIndex: i - 1});
    }
  }
  candidates.sort((a, b) => a.distance - b.distance ||
    a.segmentIndex - b.segmentIndex || a.targetX - b.targetX ||
    a.targetY - b.targetY);
  for (let i = 0; i < Math.min(candidates.length, LOCAL_REJOIN_CANDIDATES); i++) {
    const candidate = candidates[i];
    if (!isSampledPreviewSegmentClear(mapId, x, y,
      candidate.targetX, candidate.targetY)) continue;
    const bearingDeg = (Math.atan2(candidate.targetX - x,
      y - candidate.targetY) * 180 / Math.PI + 360) % 360;
    return Object.freeze({
      to: trail.to,
      targetX: candidate.targetX,
      targetY: candidate.targetY,
      distance: candidate.distance,
      direction: COMPASS[Math.round(bearingDeg / 45) % 8],
      segmentIndex: candidate.segmentIndex,
      // Descriptive-only: never mislabel sampling as live/server certainty.
      caution: "Clear in sampled static preview geometry only; not an authoritative route.",
    });
  }
  return null;
}
