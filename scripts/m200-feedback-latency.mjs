// M200 observes UI feedback from the same browser performance clock.
const BLOCKED_TEXT = "Block held - guard -38.";
const BROKEN_TEXT = "Guard broken - you are vulnerable.";

export function measureM200WheelFeedbackLatency({ wheel, transitions, remainingGuard }) {
  if (!Number.isFinite(wheel?.t) || wheel.t < 0 ||
      !Number.isFinite(remainingGuard) || remainingGuard < 0 ||
      !Array.isArray(transitions)) return null;
  const feedbackKind = remainingGuard === 0 ? "guard-break" : "blocked-guard";
  const expectedText = remainingGuard === 0 ? BROKEN_TEXT : BLOCKED_TEXT;
  const matches = transitions.filter((transition) =>
    transition?.text === expectedText && Number.isFinite(transition.t) &&
    transition.t >= wheel.t);
  if (!matches.length) return null;
  const first = matches.reduce((earliest, candidate) =>
    candidate.t < earliest.t ? candidate : earliest);
  return Object.freeze({
    wheelToFeedbackMs: Number((first.t - wheel.t).toFixed(1)),
    feedbackKind,
  });
}
