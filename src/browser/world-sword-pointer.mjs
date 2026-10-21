// Classification only; never mutates item ownership or attack/game state.
// Hit rectangles must come from swords actually rendered in the final canvas frame.
const MAX_RENDERED_ITEMS = 256;
function validPointer(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y);
}
function validItemId(id) {
  // Opaque Core/Items identifier: no local numeric/ASCII-only remapping.
  // Matches Graphics 3B / UI alpha gate; server still validates identity.
  return typeof id === "string" && id.length > 0 && id.length <= 160;
}
function hit(r, p) {
  return r && Number.isFinite(r.x) && Number.isFinite(r.y)
    && Number.isFinite(r.width) && Number.isFinite(r.height)
    && r.width > 0 && r.height > 0
    && p.x >= r.x && p.y >= r.y
    && p.x < r.x + r.width && p.y < r.y + r.height;
}
export function pickRenderedSword(point, sprites) {
  if (!validPointer(point) || !Array.isArray(sprites)
    || sprites.length > MAX_RENDERED_ITEMS) return null;
  let best = null, bestOrder = -Infinity;
  for (let i = 0; i < sprites.length; i++) {
    const s = sprites[i];
    if (!s || s.kind !== "sword" || s.rendered !== true
      || s.occluded === true || !validItemId(s.itemId)
      || !hit(s.bounds, point)) continue;
    const order = Number.isFinite(s.paintOrder) ? s.paintOrder : i;
    if (order >= bestOrder) {
      bestOrder = order;
      best = s.itemId;
    }
  }
  return best;
}
const noInteraction = Object.freeze({ handled: false, itemId: null });
const reservedOnly = Object.freeze({ handled: true, itemId: null });
// UI must call down before the existing LMB charge handler, then up before
// existing attack release. A canceled sword gesture still suppresses attack.
export function createSwordPointerGate() {
  const pending = new Map();
  return {
    down({ button, pointerId, x, y }, renderedSprites) {
      if (button !== 0 || !Number.isSafeInteger(pointerId)) return noInteraction;
      // A repeated down cannot silently change the originally reserved sword.
      if (pending.has(pointerId)) return reservedOnly;
      const id = pickRenderedSword({ x, y }, renderedSprites);
      if (id === null) return noInteraction;
      pending.set(pointerId, id);
      return reservedOnly;
    },
    up({ button, pointerId, x, y }, renderedSprites) {
      if (button !== 0 || !pending.has(pointerId)) return noInteraction;
      const id = pending.get(pointerId);
      pending.delete(pointerId);
      return pickRenderedSword({ x, y }, renderedSprites) === id
        ? { handled: true, itemId: id } : reservedOnly;
    },
    cancel(pointerId) {
      return pending.delete(pointerId);
    },
    reset() {
      pending.clear();
    },
  };
}
