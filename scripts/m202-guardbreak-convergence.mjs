// Test-only planner: never send another wheel/click when an expected
// guard-break may be visible on one browser before its defender snapshot.
export function mustAwaitM202GuardConvergence({ attemptsDone, minimumExchanges, attackerConfirmed, defenderGuard }) {
  if (!Number.isSafeInteger(attemptsDone) || attemptsDone < 1 ||
      !Number.isSafeInteger(minimumExchanges) || minimumExchanges < 1 ||
      !Number.isFinite(defenderGuard) || defenderGuard < 0 ||
      typeof attackerConfirmed !== "boolean") {
    throw new RangeError("M202 requires finite authoritative guard and valid genuine input counts");
  }
  if (defenderGuard === 0) return false;
  // Read-only attacker guard-break confirmation may arrive ahead of the
  // defender's replicated zero guard. After N genuine hits, never send a
  // speculative (N+1)th wheel/attack simply because a snapshot is stale.
  return attackerConfirmed || attemptsDone >= minimumExchanges;
}
