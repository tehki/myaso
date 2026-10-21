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
function acceptedCandidate(candidate, scene) {
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
        hitTestVisibleSwordAlpha(scene.plan, point, scene.sampleAlpha), scene);
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
