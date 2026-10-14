// M219 diagnostic only. All epochs come from one Chrome actor browser.
// Locally replicated snapshots are not the server's input-commit instant.
const valid = value => Number.isFinite(value) && value >= 0;
export function observeM219RollBufferIngress({ sameBrowserClock, wheel, recovery, dodge, recoveryMs, bufferWindowMs } = {}) {
  const result = {
    provenance: "same-actor-browser-only",
    wheelEpochMs: valid(wheel?.epochMs) ? wheel.epochMs : null,
    recoveryServerTick: Number.isInteger(recovery?.serverTick) ? recovery.serverTick : null,
    dodgeServerTick: Number.isInteger(dodge?.serverTick) ? dodge.serverTick : null,
    wheelFromObservedBufferOpenMs: null,
    wheelBeforeNominalRecoveryExitMs: null,
    wheelToObservedDodgeMs: null,
    postRecoveryDodgeMs: null,
    placement: "unknown",
    reason: null,
  };
  if (sameBrowserClock !== true) { result.reason = "cross-browser-clock"; return result; }
  if (!(wheel?.deltaY < 0) || !valid(wheel?.epochMs) || !valid(recovery?.epochMs) || !valid(dodge?.epochMs)
    || !(recoveryMs > 0) || !(bufferWindowMs > 0) || bufferWindowMs > recoveryMs) {
    result.reason = "missing-genuine-input-or-authority";
    return result;
  }
  const exit = recovery.epochMs + recoveryMs;
  const open = exit - bufferWindowMs;
  result.wheelFromObservedBufferOpenMs = Number((wheel.epochMs - open).toFixed(1));
  result.wheelBeforeNominalRecoveryExitMs = Number((exit - wheel.epochMs).toFixed(1));
  result.postRecoveryDodgeMs = Number((dodge.epochMs - exit).toFixed(1));
  result.wheelToObservedDodgeMs = dodge.epochMs >= wheel.epochMs ? Number((dodge.epochMs - wheel.epochMs).toFixed(1)) : null;
  result.placement = wheel.epochMs < open ? "before-observed-window"
    : wheel.epochMs > exit ? "after-observed-recovery" : "within-observed-window";
  if (result.wheelToObservedDodgeMs === null) result.reason = "wheel-after-observed-dodge";
  return result;
}
