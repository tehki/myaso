// UI-only gesture reservation for Graphics 3B's visible-sword-alpha hit
// candidate. No Combat handler, item wire, inventory or authority mutation.
// The caller must feed an *already presented* final-frame Graphics plan.
const NO_HIT = Object.freeze({ handled: false, itemId: null });
const RESERVED = Object.freeze({ handled: true, itemId: null });

function isPoint(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y)
    && p.x >= 0 && p.y >= 0;
}
function nonempty(value) {
  // Graphics 3B treats canonical IDs as opaque strings up to 160 chars.
  // They are never embedded in HTML, parsed into numbers or minted here.
  return typeof value === "string" && value.length > 0 && value.length <= 160;
}
function presentedScene(scene) {
  return scene && scene.plan && Array.isArray(scene.plan.swords)
    && nonempty(scene.plan.rackVersion) && nonempty(scene.plan.zoneId)
    && Number.isSafeInteger(scene.frameId) && scene.frameId >= 0
    && scene.frameId === scene.lastPresentedFrameId
    && typeof scene.sampleAlpha === "function";
}
function acceptedCandidate(candidate, scene, point) {
  if (!candidate || candidate.visualCandidateOnly !== true
    || candidate.serverPickupCommitted !== false
    || !nonempty(candidate.itemId) || !nonempty(candidate.socketId)
    || !Number.isSafeInteger(candidate.revision) || candidate.revision < 0
    || !Number.isFinite(candidate.alpha) || candidate.alpha < 64
    || !candidate.sourcePixel
    || !Number.isSafeInteger(candidate.sourcePixel.x)
    || !Number.isSafeInteger(candidate.sourcePixel.y)) return null;
  // Do not accept an unrelated or fabricated candidate not present in the
  // last-presented committed World/Graphics visual plan.
  const sprite = scene.plan.swords.find(s =>
    s && s.kind === "sword" && s.id === candidate.itemId
    && s.socketId === candidate.socketId && s.revision === candidate.revision);
  if (!sprite) return null;
  // Defense in depth against stale/incorrect visual hit callbacks: the
  // candidate must be the precise decoded source pixel under this actual
  // painted sprite, not merely an item ID found somewhere in the rack.
  if (!Number.isFinite(sprite.x) || !Number.isFinite(sprite.y)
    || !Number.isFinite(sprite.width) || !Number.isFinite(sprite.height)
    || sprite.width <= 0 || sprite.height <= 0
    || !Number.isSafeInteger(sprite.sourceWidth)
    || !Number.isSafeInteger(sprite.sourceHeight)
    || sprite.sourceWidth <= 0 || sprite.sourceHeight <= 0
    || !Number.isFinite(point.x) || !Number.isFinite(point.y)
    || point.x < sprite.x || point.y < sprite.y
    || point.x >= sprite.x + sprite.width
    || point.y >= sprite.y + sprite.height) return null;
  const u = Math.floor((point.x - sprite.x) * sprite.sourceWidth / sprite.width);
  const v = Math.floor((point.y - sprite.y) * sprite.sourceHeight / sprite.height);
  if (u < 0 || v < 0 || u >= sprite.sourceWidth || v >= sprite.sourceHeight
    || candidate.sourcePixel.x !== u || candidate.sourcePixel.y !== v) return null;
  // Even if the Graphics callback accidentally reports an opaque candidate,
  // do not reserve Combat over genuinely transparent image source pixels.
  const actualAlpha = scene.sampleAlpha(sprite.asset, u, v);
  if (!Number.isFinite(actualAlpha) || actualAlpha < 64) return null;
  return {
    itemId: candidate.itemId,
    socketId: candidate.socketId,
    revision: candidate.revision,
    rackVersion: scene.plan.rackVersion,
    zoneId: scene.plan.zoneId,
  };
}

export function createAlphaSwordGestureGate(hitTestVisibleSwordAlpha) {
  if (typeof hitTestVisibleSwordAlpha !== "function") {
    throw new TypeError("Graphics alpha-sword hit-test function is required");
  }
  const pending = new Map();
  function resolve(point, scene) {
    if (!isPoint(point) || !presentedScene(scene)) return null;
    try {
      return acceptedCandidate(
        hitTestVisibleSwordAlpha(scene.plan, point, scene.sampleAlpha), scene, point);
    } catch {
      // Failed decoding, late canvas removal and scene transition are all
      // non-interactions, never reasons to create a speculative pickup.
      return null;
    }
  }
  return {
    down({button, pointerId, x, y} = {}, scene) {
      if (button !== 0 || !Number.isSafeInteger(pointerId)) return NO_HIT;
      // Repeated downs cannot silently retarget the original LMB gesture.
      if (pending.has(pointerId)) return RESERVED;
      const current = resolve({x, y}, scene);
      if (!current) return NO_HIT;
      pending.set(pointerId, current);
      // UI/Combat integration will consume this down *before* LMB charge.
      return RESERVED;
    },
    up({button, pointerId, x, y} = {}, scene) {
      if (button !== 0 || !Number.isSafeInteger(pointerId)
        || !pending.has(pointerId)) return NO_HIT;
      const original = pending.get(pointerId);
      pending.delete(pointerId);
      const current = resolve({x, y}, scene);
      // Different ID, zone, rack revision, socket, item revision, alpha or
      // missing presentation? It remains a RESERVED gesture, not an attack.
      if (!current || Object.keys(original).some(k => current[k] !== original[k])) {
        return RESERVED;
      }
      // This is an untrusted visual intent for Core/Items; never equip here.
      return { handled: true, itemId: original.itemId };
    },
    cancel(pointerId) { return pending.delete(pointerId); },
    reset() { pending.clear(); },
  };
}
