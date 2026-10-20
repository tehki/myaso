// Dormant M147 UI projection of a server-authenticated HIT receipt.
// Not wired to the active network client. A matching HP delta cannot prove
// the attacker's identity; never derive hit-confirm from spectator snapshots.
import { validateHitReceipt } from "../network/m147-hit-receipt-codec.mjs";

function isNewer32(candidate, reference) {
  return candidate !== reference && ((candidate - reference) >>> 0) < 0x80000000;
}

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

// The transport owner must serialize reliable receipts, validate the current
// server-issued lease, and reset this presenter ONLY when that verified lease
// changes. This helper does NOT authenticate packets or guard stale epochs.
export function createHitReceiptPresenter() {
  let newest = null;
  return {
    observe(receipt, ownId) {
      const event = validateHitReceipt(receipt);
      if (newest !== null && !isNewer32(event.sequence, newest)) return null;
      const result = presentHitReceipt(event, ownId);
      newest = event.sequence;
      return result;
    },
    reset() { newest = null; },
  };
}
