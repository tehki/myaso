// M150 strict acceptance-only authoritative position proof. This is read-only;
// all movement into these positions must still come from genuine W3C keys.
export function qualifyM150ParryGeometry({ attacker, defender, closer, reach, radius }) {
  const coordinates = [attacker?.x, attacker?.y, defender?.x, defender?.y,
    closer?.x, closer?.y, reach, radius];
  if (!coordinates.every(Number.isFinite) || reach <= 0 || radius <= 0) {
    throw new TypeError("M150 requires finite replicated fighter coordinates and combat reach");
  }
  const attackerDistance = Math.hypot(attacker.x - defender.x, attacker.y - defender.y);
  const closerDistance = Math.hypot(closer.x - defender.x, closer.y - defender.y);
  const excludedDistance = Math.hypot(closer.x - attacker.x, closer.y - attacker.y);
  // The target must be light-reachable, #3 must remain clearly nearer to
  // defender #2, and idle #3 must be safely beyond #1's possible light range.
  return Object.freeze({
    attackerDistance,
    closerDistance,
    excludedDistance,
    qualified: attackerDistance >= 72 && attackerDistance <= reach + radius
      && closerDistance + 10 < attackerDistance
      && excludedDistance > reach + radius + 5,
  });
}
