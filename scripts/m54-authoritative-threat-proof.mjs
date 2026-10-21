import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";

// Loopback acceptance evidence only, never a live HIT receipt or a substitute
// for actual victim DOM phases. Stale DOM HP cannot certify a second hit.
export function readM54AuthoritativeHit(output, { attackerId, victimId }) {
  if (![attackerId, victimId].every(id => Number.isSafeInteger(id) && id > 0) || attackerId === victimId) {
    throw new RangeError("M54 needs distinct authoritative attacker/victim identities");
  }
  const rows = parseM201ServerProof(output);
  const hits = rows.filter(row => row.kind === "hit");
  if (!hits.length) return null;
  if (hits.length !== 1 || hits[0].attacker !== attackerId || hits[0].target !== victimId
    || hits[0].damage !== 34 || hits[0].hp !== 66) {
    throw new Error("M54 requires exactly one authoritative 34HP hit leaving only the victim at66HP");
  }
  const hit = hits[0];
  const windup = rows.find(row => row.kind === "action" && row.fighter === attackerId
    && row.to === 1 && row.tick < hit.tick);
  const active = windup && rows.find(row => row.kind === "action" && row.fighter === attackerId
    && row.from === 1 && row.to === 2 && row.tick > windup.tick
    && row.tick - windup.tick <= 9 && row.tick <= hit.tick && hit.tick - row.tick <= 5);
  if (!windup || !active) throw new Error("M54 hit lacks genuine matching server windup/active");
  return { windup, active, hit };
}
