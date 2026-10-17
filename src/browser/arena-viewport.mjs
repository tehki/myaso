// Presentation-only camera. World coordinates and authoritative combat
// geometry are deliberately never multiplied by this scale.
export const ARENA_VIEW_ZOOM = 0.84;

export function projectArenaPoint(worldX, worldY, cameraX, cameraY, width, height, zoom = ARENA_VIEW_ZOOM) {
  if (![worldX, worldY, cameraX, cameraY, width, height, zoom].every(Number.isFinite)
    || width <= 0 || height <= 0 || zoom <= 0 || zoom > 1) {
    throw new RangeError("valid world position, viewport and zoom required");
  }
  return {
    x: width / 2 + (worldX - cameraX) * zoom,
    y: height / 2 + (worldY - cameraY) * zoom,
  };
}

// A target must truly be outside the visible combat canvas. Point markers
// toward its *actual* direction, and keep each marker at a small safe inset.
// The cap and world-range limit prevent clutter and remote-interest leakage.
export function nearbyOffscreenPointers(entities, ownId, camera, width, height, {
  zoom = ARENA_VIEW_ZOOM,
  inset = 26,
  maxDistance = 1200,
  maxPointers = 5,
  deadAction = -1,
} = {}) {
  if (![camera?.x, camera?.y, width, height, zoom, inset, maxDistance].every(Number.isFinite)
    || width <= 2 * inset || height <= 2 * inset || zoom <= 0 || zoom > 1
    || inset < 0 || maxDistance <= 0 || !Number.isInteger(maxPointers)
    || maxPointers < 0 || maxPointers > 8) {
    throw new RangeError("invalid viewport pointer bounds");
  }
  const candidates = [];
  for (const enemy of entities) {
    if (!Number.isInteger(enemy.netId) || enemy.netId <= 0 || enemy.netId === ownId
      || enemy.action === deadAction || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
    const dx = enemy.x - camera.x;
    const dy = enemy.y - camera.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-4 || distance > maxDistance) continue;
    const screenDx = dx * zoom;
    const screenDy = dy * zoom;
    const halfW = width / 2, halfH = height / 2;
    // Avoid pointers for visible fighters, including those at the boundary.
    if (Math.abs(screenDx) <= halfW && Math.abs(screenDy) <= halfH) continue;
    const edge = Math.min(
      screenDx === 0 ? Infinity : (halfW - inset) / Math.abs(screenDx),
      screenDy === 0 ? Infinity : (halfH - inset) / Math.abs(screenDy),
    );
    candidates.push({
      netId: enemy.netId,
      x: halfW + screenDx * edge,
      y: halfH + screenDy * edge,
      angle: Math.atan2(screenDy, screenDx),
      distance,
    });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.netId - b.netId);
  return candidates.slice(0, maxPointers);
}
