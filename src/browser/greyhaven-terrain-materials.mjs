// Graphics 3C — deterministic, purely cosmetic Greyhaven street materials.
// This module consumes authored World coordinates; it never changes geometry,
// pathfinding, collisions, weather state, server state or building silhouettes.
const STONE_COLORS = Object.freeze(["#958a76", "#aa9a7f", "#b7a98e", "#8a806f", "#c1ae90"]);
const SOIL_COLORS = Object.freeze(["rgba(69,53,35,.26)", "rgba(96,75,48,.25)", "rgba(59,49,32,.21)"]);
const GRASS_COLORS = Object.freeze(["#526344", "#697453", "#7c8060", "#45583e"]);
const ROAD_IDS = new Set(["kings-road-west", "kings-road-east", "northern-road", "southern-road", "market-lane"]);
const PAVER_STEP = 24;
const COVER_STEP = 40;
const MAX_PAVERS = 900;
const MAX_COVER = 130;
const MAX_SOIL = 80;

export const GREYHAVEN_MATERIAL_VERSION = "3c-p2-2";

function hash(x, y, salt = 0) {
  let h = Math.imul(x ^ salt, 0x45d9f3b) ^ Math.imul(y, 0x119de1f3);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

// Only inspect the authored road segments touching this tile's neighborhood.
function segmentsForTile(roads, left, top, right, bottom) {
  const segments = [], pad = 110;
  for (const road of roads) {
    if (!ROAD_IDS.has(road.id)) continue;
    for (let i = 1; i < road.points.length; i++) {
      const [ax, ay] = road.points[i - 1], [bx, by] = road.points[i];
      if (Math.max(ax, bx) < left - pad || Math.min(ax, bx) > right + pad ||
          Math.max(ay, by) < top - pad || Math.min(ay, by) > bottom + pad) continue;
      const dx = bx - ax, dy = by - ay;
      segments.push({ax, ay, dx, dy, inverse: 1 / (dx * dx + dy * dy || 1), width: road.width});
    }
  }
  return segments;
}

function insideBuilding(x, y, buildings) {
  for (const b of buildings)
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  return false;
}

function nearBuilding(x, y, buildings) {
  for (const b of buildings) {
    // Eliminate the expensive distance calculation for the far majority of
    // road-edge grid samples while preserving the authored footprint test.
    if (x < b.x - 42 || x > b.x + b.w + 42 ||
        y < b.y - 42 || y > b.y + b.h + 42) continue;
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
    const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
    if (dx === 0 && dy === 0) return -1;
    const squared = dx * dx + dy * dy;
    if (squared < 42 * 42) return Math.sqrt(squared);
  }
  return Infinity;
}

function roadDistance(x, y, segments) {
  let closestSquared = Infinity, width = 0;
  for (const s of segments) {
    const t = Math.max(0, Math.min(1, ((x - s.ax) * s.dx + (y - s.ay) * s.dy) * s.inverse));
    const dx = x - s.ax - t * s.dx, dy = y - s.ay - t * s.dy;
    const d2 = dx * dx + dy * dy;
    if (d2 < closestSquared) { closestSquared = d2; width = s.width; }
  }
  return {distance: Math.sqrt(closestSquared), width};
}

// A stateless per-chunk plan. Padding guarantees tiles agree on seam-crossing
// material details: the same world-grid sample is evaluated on both sides.
export function createGreyhavenTerrainPlan(map, tile) {
  const empty = {pavers: [], soil: [], grass: []};
  if (map?.kind !== "outdoor" || map?.city?.id !== "greyhaven" ||
      !tile || ![tile.x, tile.y, tile.width, tile.height].every(Number.isFinite) ||
      tile.width <= 0 || tile.height <= 0 || tile.width > 512 || tile.height > 512)
    return empty;

  const left = Math.max(map.city.x, tile.x - 20);
  const top = Math.max(map.city.y, tile.y - 20);
  const right = Math.min(map.city.x + map.city.w, tile.x + tile.width + 20);
  const bottom = Math.min(map.city.y + map.city.h, tile.y + tile.height + 20);
  if (right < left || bottom < top) return empty;

  const segments = segmentsForTile(map.roads, left, top, right, bottom);
  if (!segments.length) return empty;
  const buildings = map.buildings.filter(b =>
    b.x < right + 42 && b.x + b.w > left - 42 &&
    b.y < bottom + 42 && b.y + b.h > top - 42);

  // Weathered, slightly irregular stones; deterministic at every zoom and
  // independent of render order, browser clock and multiplayer entities.
  for (let gy = Math.floor(top / PAVER_STEP); gy <= Math.ceil(bottom / PAVER_STEP); gy++) {
    for (let gx = Math.floor(left / PAVER_STEP); gx <= Math.ceil(right / PAVER_STEP); gx++) {
      if (empty.pavers.length >= MAX_PAVERS) break;
      const seed = hash(gx, gy), stagger = gy % 2 ? 9 : 0;
      const x = gx * PAVER_STEP + stagger + ((seed >>> 4) % 5) - 2;
      const y = gy * PAVER_STEP + ((seed >>> 9) % 5) - 2;
      if (x < map.city.x || x > map.city.x + map.city.w ||
          y < map.city.y || y > map.city.y + map.city.h) continue;
      const road = roadDistance(x, y, segments);
      if (road.distance > road.width * .44 || insideBuilding(x, y, buildings)) continue;
      empty.pavers.push({x, y, w: 18 + (seed % 4), h: 16 + ((seed >>> 7) % 3),
        tone: seed % STONE_COLORS.length});
    }
  }

  // Sparse earth and tufts only at existing road edges or building margins.
  for (let gy = Math.floor(top / COVER_STEP); gy <= Math.ceil(bottom / COVER_STEP); gy++) {
    for (let gx = Math.floor(left / COVER_STEP); gx <= Math.ceil(right / COVER_STEP); gx++) {
      const seed = hash(gx, gy, 31);
      const x = gx * COVER_STEP + (seed % 13) - 6;
      const y = gy * COVER_STEP + ((seed >>> 5) % 13) - 6;
      if (x < map.city.x || x > map.city.x + map.city.w ||
          y < map.city.y || y > map.city.y + map.city.h) continue;
      const building = nearBuilding(x, y, buildings);
      if (building < 0) continue;
      const road = roadDistance(x, y, segments);
      const edge = road.distance - road.width / 2;
      const verge = edge > 3 && edge < 42;
      const foundation = building >= 2 && building < 32;
      if (!verge && !foundation) continue;
      if (empty.soil.length < MAX_SOIL && (seed & 3) !== 0)
        empty.soil.push({x, y, tone: (seed >>> 8) % SOIL_COLORS.length,
          radius: 8 + (seed % 7)});
      if (empty.grass.length < MAX_COVER && (seed & 7) < 5 &&
          edge > 5 && building > 8 &&
          !(map.portals ?? []).some(p => Math.hypot(p.x - x, p.y - y) < p.radius))
        empty.grass.push({x, y, tone: (seed >>> 11) % GRASS_COLORS.length,
          height: 5 + (seed % 7)});
    }
  }
  return empty;
}

export function paintGreyhavenGroundDetails(ctx, map, tile) {
  const plan = createGreyhavenTerrainPlan(map, tile);
  for (const s of plan.soil) {
    ctx.fillStyle = SOIL_COLORS[s.tone];
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.radius, 5, -.18, 0, Math.PI * 2); ctx.fill();
  }
  for (const p of plan.pavers) {
    ctx.fillStyle = STONE_COLORS[p.tone];
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    // The dark base road is the natural visible mortar in the gaps.
  }
  for (const g of plan.grass) {
    ctx.strokeStyle = GRASS_COLORS[g.tone];
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(g.x - 4, g.y + 3);
    ctx.lineTo(g.x - 3, g.y - g.height);
    ctx.moveTo(g.x, g.y + 3);
    ctx.lineTo(g.x + 1, g.y - g.height * .8);
    ctx.moveTo(g.x + 4, g.y + 3);
    ctx.lineTo(g.x + 5, g.y - g.height * .7);
    ctx.stroke();
  }
  return {pavers: plan.pavers.length, soil: plan.soil.length, grass: plan.grass.length};
}
