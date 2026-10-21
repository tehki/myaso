import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { COMBAT_ACTION as A } from "../src/browser/combat-readability.mjs";

// A replicated recovery does not establish an active strike. Require the
// actual server edges, including their unchanged simulation-time bounds.
export function readM171RejectedFeintProof(output, { fighterId, heavy = false }) {
  if (!Number.isSafeInteger(fighterId) || fighterId <= 0 || typeof heavy !== "boolean") {
    throw new RangeError("M171 requires an authoritative fighter and attack kind");
  }
  const rows = parseM201ServerProof(output);
  const actions = rows.filter(row => row.kind === "action" && row.fighter === fighterId);
  if (actions.some(row => row.to === A.feintRecovery)) {
    throw new Error("M171 rejected feint entered authoritative feint recovery");
  }
  if (rows.some(row => row.kind === "hit" || row.kind === "block"
    || row.kind === "break" || row.kind === "parry")) {
    throw new Error("M171 isolated exhausted strike resolved combat contact");
  }
  const kinds = heavy
    ? [[A.heavyAttackWindup, A.heavyAttackActive, A.heavyAttackRecovery, COMBAT.heavyAttack]]
    : [[A.attackWindup, A.attackActive, A.attackRecovery, COMBAT.attack],
      [A.attackLeftWindup, A.attackLeftActive, A.attackLeftRecovery, COMBAT.directionalAttack],
      [A.attackRightWindup, A.attackRightActive, A.attackRightRecovery, COMBAT.directionalAttack]];
  for (const [windupId, activeId, recoveryId, timing] of kinds) {
    const starts = actions.filter(row => row.to === windupId);
    if (starts.length !== 1) continue;
    const windup = starts[0];
    const active = actions.find(row => row.from === windupId && row.to === activeId
      && row.tick > windup.tick
      && row.tick - windup.tick <= Math.ceil(timing.windupMs * 60 / 1000));
    const recovery = active && actions.find(row => row.from === activeId && row.to === recoveryId
      && row.tick > active.tick
      && row.tick - active.tick <= Math.ceil(timing.activeMs * 60 / 1000));
    if (active && recovery) return { source: "authoritative-server-ticks", windup, active, recovery };
  }
  return null;
}
