// D2 authored collision geometry for the OFFLINE Moonvale walking preview.
// This is presentation-side movement only, NEVER the multiplayer authority.
// Core & Multiplayer must independently validate real movement server-side.
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";

export const PREVIEW_FIGHTER_RADIUS = 18;
export const MAX_PREVIEW_FRAME_MOVE = 16;
const SUBSTEP_UNITS = 4;

// These match the explicitly authored gates/wall strokes in
// authored-world-renderer.mjs in World & Buildings PR #336.
// Centralize the wall geometry manifest with Graphics before live server use.
const WALL_HALF_THICKNESS = 37 / 2;
const GREYHAVEN_GATE_X = 4130;
const GREYHAVEN_GATE_Y = 4180;
const GATE_X_HALF_WIDTH = 73;
const GATE_Y_HALF_HEIGHT = 68;

function circleTouchesRect(x, y, radius, left, top, right, bottom) {
  const nearestX = Math.max(left, Math.min(x, right));
  const nearestY = Math.max(top, Math.min(y, bottom));
  const dx = x - nearestX, dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function circleTouchesWalls(city, x, y, radius) {
  const left = city.x, right = left + city.w;
  const top = city.y, bottom = top + city.h;
  const t = WALL_HALF_THICKNESS;
  const gX = GREYHAVEN_GATE_X, gY = GREYHAVEN_GATE_Y;
  return [
    // Top/bottom have wide central gates.
    [left - t, top - t, gX - GATE_X_HALF_WIDTH, top + t],
    [gX + GATE_X_HALF_WIDTH, top - t, right + t, top + t],
    [left - t, bottom - t, gX - GATE_X_HALF_WIDTH, bottom + t],
    [gX + GATE_X_HALF_WIDTH, bottom - t, right + t, bottom + t],
    // Left/right gates align with the west/east King's Road.
    [left - t, top - t, left + t, gY - GATE_Y_HALF_HEIGHT],
    [left - t, gY + GATE_Y_HALF_HEIGHT, left + t, bottom + t],
    [right - t, top - t, right + t, gY - GATE_Y_HALF_HEIGHT],
    [right - t, gY + GATE_Y_HALF_HEIGHT, right + t, bottom + t],
  ].some(rect => circleTouchesRect(x, y, radius, ...rect));
}

function distSquaredToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSquared = dx * dx + dy * dy;
  const t = lenSquared ? Math.max(0, Math.min(1,
    ((x - ax) * dx + (y - ay) * dy) / lenSquared)) : 0;
  const px = x - (ax + t * dx), py = y - (ay + t * dy);
  return px * px + py * py;
}

function insideBridgeLane(bridges, x, y, radius) {
  return bridges.some(bridge => {
    // The bridge is a walkable dry strip; its approach extends slightly
    // beyond the rendered deck so the river bank cannot create a dead gap.
    const halfClearHeight = bridge.h / 2 - radius;
    return halfClearHeight > 0
      && Math.abs(y - bridge.y) <= halfClearHeight
      && x >= bridge.x - bridge.w / 2 - 3 * radius
      && x <= bridge.x + bridge.w / 2 + 3 * radius;
  });
}

function inUnbridgedRiver(map, x, y, radius) {
  if (insideBridgeLane(map.bridges, x, y, radius)) return false;
  const points = map.river.points;
  const clearance = map.river.width / 2 + radius;
  const limit = clearance * clearance;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    if (x < Math.min(ax, bx) - clearance || x > Math.max(ax, bx) + clearance
      || y < Math.min(ay, by) - clearance || y > Math.max(ay, by) + clearance) continue;
    if (distSquaredToSegment(x, y, ax, ay, bx, by) <= limit) return true;
  }
  return false;
}

// Pure, deterministic occupancy query against existing authored map content.
// Trees and crops remain cosmetic in D2 (not yet server-collidable objects).
export function isAuthoredPreviewWalkable(mapId, x, y, radius = PREVIEW_FIGHTER_RADIUS) {
  const map = getAuthoredMap(mapId);
  if (!map || !Number.isFinite(x) || !Number.isFinite(y)
    || !Number.isFinite(radius) || radius <= 0 || radius > 32
    || x < radius || y < radius
    || x > map.width - radius || y > map.height - radius) return false;

  if (mapId === MAP_IDS.tavern) {
    for (const f of map.furniture) {
      if (f.kind === "rug") continue;
      if (circleTouchesRect(x, y, radius, f.x, f.y, f.x + f.w, f.y + f.h)) return false;
    }
    return true;
  }

  if (mapId !== MAP_IDS.overworld) return false;
  for (const b of map.buildings) {
    if (circleTouchesRect(x, y, radius, b.x, b.y, b.x + b.w, b.y + b.h)) return false;
  }
  if (circleTouchesWalls(map.city, x, y, radius)) return false;
  return !inUnbridgedRiver(map, x, y, radius);
}

// Bounded per-frame swept and axis-sliding preview movement; caller must pass
// delta (not destination). Reject oversized/infinite requests without moving.
// Use at most 4 substeps for normal 230 units/s movement with capped 50 ms dt.
export function moveAuthoredPreview(mapId, position, dx, dy,
  radius = PREVIEW_FIGHTER_RADIUS) {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)
    || !getAuthoredMap(mapId)) return null;
  const result = { x: position.x, y: position.y };
  if (!isAuthoredPreviewWalkable(mapId, result.x, result.y, radius)
    || !Number.isFinite(dx) || !Number.isFinite(dy)
    || Math.hypot(dx, dy) > MAX_PREVIEW_FRAME_MOVE) return result;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / SUBSTEP_UNITS));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (isAuthoredPreviewWalkable(mapId, result.x + sx, result.y + sy, radius)) {
      result.x += sx;
      result.y += sy;
    } else {
      if (isAuthoredPreviewWalkable(mapId, result.x + sx, result.y, radius)) result.x += sx;
      if (isAuthoredPreviewWalkable(mapId, result.x, result.y + sy, radius)) result.y += sy;
    }
  }
  return result;
}
