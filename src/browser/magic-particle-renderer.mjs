// P2: read-only canvas adapter for client-only elemental particles.
// No simulation, hit tests, network sends, input handlers, or mutable world state.
import { ARENA_VIEW_ZOOM } from "./arena-viewport.mjs";

const COLORS = Object.freeze({
  fire: "#ff934c",
  ice: "#a9e9ff",
  lightning: "#d0bfff",
  wind: "#b4e2b8",
  arcane: "#dbaaff",
});
const MAX_CANVAS_DIMENSION = 8192;
const VISUAL_PADDING = 12;

function finiteCamera(camera) {
  return Number.isFinite(camera?.x) && Number.isFinite(camera?.y)
    && Math.abs(camera.x) <= 1_000_000 && Math.abs(camera.y) <= 1_000_000;
}

/**
 * Render already-accepted cosmetic events after the arena's zoom transform has
 * been restored, before fixed-size combat HUD/tells. Uses the same projection
 * as remote-vitals rendering, never feeds back into gameplay.
 *
 * @returns number of visible particles actually drawn
 */
export function drawMagicParticles(ctx, pool, camera, width, height, zoom = ARENA_VIEW_ZOOM) {
  if (!ctx || typeof ctx.save !== "function" || typeof ctx.restore !== "function"
    || typeof ctx.beginPath !== "function" || typeof ctx.arc !== "function"
    || typeof ctx.fill !== "function" || typeof ctx.stroke !== "function"
    || typeof ctx.moveTo !== "function" || typeof ctx.lineTo !== "function"
    || typeof ctx.closePath !== "function"
    || !pool || typeof pool.forEachVisible !== "function"
    || !finiteCamera(camera) || !Number.isFinite(width) || !Number.isFinite(height)
    || width <= 0 || height <= 0
    || width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION
    || !Number.isFinite(zoom) || zoom <= 0 || zoom > 1) return 0;

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.hypot(halfWidth, halfHeight) / zoom + VISUAL_PADDING / zoom;
  let drawn = 0;
  ctx.save();
  try {
    pool.forEachVisible({ x: camera.x, y: camera.y, radius }, (x, y, life, kind) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(life)
        || life <= 0 || !Object.hasOwn(COLORS, kind)) return;
      const sx = halfWidth + (x - camera.x) * zoom;
      const sy = halfHeight + (y - camera.y) * zoom;
      if (sx < -VISUAL_PADDING || sy < -VISUAL_PADDING
        || sx > width + VISUAL_PADDING || sy > height + VISUAL_PADDING) return;
      const size = (1.25 + Math.min(1, life) * 2.75) * zoom;
      ctx.globalAlpha = 0.18 + Math.min(1, life) * 0.65;
      ctx.fillStyle = COLORS[kind];
      ctx.strokeStyle = COLORS[kind];
      ctx.lineWidth = Math.max(0.8, zoom);
      ctx.beginPath();
      switch (kind) {
        case "ice":
          ctx.moveTo(sx, sy - size);
          ctx.lineTo(sx + size * 0.7, sy);
          ctx.lineTo(sx, sy + size);
          ctx.lineTo(sx - size * 0.7, sy);
          ctx.closePath();
          ctx.fill();
          break;
        case "lightning":
          ctx.moveTo(sx - size, sy - size);
          ctx.lineTo(sx + size * 0.25, sy);
          ctx.lineTo(sx - size * 0.2, sy);
          ctx.lineTo(sx + size, sy + size);
          ctx.stroke();
          break;
        case "wind":
          ctx.arc(sx, sy, size, -Math.PI * 0.8, Math.PI * 0.2);
          ctx.stroke();
          break;
        case "arcane":
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        default:
          ctx.arc(sx, sy, size, 0, Math.PI * 2);
          ctx.fill();
          break;
      }
      drawn += 1;
    });
  } finally {
    ctx.restore();
  }
  return drawn;
}
