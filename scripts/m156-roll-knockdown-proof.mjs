import { COMBAT } from "../src/combat/model.mjs";
import { NETWORK } from "../src/network/constants.mjs";
import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";

// Browser receive epochs measure delivery/rendering, not elapsed server combat.
// Require the actual roll, knockdown, light and unique hit within the unchanged
// simulation-time window; delayed DOM observations cannot manufacture a pass.
export function verifyM156RollKnockdownPunish(output, { rollerId, defenderId, punisherId }) {
  const ids = [rollerId, defenderId, punisherId];
  if (!ids.every(id => Number.isSafeInteger(id) && id > 0) || new Set(ids).size !== 3) {
    throw new RangeError("M156 needs three distinct authoritative fighter IDs");
  }
  const rows = parseM201ServerProof(output);
  const one = (matches, name) => {
    if (matches.length !== 1) throw new Error(`M156 needs one actual ${name}`);
    return matches[0];
  };
  const roll = one(rows.filter(r => r.kind === "action" && r.fighter === rollerId
    && r.from === 0 && r.to === 4), "roll");
  const knockdown = one(rows.filter(r => r.kind === "action" && r.fighter === defenderId
    && r.to === 19), "victim knockdown");
  const rollEnd = one(rows.filter(r => r.kind === "action" && r.fighter === rollerId
    && r.from === 4 && r.to === 5 && r.tick > roll.tick), "roll recovery");
  if (knockdown.tick < roll.tick || knockdown.tick >= rollEnd.tick
    || (knockdown.tick - roll.tick) * 1000 >= COMBAT.dodge.durationMs * NETWORK.serverSimulationHz) {
    throw new Error("M156 knockdown outside actual roll");
  }
  const windup = one(rows.filter(r => r.kind === "action" && r.fighter === punisherId
    && r.to === 1 && r.tick > knockdown.tick), "light windup");
  const active = one(rows.filter(r => r.kind === "action" && r.fighter === punisherId
    && r.from === 1 && r.to === 2 && r.tick > windup.tick && r.tick - windup.tick <= 9), "light active");
  const hit = one(rows.filter(r => r.kind === "hit"), "hit");
  const inside = tick => (tick - knockdown.tick) * 1000
    < COMBAT.dodge.collisionKnockdownMs * NETWORK.serverSimulationHz;
  if (hit.attacker !== punisherId || hit.target !== defenderId || hit.damage !== 34 || hit.hp !== 66
    || hit.tick < active.tick || hit.tick > active.tick + 5 || !inside(active.tick) || !inside(hit.tick)) {
    throw new Error("M156 needs exact 34 HP victim hit within original knockdown time");
  }
  const recovery = rows.find(r => r.kind === "action" && r.fighter === defenderId
    && r.from === 19 && r.tick > knockdown.tick);
  if (recovery && recovery.tick <= hit.tick) throw new Error("M156 hit at or after victim recovery");
  return { roll, rollEnd, knockdown, windup, active, hit, recovery: recovery ?? null };
}
