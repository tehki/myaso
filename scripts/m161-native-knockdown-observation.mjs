// Read-only observation of the *actual victim browser* while native W3C
// input is in flight. Never synthesize a knockdown from server action traces.
// The returned transition must already exist in the browser's own stream.
export async function observeM161NativeKnockdown({
  readOwnActions,
  startIndex,
  isKnockdown,
  deadlineEpochMs,
  shouldStop = () => false,
  pollMs = 12,
  sleep,
  now = () => Date.now(),
}) {
  if (typeof readOwnActions !== "function" || typeof isKnockdown !== "function"
    || typeof shouldStop !== "function" || typeof sleep !== "function"
    || typeof now !== "function" || !Number.isSafeInteger(startIndex) || startIndex < 0
    || !Number.isFinite(deadlineEpochMs) || !Number.isFinite(pollMs) || pollMs < 1) {
    throw new TypeError("M161 needs bounded real victim reads and an own-action predicate");
  }
  while (!shouldStop() && now() < deadlineEpochMs) {
    const actions = await readOwnActions();
    if (!Array.isArray(actions)) throw new TypeError("M161 victim own-action stream missing");
    const observed = actions.slice(startIndex).find(isKnockdown);
    if (observed) return { ...observed };
    if (!shouldStop() && now() < deadlineEpochMs) await sleep(pollMs);
  }
  return null;
}
