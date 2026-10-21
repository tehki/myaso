import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";
import { COMBAT } from "../src/combat/model.mjs";

// Replication may omit a short active phase. Require the actual server
// windup -> active transition and victim knockdown in the SAME server tick;
// never manufacture a browser transition or infer contact from a HUD cue.
export function readM161OpeningKickProof(output, { kickerId, defenderId }) {
  if (![kickerId, defenderId].every(id => Number.isSafeInteger(id) && id > 0)
    || kickerId === defenderId) {
    throw new RangeError("M161 needs distinct authoritative kicker and victim IDs");
  }
  const rows = parseM201ServerProof(output);
  const active = rows.find(row => row.kind === "action" && row.fighter === kickerId
    && row.from === 12 && row.to === 13);
  if (!active) return null;
  const windup = rows.find(row => row.kind === "action" && row.fighter === kickerId
    && row.to === 12 && row.tick < active.tick
    && active.tick - row.tick <= Math.ceil(COMBAT.kick.windupMs * 60 / 1000));
  const knockdown = rows.find(row => row.kind === "action" && row.fighter === defenderId
    && row.from !== 19 && row.to === 19 && row.tick === active.tick);
  if (!windup || !knockdown) return null;
  if (rows.some(row => row.kind === "hit" || row.kind === "break" || row.kind === "parry")) {
    throw new Error("M161 opening control-only kick changed damage/guard/parry state");
  }
  return { source: "authoritative-server-ticks", windup, active, knockdown };
}
