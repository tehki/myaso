import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";

// 360ms knockdown at 60 authoritative ticks/s expires within 22 ticks.
// All comparisons in this verifier use only server ticks; browser epochs never
// provide proof of an action-active transition.
export const M206_KNOCKDOWN_TICKS = 22;
export function verifyM206ServerKnockdownPunish(output, { kickerId, defenderId, punisherId }) {
  const ids = [kickerId, defenderId, punisherId];
  if (!ids.every(Number.isSafeInteger) || ids.some(id => id <= 0)
      || new Set(ids).size !== 3) {
    throw new RangeError("M206 needs three distinct server-authoritative fighter IDs");
  }
  const rows = parseM201ServerProof(output);
  const knockdowns = rows.filter(r => r.kind === "action"
    && r.fighter === defenderId && r.to === 19);
  if (knockdowns.length === 0) throw new Error("M206 missing authoritative defender knockdown");
  const knockdown = knockdowns.at(-1);
  const kickerActives = rows.filter(r => r.kind === "action"
    && r.fighter === kickerId && r.to === 13
    && r.tick <= knockdown.tick && r.tick >= knockdown.tick - 12);
  if (kickerActives.length !== 1) {
    throw new Error("M206 knockdown not attributable to genuine kicker active phase");
  }
  const windups = rows.filter(r => r.kind === "action"
    && r.fighter === punisherId && r.to === 1 && r.tick > knockdown.tick);
  if (windups.length !== 1) throw new Error("M206 needs one post-knockdown light windup");
  const windup = windups[0];
  const actives = rows.filter(r => r.kind === "action"
    && r.fighter === punisherId && r.from === 1 && r.to === 2
    && r.tick > windup.tick && r.tick - windup.tick <= 12
    && r.tick < knockdown.tick + M206_KNOCKDOWN_TICKS);
  if (actives.length !== 1) throw new Error("M206 missing same-strike server attack-active edge");
  const active = actives[0];
  const hits = rows.filter(r => r.kind === "hit" && r.tick >= knockdown.tick);
  if (hits.length !== 1 || hits[0].attacker !== punisherId
    || hits[0].target !== defenderId || hits[0].damage !== 34 || hits[0].hp !== 66
    || hits[0].tick < active.tick || hits[0].tick > active.tick + 8
    || hits[0].tick >= knockdown.tick + M206_KNOCKDOWN_TICKS) {
    throw new Error("M206 missing one exact server 34 HP victim hit within knockdown");
  }
  const recovery = rows.find(r => r.kind === "action" && r.fighter === defenderId
    && r.from === 19 && r.tick > knockdown.tick);
  if (recovery && recovery.tick <= hits[0].tick) {
    throw new Error("M206 light hit occurred after authoritative knockdown recovery");
  }
  return { kickerActive: kickerActives[0], knockdown, windup, active,
    hit: hits[0], recovery: recovery ?? null };
}
