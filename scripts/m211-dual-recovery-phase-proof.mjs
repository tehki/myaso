import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";

// M211: independent read-only 60Hz server evidence. A legitimate 80ms
// attack-active may fit entirely between two browser-replicated snapshots.
// Never infer an active edge from a later recovery or a missing HP change.
export function verifyM211DualRecoveryServerProof(output, {
  jumpId, lightId, observerId,
}) {
  const ids = [jumpId, lightId, observerId];
  if (!ids.every(Number.isSafeInteger) || ids.some(id => id <= 0)
    || new Set(ids).size !== 3) {
    throw new RangeError("M211 requires three distinct positive server fighter IDs");
  }
  const rows = parseM201ServerProof(output);
  const events = fighter => rows.filter(r => r.kind === "action" && r.fighter === fighter);
  function lifecycle(fighter, phases, label) {
    const actions = events(fighter);
    const found = phases.map((to, index) => {
      const matches = actions.filter(r => r.to === to
        && (index === 0 ? true : r.from === phases[index - 1]));
      if (matches.length !== 1) {
        throw new Error("M211 " + label + " requires one server phase edge " + to);
      }
      return matches[0];
    });
    if (found.some((r, i) => i > 0 && r.tick <= found[i - 1].tick)) {
      throw new Error("M211 " + label + " server attack phases are unordered");
    }
    // An unobserved extra windup or active is not a single genuine attack.
    if (actions.filter(r => phases.slice(0, -1).includes(r.to)).length !== phases.length - 1) {
      throw new Error("M211 " + label + " contains extra attack transitions");
    }
    return {
      windup: found[0], active: found[1], recovery: found[2], idle: found[3],
    };
  }
  const light = lifecycle(lightId, [1, 2, 3, 0], "light");
  const jump = lifecycle(jumpId, [16, 17, 18, 0], "jump");
  if (light.windup.tick >= jump.windup.tick
    || light.recovery.tick > jump.recovery.tick
    || jump.recovery.tick >= light.idle.tick
    || light.idle.tick >= jump.idle.tick) {
    throw new Error("M211 server recovery windows did not overlap with light-first handoff");
  }
  if (rows.some(r => r.kind === "hit"
    && (ids.includes(r.attacker) || ids.includes(r.target)))) {
    throw new Error("M211 off-axis recovery fight damaged a real fighter");
  }
  return { light, jump, overlapFrom: jump.recovery.tick, overlapUntil: light.idle.tick };
}
