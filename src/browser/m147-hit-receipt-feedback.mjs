// Dormant M147 UI projection of a server-authenticated HIT receipt.
// Not wired to the active network client. A matching HP delta cannot prove
// the attacker's identity; never derive hit-confirm from spectator snapshots.
import { validateHitReceipt } from "../network/m147-hit-receipt-codec.mjs";

export function presentHitReceipt(receipt, ownId) {
  const event = validateHitReceipt(receipt);
  if (!Number.isInteger(ownId) || ownId <= 0 || ownId > 0xffffffff) {
    throw new RangeError("ownId must be a verified, non-zero uint32");
  }
  const damage = String(event.damage);
  if (event.target === ownId) {
    return { kind: "hit", text: `Hit taken - ${damage} HP.`, feedback: "damage-taken", durationMs: 700 };
  }
  if (event.attacker === ownId) {
    return { kind: "hit", text: `Opponent hit - ${damage} HP.`, feedback: "hit-confirm", durationMs: 700 };
  }
  // A spectator must not claim an attack because a rival's HP decreased.
  return null;
}

// DORMANT review-only presenter. The authenticated transport owner must bind
// this to its accepted actor + delivery lease, and call reset() only on a
// verified new incarnation; neither reset() nor numeric ownId authenticates
// a connection. Never interpret peer HP changes as attacker credit.
export function createHitReceiptPresenter() {
  let newest = null;
  let boundActor = null;
  return {
    observe(receipt, ownId) {
      const event = validateHitReceipt(receipt);
      if (!Number.isInteger(ownId) || ownId <= 0 || ownId > 0xffffffff)
        throw new RangeError("ownId must be a verified, non-zero uint32");
      if (boundActor !== null && ownId !== boundActor)
        throw new Error("HIT presenter actor swap requires a verified new lease reset");
      // The proposed per-recipient HIT inbox must retire at u32 wrap. Do not
      // let this UI-only projection silently credit seq0 on the same lease.
      if (newest === 0xffffffff && event.sequence < newest)
        throw new Error("HIT sequence wrap requires retirement and verified lease reset");
      if (newest !== null && event.sequence <= newest) return null;
      const result = presentHitReceipt(event, ownId);
      boundActor = ownId;
      newest = event.sequence;
      return result;
    },
    reset() {
      newest = null;
      boundActor = null;
    },
  };
}
