// Acceptance-only WebDriver pacing. The mouse still produces exactly one
// genuine W3C down/up; authoritative combat timings remain untouched.
export function planM203W3cPointerPause({ wheelCommandMs, nominalPointerPauseMs, targetAckPlusPauseMs = 75 }) {
  if (![wheelCommandMs, nominalPointerPauseMs, targetAckPlusPauseMs]
    .every(value => Number.isFinite(value) && value >= 0)
    || nominalPointerPauseMs > 1000 || targetAckPlusPauseMs > 1000) {
    throw new RangeError("M203 requires finite bounded W3C acknowledgement timing");
  }
  // Fast wheel acknowledgements retain M199's genuine W3C pointer pause,
  // guarding against a parry. A delayed acknowledged wheel consumes some or
  // all of that pause to avoid hitting after the unchanged short-block window.
  return Math.max(0, Math.min(Math.trunc(nominalPointerPauseMs),
    Math.trunc(targetAckPlusPauseMs - wheelCommandMs)));
}
