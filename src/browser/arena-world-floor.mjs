/**
 * Render-only Arena Lite material anchored to the authoritative world camera.
 *
 * The source tile repeats seamlessly; camera movement changes only the
 * Canvas transform, never gameplay positions, wire messages, or hitboxes.
 * Creating the CanvasPattern once avoids per-frame floor recomputation.
 */
import { ARENA_VIEW_ZOOM } from "./arena-viewport.mjs";

export function createWorldAnchoredArenaFloor(ctx, tile, {zoom=ARENA_VIEW_ZOOM}={}) {
  if (!ctx || typeof ctx.createPattern !== "function" || typeof ctx.fillRect !== "function"
      || typeof ctx.save !== "function" || typeof ctx.restore !== "function"
      || typeof ctx.translate !== "function" || typeof ctx.scale !== "function"
      || !Number.isInteger(tile?.width) || !Number.isInteger(tile?.height)
      || tile.width !== 960 || tile.height !== 540
      || !Number.isFinite(zoom) || zoom <= 0 || zoom > 1) {
    throw new TypeError("Arena world floor requires canonical tile, Canvas 2D and presentation zoom");
  }
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) throw new Error("Arena world floor pattern could not be created");
  let draws = 0;
  return {
    draw(camera, width, height) {
      if (![camera?.x, camera?.y, width, height].every(Number.isFinite)
        || width !== 960 || height !== 540) {
        throw new RangeError("Arena world floor requires a valid 960x540 camera viewport");
      }
      // Pattern origin is world(-tile.width/2,-tile.height/2), so the tile's
      // visual center initially meets the local Knight at canvas center.
      // Camera +X moves texture -X on screen. The same zoom transforms both
      // ground and world combat sprites without affecting their hitboxes.
      const pad = 2 / zoom;
      const x = camera.x + tile.width / 2 - width / (2 * zoom) - pad;
      const y = camera.y + tile.height / 2 - height / (2 * zoom) - pad;
      ctx.save();
      try {
        ctx.translate(width / 2, height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-camera.x - tile.width / 2, -camera.y - tile.height / 2);
        ctx.fillStyle = pattern;
        ctx.fillRect(x, y, width / zoom + 2 * pad, height / zoom + 2 * pad);
      } finally {
        ctx.restore();
      }
      draws++;
    },
    metrics() { return { draws, patternCreates: 1 }; },
  };
}
