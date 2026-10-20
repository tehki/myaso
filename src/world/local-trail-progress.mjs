// D10: passive trail-following feedback for the OFFLINE Moonvale preview.
// Uses a single D9 pre-certified polyline, never runs pathfinding or moves
// players. Proximity to a line is NOT proof that a rejoin is walkable.
import { MAP_IDS } from "./authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "./authored-preview-collision.mjs";
import { certifiedTrailForNext } from "./local-trails.mjs";

export const LOCAL_TRAIL_PROGRESS_VERSION = 1;
export const LOCAL_TRAIL_NEAR_RADIUS = 96;

export function localTrailPosition(state, mapId, x, y) {
  if (mapId !== MAP_IDS.overworld || !Number.isFinite(x) || !Number.isFinite(y)
    || !isAuthoredPreviewWalkable(mapId, x, y)) return null;
  const trail = certifiedTrailForNext(state, mapId);
  if (!trail || trail.points.length < 2 || trail.points.length > 64) return null;
  let length = 0, bestSquared = Infinity, bestAlong = 0, bestIndex = -1;
  let bestX = 0, bestY = 0;
  for (let i = 1; i < trail.points.length; i++) {
    const [ax, ay] = trail.points[i - 1];
    const [bx, by] = trail.points[i];
    const dx = bx - ax, dy = by - ay;
    const squared = dx * dx + dy * dy;
    if (!(squared > 0) || !Number.isFinite(squared)) return null;
    const segment = Math.sqrt(squared);
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / squared));
    const projectedX = ax + t * dx, projectedY = ay + t * dy;
    const distanceSquared = (x - projectedX) ** 2 + (y - projectedY) ** 2;
    // Prefer the earliest segment if equally close; stable at shared corners.
    if (distanceSquared < bestSquared) {
      bestSquared = distanceSquared;
      bestX = projectedX;
      bestY = projectedY;
      bestAlong = length + t * segment;
      bestIndex = i - 1;
    }
    length += segment;
  }
  if (bestIndex < 0 || !Number.isFinite(length) || !(length > 0)) return null;
  const offTrailDistance = Math.sqrt(bestSquared);
  const nextPoint = trail.points[bestIndex + 1];
  const bearingDeg = (Math.atan2(nextPoint[0] - x, y - nextPoint[1]) * 180 / Math.PI + 360) % 360;
  const remainingDistance = Math.max(0, length - bestAlong);
  return Object.freeze({
    from: trail.from, to: trail.to,
    alongDistance: bestAlong,
    totalDistance: length,
    remainingDistance,
    completionFraction: Math.max(0, Math.min(1, bestAlong / length)),
    offTrailDistance,
    nearTrail: offTrailDistance <= LOCAL_TRAIL_NEAR_RADIUS,
    // Anchor is purely geometric; a direct return can cross blocked world geometry.
    nearestX: bestX, nearestY: bestY,
    nextWaypointIndex: bestIndex + 1,
    nextWaypointBearingDeg: bearingDeg,
    caution: "Geometric proximity only; never a safe rejoin or quest completion.",
  });
}
