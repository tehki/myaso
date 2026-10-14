// M218: read-only single-Chrome actor observation of an already-proven
// genuine Space+LMB jump-attack chord and its authoritative combat feedback.
// Do NOT infer a server commit instant or subtract different browser clocks.
const HIT_CUE = "Opponent hit - 42 HP.";
const COMMIT_CUE = "Jump attack committed - the narrow lane is readable.";
const lag = (start, finish) => Number.isFinite(start) && Number.isFinite(finish)
  && start >= 0 && finish >= start ? Number((finish - start).toFixed(1)) : null;

export function summarizeM218JumpAttackLatency({
  sameBrowserClock, jumpDown, attackDown, observedWindup, eventTransitions,
} = {}) {
  const result = {
    provenance: "single-attacker-browser-observer",
    scope: "M136 genuine Space+LMB narrow jump-attack 42HP success",
    chordToObservedWindupMs: null,
    chordToCommitCueMs: null,
    chordToHitCueMs: null,
    observedWindupServerTick: null,
    missingReasons: [],
  };
  const missing = result.missingReasons;
  if (sameBrowserClock !== true) {
    missing.push("unknown-or-cross-browser-clock");
    return Object.freeze(result);
  }
  if (!Number.isFinite(jumpDown?.epochMs) || !Number.isFinite(jumpDown?.t)
    || !Number.isFinite(attackDown?.epochMs) || !Number.isFinite(attackDown?.t)
    || Math.abs(jumpDown.epochMs - attackDown.epochMs) > 60) {
    missing.push("one-genuine-chord-missing");
    return Object.freeze(result);
  }
  const chordEpoch = Math.max(jumpDown.epochMs, attackDown.epochMs);
  const chordT = Math.max(jumpDown.t, attackDown.t);
  const windupLag = lag(chordEpoch, observedWindup?.epochMs);
  if (windupLag !== null && windupLag <= 220) {
    result.chordToObservedWindupMs = windupLag;
    result.observedWindupServerTick = Number.isInteger(observedWindup.serverTick)
      ? observedWindup.serverTick : null;
  } else missing.push("authoritative-windup-not-paired");
  const cues = Array.isArray(eventTransitions) ? eventTransitions : [];
  const commit = cues.find(x => x?.text === COMMIT_CUE
    && Number.isFinite(x.t) && x.t >= chordT);
  const hit = cues.find(x => x?.text === HIT_CUE
    && Number.isFinite(x.t) && x.t >= chordT);
  const commitMs = lag(chordT, commit?.t);
  const hitMs = lag(chordT, hit?.t);
  if (commitMs !== null && commitMs <= 1000) result.chordToCommitCueMs = commitMs;
  else missing.push("commit-cue-not-paired");
  if (hitMs !== null && hitMs <= 1500) result.chordToHitCueMs = hitMs;
  else missing.push("42hp-hit-cue-not-paired");
  return Object.freeze(result);
}
