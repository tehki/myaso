// Ground v1.0: read-only, world-anchored medieval battlefield renderer.
// Pure deterministic terrain sampling; cache/generation never touches physics.
export const GROUND_CHUNK_SIZE = 384;
export const GROUND_CACHE_LIMIT = 24;
export const GROUND_BUILD_PER_FRAME = 2;
const DETAIL_RESOLUTION = 96;
const TAU = Math.PI * 2;

export function groundHash(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const smooth = x => x * x * (3 - 2 * x);
const clamp01 = x => Math.max(0, Math.min(1, x));
const mix = (a, b, amount) => a + (b - a) * clamp01(amount);

function noise(x, y, scale, salt) {
  const ax = x / scale, ay = y / scale;
  const ix = Math.floor(ax), iy = Math.floor(ay);
  const fx = smooth(ax - ix), fy = smooth(ay - iy);
  return mix(
    mix(groundHash(ix, iy, salt), groundHash(ix + 1, iy, salt), fx),
    mix(groundHash(ix, iy + 1, salt), groundHash(ix + 1, iy + 1, salt), fx), fy);
}

// World-space noise samples are independent of chunk boundaries and draw order.
// Terrain remains fixed to the map as the smoothed camera follows the fighter.
export function groundColorAt(x, y, seed = 1729) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError("finite terrain coordinates required");
  const earth = clamp01((noise(x, y, 390, seed) * .6
    + noise(x + 84, y - 27, 150, seed + 1) * .4 - .41) * 3.3);
  const moisture = clamp01((noise(x - 110, y + 93, 210, seed + 2) - .57) * 3);
  const rubble = clamp01((noise(x + 123, y + 77, 130, seed + 3) - .72) * 5) * .42;
  const speckle = (noise(x, y, 14, seed + 4) - .5) * 24;
  const grass = [76, 87, 57], dirt = [114, 91, 64];
  const mud = [77, 68, 55], stone = [121, 119, 98];
  return grass.map((base, channel) => {
    let value = mix(base, dirt[channel], earth);
    value = mix(value, mud[channel], moisture * earth);
    value = mix(value, stone[channel], rubble);
    return Math.round(Math.max(0, Math.min(255, value + speckle)));
  });
}

export function groundVisibleChunks(cameraX, cameraY, width, height, zoom, maxTiles = 64) {
  if (![cameraX, cameraY, width, height, zoom].every(Number.isFinite)
    || width <= 0 || height <= 0 || zoom <= 0 || zoom > 2
    || !Number.isInteger(maxTiles) || maxTiles < 1 || maxTiles > 256) {
    throw new RangeError("invalid battlefield viewport");
  }
  const x0 = Math.floor((cameraX - width / (2 * zoom)) / GROUND_CHUNK_SIZE);
  const x1 = Math.floor((cameraX + width / (2 * zoom)) / GROUND_CHUNK_SIZE);
  const y0 = Math.floor((cameraY - height / (2 * zoom)) / GROUND_CHUNK_SIZE);
  const y1 = Math.floor((cameraY + height / (2 * zoom)) / GROUND_CHUNK_SIZE);
  const result = [];
  for (let iy = y0; iy <= y1 && result.length < maxTiles; iy++) {
    for (let ix = x0; ix <= x1 && result.length < maxTiles; ix++) {
      result.push({ ix, iy, key: ix + ":" + iy });
    }
  }
  return result;
}

export function createGroundCache(limit = GROUND_CACHE_LIMIT) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 128) throw new RangeError("invalid cache limit");
  const cached = new Map();
  return {
    get(key) {
      const item = cached.get(key);
      if (item !== undefined) {
        cached.delete(key);
        cached.set(key, item);
      }
      return item;
    },
    put(key, canvas) {
      cached.delete(key);
      cached.set(key, canvas);
      while (cached.size > limit) cached.delete(cached.keys().next().value);
    },
    get size() { return cached.size; },
    clear() { cached.clear(); },
  };
}

