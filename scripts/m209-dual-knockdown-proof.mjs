import { parseM201ServerProof } from "./m201-authoritative-phase-proof.mjs";

// M209 observes the real 60Hz loopback server, not sampled browser snapshots.
// Knockdown is unchanged 260ms; at 60Hz this is at most 16 simulation ticks.
export const M209_ROLL_KNOCKDOWN_TICKS = 16;
export function verifyM209DualKnockdownServerPunish(output, {
  rollerId, firstVictimId, secondVictimId, punisherId,
}) {
  const ids=[rollerId,firstVictimId,secondVictimId,punisherId];
  if(!ids.every(Number.isSafeInteger) || ids.some(id=>id<=0) || new Set(ids).size!==4) {
    throw new RangeError("M209 requires four distinct positive server fighter IDs");
  }
  const rows=parseM201ServerProof(output);
  const actions=(fighter,condition)=>rows.filter(r=>r.kind==="action" && r.fighter===fighter && condition(r));
  const rolls=actions(rollerId,r=>r.to===4);
  if(rolls.length!==1)throw new Error("M209 expected one authentic authoritative roll");
  const roll=rolls[0];
  const firsts=actions(firstVictimId,r=>r.to===19 && r.tick>=roll.tick);
  const seconds=actions(secondVictimId,r=>r.to===19 && r.tick>=roll.tick);
  if(firsts.length!==1 || seconds.length!==1)throw new Error("M209 missing two distinct roll knockdowns");
  const first=firsts[0],second=seconds[0];
  if(first.tick>second.tick || first.tick-roll.tick>12 || second.tick-roll.tick>12
    || second.tick-first.tick>6)throw new Error("M209 knockdowns were not from one ordered overlapping roll");
  const firstRecovery=actions(firstVictimId,r=>r.from===19 && r.tick>first.tick)[0]??null;
  const secondRecovery=actions(secondVictimId,r=>r.from===19 && r.tick>second.tick)[0]??null;
  const windups=actions(punisherId,r=>r.to===1 && r.tick>=roll.tick);
  if(windups.length!==1)throw new Error("M209 missing one genuine punisher light windup");
  const windup=windups[0];
  const actives=actions(punisherId,r=>r.from===1 && r.to===2 && r.tick>windup.tick
    && r.tick-windup.tick<=12);
  if(actives.length!==1)throw new Error("M209 missing genuine same-strike server attack-active");
  const active=actives[0];
  const earliestRecoveryTick=Math.min(
    firstRecovery?.tick??first.tick+M209_ROLL_KNOCKDOWN_TICKS,
    secondRecovery?.tick??second.tick+M209_ROLL_KNOCKDOWN_TICKS,
  );
  if(active.tick<second.tick || active.tick>=earliestRecoveryTick) {
    throw new Error("M209 server attack-active did not overlap both knockdowns BEFORE first recovery");
  }
  const hits=rows.filter(r=>r.kind==="hit" && r.tick>=roll.tick);
  if(hits.length!==1 || hits[0].attacker!==punisherId || hits[0].target!==firstVictimId
    || hits[0].damage!==34 || hits[0].hp!==66
    || hits[0].tick<active.tick || hits[0].tick>active.tick+8
    || hits[0].tick>=earliestRecoveryTick) {
    throw new Error("M209 missing exactly one 34HP server hit before BOTH recoveries");
  }
  return {roll,first,second,firstRecovery,secondRecovery,windup,active,
    hit:hits[0],earliestRecoveryTick};
}
