// M224: acceptance-only completion proof. The real authoritative roll can
// knock the attacker down before a sampled attack-active/dodge overlap.
// Preserve genuine dodge action, intact vitals and strict final assertion.
export function isM224AuthoritativeDodgeResolved({
  firstDodgeEvadeAt,
  attackerKnockdownSeen,
  defenderDodgeSeen,
  minDefenderHp,
  minDefenderGuard,
}) {
  if (minDefenderHp !== 100 || minDefenderGuard !== 100 || defenderDodgeSeen !== true) {
    return false;
  }
  return (Number.isFinite(firstDodgeEvadeAt) && firstDodgeEvadeAt >= 0)
    || attackerKnockdownSeen === true;
}