function paintGroundChunk(ix, iy, seed, createCanvas) {
  const texture = createCanvas();
  texture.width = texture.height = GROUND_CHUNK_SIZE;
  const context = texture.getContext("2d", { alpha: false });
  if (!context) throw new Error("2D terrain canvas unavailable");
  const pixels = context.createImageData(DETAIL_RESOLUTION, DETAIL_RESOLUTION);
  const step = GROUND_CHUNK_SIZE / DETAIL_RESOLUTION;
  for (let py = 0; py < DETAIL_RESOLUTION; py++) {
    for (let px = 0; px < DETAIL_RESOLUTION; px++) {
      const wx = ix * GROUND_CHUNK_SIZE + (px + .5) * step;
      const wy = iy * GROUND_CHUNK_SIZE + (py + .5) * step;
      const color = groundColorAt(wx, wy, seed);
      const offset = (py * DETAIL_RESOLUTION + px) * 4;
      pixels.data[offset] = color[0];
      pixels.data[offset + 1] = color[1];
      pixels.data[offset + 2] = color[2];
      pixels.data[offset + 3] = 255;
    }
  }
  const small = createCanvas();
  small.width = small.height = DETAIL_RESOLUTION;
  small.getContext("2d").putImageData(pixels, 0, 0);
  context.imageSmoothingEnabled = true;
  context.drawImage(small, 0, 0, GROUND_CHUNK_SIZE, GROUND_CHUNK_SIZE);

  // Local scatter avoids duplicate objects at chunk boundaries; the actual
  // material color is continuous world-space noise, so no grid seam appears.
  for (let index = 0; index < 120; index++) {
    const ox = 10 + groundHash(ix * 163 + index, iy, seed + 11) * (GROUND_CHUNK_SIZE - 20);
    const oy = 10 + groundHash(ix, iy * 173 + index, seed + 12) * (GROUND_CHUNK_SIZE - 20);
    const roll = groundHash(ix + index, iy - index, seed + 13);
    if (roll < .68) {
      const height = 2 + groundHash(ix + index, iy, seed + 14) * 5;
      context.strokeStyle = roll < .25 ? "rgba(151,155,103,.23)" : "rgba(31,47,29,.24)";
      context.lineWidth = .7;
      context.beginPath();
      context.moveTo(ox, oy);
      context.lineTo(ox - 1.5, oy - height);
      context.lineTo(ox + 1, oy - height - 1);
      context.stroke();
    } else if (roll < .91) {
      context.fillStyle = "rgba(195,174,135,.18)";
      context.beginPath();
      context.ellipse(ox, oy, 1.1 + 2 * (roll - .68), 1, .3, 0, TAU);
      context.fill();
    } else {
      context.fillStyle = "rgba(38,40,34,.23)";
      context.beginPath();
      context.ellipse(ox, oy, 3.5, 1.8, .3, 0, TAU);
      context.fill();
      context.fillStyle = "rgba(150,144,119,.42)";
      context.beginPath();
      context.ellipse(ox, oy - 1, 3, 1.35, .3, 0, TAU);
      context.fill();
    }
  }
  return texture;
}

export function createBattlefieldGround({ seed = 1729, cacheLimit = GROUND_CACHE_LIMIT,
  maxBuildPerFrame = GROUND_BUILD_PER_FRAME, createCanvas = () => document.createElement("canvas") } = {}) {
  if (!Number.isInteger(seed) || !Number.isInteger(maxBuildPerFrame) || maxBuildPerFrame < 0 || maxBuildPerFrame > 8) {
    throw new RangeError("invalid battlefield options");
  }
  const cache = createGroundCache(cacheLimit);
  const statistics = { rendered: 0, generated: 0, cached: 0 };
  return {
    stats: statistics,
    draw(ctx, camera, width, height, zoom) {
      const chunks = groundVisibleChunks(camera.x, camera.y, width, height, zoom);
      statistics.rendered = chunks.length;
      statistics.generated = 0;
      statistics.cached = cache.size;
      // The world-space viewport is already zoom-transformed by the caller.
      // Flat fallback tiles avoid stalls when the camera first visits new ground.
      ctx.fillStyle = "#566044";
      ctx.fillRect(width / 2 - width / (2 * zoom), height / 2 - height / (2 * zoom), width / zoom, height / zoom);
      for (const chunk of chunks) {
        let tile = cache.get(chunk.key);
        if (!tile && statistics.generated < maxBuildPerFrame) {
          tile = paintGroundChunk(chunk.ix, chunk.iy, seed, createCanvas);
          cache.put(chunk.key, tile);
          statistics.generated++;
        }
        const sx = width / 2 + chunk.ix * GROUND_CHUNK_SIZE - camera.x;
        const sy = height / 2 + chunk.iy * GROUND_CHUNK_SIZE - camera.y;
        if (tile) {
          ctx.drawImage(tile, sx, sy);
        } else {
          // A coherent world-sampled fallback avoids a flat-green hole while
          // amortized texture generation catches up over the next frames.
          const color = groundColorAt(chunk.ix * GROUND_CHUNK_SIZE + GROUND_CHUNK_SIZE / 2,
            chunk.iy * GROUND_CHUNK_SIZE + GROUND_CHUNK_SIZE / 2, seed);
          ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
          ctx.fillRect(sx, sy, GROUND_CHUNK_SIZE, GROUND_CHUNK_SIZE);
        }
      }
      statistics.cached = cache.size;
    },
    clear: () => cache.clear(),
  };
}

// No heavy gradients or per-fighter textures: two ellipses at the actual
// ground position. Jump lift affects body only, never this shadow.
export function drawGroundContactShadow(ctx, x, y, { airborne = false, dead = false } = {}) {
  ctx.save();
  ctx.globalAlpha = dead ? .08 : airborne ? .11 : .2;
  ctx.fillStyle = "#151c16";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, airborne ? 13 : 18, airborne ? 5 : 7, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha *= .5;
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 27, 11, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
