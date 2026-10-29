// Read-only native acceptance parser. Never changes combat authority or HIT.
export function hasOriginalWorldActionTransition(log, fighter, from, to) {
  if (typeof log !== "string" || ![fighter,from,to].every(Number.isSafeInteger)
      || fighter < 1 || from < 0 || to < 0) return false;
  return log.split(/\r?\n/).some(line => {
    const match = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
    return match !== null && Number(match[2]) === fighter
      && Number(match[3]) === from && Number(match[4]) === to;
  });
}


/**
 * Classifies a server-owned JumpAttack transition for native acceptance only.
 * The World can execute Jump(15) and its authenticated conversion to
 * JumpAttackWindup(16) BETWEEN observer ticks, so the next observer sample
 * legitimately sees 0→16. Transport ACK alone never qualifies.
 *
 * The compressed path requires the original server's real action5 admission
 * line and the actual World actor's combined 14+12 stamina spend. This never
 * creates an action or a HIT and never waives the independent 42HP test.
 */
export function classifyOriginalWorldJumpAttackEntry(
  log, fighter, {startingStamina, observedStamina} = {},
) {
  if (typeof log !== "string" || !Number.isSafeInteger(fighter) || fighter < 1)
    return null;
  if (hasOriginalWorldActionTransition(log,fighter,0,15)
      && hasOriginalWorldActionTransition(log,fighter,15,16))
    return "separate-original-world-ticks";
  if (!hasOriginalWorldActionTransition(log,fighter,0,16))
    return null;
  const trustedAdmission = log.split(/\r?\n/).some(line => {
    const m=/^M201_AUTH_GESTURE_ACTION tick=(\d+) fighter=(\d+) source=0 gesture=(\d+) sequence=(\d+) eventAction=5 status=1 from=(\d+) to=(\d+)$/.exec(line);
    return m!==null && Number(m[2])===fighter
      && Number(m[3])>0 && Number(m[4])>0
      && ((Number(m[5])===0 && Number(m[6])===0)
          || (Number(m[5])===15 && Number(m[6])===16));
  });
  if (!trustedAdmission || !Number.isFinite(startingStamina)
      || !Number.isFinite(observedStamina)
      || Math.abs((startingStamina-observedStamina)-26)>0.5)
    return null;
  return "compressed-sampled-world-ticks-authenticated";
}
