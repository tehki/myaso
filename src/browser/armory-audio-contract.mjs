// Sound A2 — proposed, dormant First Playable server-item audio boundary.
// This is NOT an authority check. Call consume() only with decoded receipts
// from an authenticated Core/Items transport; never with a local pointer
// request, optimistic inventory state, or client-synthesized confirmation.
// No online runtime currently imports this module. Integration requires Core
// and Items to agree on the exact receipt schema and session epoch.
const ITEM_CUES = Object.freeze({
  PICKUP: "swordPickup",
  EQUIP: "swordEquip",
  DROP: "swordDrop",
});
const ATTACK_CUES = Object.freeze({
  UNARMED: Object.freeze({ light: "fistLight", heavy: "fistHeavy", hit: "fistHit" }),
  SWORD: Object.freeze({ light: "light", heavy: "heavy", hit: "hit" }),
});
const idValid = value => typeof value === "string"
  && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9_.:-]+$/.test(value);
const MAX_U64 = (1n << 64n) - 1n;
// A Core/Items journal revision is u64, not necessarily a JS safe integer.
// Accept canonical decimal strings losslessly; small safe numeric fixtures
// remain supported until the normalized Core transport shape is approved.
function canonicalItemRevision(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? BigInt(value) : null;
  }
  if (typeof value !== "string" || !/^[1-9][0-9]{0,19}$/.test(value)) return null;
  const revision = BigInt(value);
  return revision <= MAX_U64 ? revision : null;
}

/**
 * A cue choice only. Caller MUST get equipment from authoritative actor
 * state, never from a pending local pickup or decorative sword animation.
 * Missing/unknown authority data fails silent rather than inventing a blade.
 */
export function cueForAuthoritativeStrike(equipment, action) {
  if (!equipment || !Object.hasOwn(ATTACK_CUES, equipment.kind)) return null;
  if (equipment.kind === "UNARMED" && equipment.itemId != null) return null;
  if (equipment.kind === "SWORD" && !idValid(equipment.itemId)) return null;
  // No prototype/inherited names such as "constructor" or "toString"
  // may become presentation cues when input state is malformed.
  const choices = ATTACK_CUES[equipment.kind];
  return Object.hasOwn(choices, action) ? choices[action] : null;
}

/**
 * Suppress repeated, stale and cross-session confirmed item audio.
 * De-duplication uses monotonically advancing per-item revisions and bounded
 * per-item memory; receipt IDs are validated, but not stored indefinitely.
 * The proposed receipt has:
 * {source:"authoritative", status:"COMMITTED", sessionEpoch:string,
 *  receiptId:string, actorNetId:positive int, itemId:string,
 *  itemRevision:canonical decimal u64 string (or safe positive integer fixture),
 *  operation:"PICKUP"|"EQUIP"|"DROP"}.
 *
 * source/status are presentation contracts, NOT cryptographic proofs.
 * Core must verify origin, ownership, monotonicity and event semantics before
 * this adapter is invoked. beginSession() must use a session epoch issued by
 * Core, never generated from a player-supplied net ID or pickup click.
 */
export function createConfirmedArmoryCueGate({ maxItems = 128 } = {}) {
  const revisionByItem = new Map();
  let currentSessionEpoch = null;
  const limit = Number.isSafeInteger(maxItems) && maxItems > 0 ? maxItems : 128;
  function reset() {
    revisionByItem.clear();
    currentSessionEpoch = null;
  }
  return Object.freeze({
    beginSession(sessionEpoch) {
      if (!idValid(sessionEpoch)) { reset(); return false; }
      if (sessionEpoch !== currentSessionEpoch) {
        revisionByItem.clear();
      }
      currentSessionEpoch = sessionEpoch;
      return true;
    },
    consume(receipt) {
      if (currentSessionEpoch === null || receipt?.sessionEpoch !== currentSessionEpoch
        || receipt?.source !== "authoritative" || receipt?.status !== "COMMITTED"
        || !Object.hasOwn(ITEM_CUES, receipt?.operation)
        || !idValid(receipt?.itemId) || !idValid(receipt?.receiptId)
        || !Number.isSafeInteger(receipt?.actorNetId) || receipt.actorNetId <= 0) return null;
      const itemRevision = canonicalItemRevision(receipt.itemRevision);
      if (itemRevision === null) return null;
      const lastRevision = revisionByItem.get(receipt.itemId);
      if (lastRevision !== undefined && itemRevision <= lastRevision) return null;
      // Fail silent when exhausted rather than evicting old receipts and
      // accidentally replaying stale sounds during long sessions.
      if (lastRevision === undefined && revisionByItem.size >= limit) return null;
      revisionByItem.set(receipt.itemId, itemRevision);
      return Object.freeze({
        cue: ITEM_CUES[receipt.operation],
        actorNetId: receipt.actorNetId,
        itemId: receipt.itemId,
        // Output a lossless decimal; never serialize a JS BigInt into JSON.
        itemRevision: itemRevision.toString(),
        receiptId: receipt.receiptId,
      });
    },
    reset,
  });
}
