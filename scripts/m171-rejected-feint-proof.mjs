import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";
import { COMBAT } from "../src/combat/model.mjs";
import { COMBAT_ACTION as A } from "../src/browser/combat-readability.mjs";

function serverPhaseTicks(durationMs) {
  // Match existing Rust f32 accumulation and EPSILON, rather than assuming
  // exact real-number division: six 60Hz steps total 99.999992ms, so the
  // unchanged 100ms heavy active phase exits on its seventh step.
  const dt = Math.fround(1000 / 60);
  let elapsed = 0;
  for (let ticks = 1; ticks <= 60; ticks++) {
    elapsed = Math.fround(elapsed + dt);
    if (Math.fround(elapsed + Math.fround(1e-6)) >= durationMs) return ticks;
  }
  throw new RangeError("M171 unsupported server phase duration");
}

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
      && row.tick - windup.tick <= serverPhaseTicks(timing.windupMs));
    const recovery = active && actions.find(row => row.from === activeId && row.to === recoveryId
      && row.tick > active.tick
      && row.tick - active.tick === serverPhaseTicks(timing.activeMs));
    if (active && recovery) return { source: "authoritative-server-ticks", windup, active, recovery };
  }
  return null;
}
