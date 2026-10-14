// Read-only M216 genuine wheel-back parry + confirmed 34HP punish latency.
// All observation clocks must come from one defender/attacker-of-punish
// browser. The other fighter's clock is never used for subtraction.
const PARRY_TEXT = "Parry! Opponent stunned - punish now.";
const HIT_TEXT = "Opponent hit - 34 HP.";

const positiveDuration = (start, end) =>
  Number.isFinite(start) && Number.isFinite(end) && start >= 0
    && end >= start ? Number((end - start).toFixed(1)) : null;

export function summarizeM216ParryPunishLatency({
  sameBrowserClock, wheels, eventTransitions, pointers,
  focusActionTransitions, stunnedAction,
} = {}) {
  const output = {
    provenance: "single-defender-browser-observer",
    scope: "M146 real parry wheel -> authoritative stun observation -> 34HP punish cue",
    wheelToParryCueMs: null,
    wheelToObservedStunMs: null,
    punishPointerDownToHitCueMs: null,
    parryServerTick: null,
    missingReasons: [],
  };
  const missing = output.missingReasons;
  if (sameBrowserClock !== true) {
    missing.push("cross-browser-or-unknown-clock");
    return Object.freeze(output);
  }
  const events = Array.isArray(eventTransitions) ? eventTransitions : [];
  const clickDowns = Array.isArray(pointers) ? pointers.filter(p =>
    p?.button === 0 && p?.type === "pointerdown"
    && Number.isFinite(p.t) && Number.isFinite(p.epochMs)) : [];
  // The unchanged M146 acceptance has already checked that the punish
  // was exactly one genuine late LMB which dealt 34 HP.
  const down = clickDowns.at(-1);
  const parryCue = [...events].reverse().find(e =>
    e?.text === PARRY_TEXT && Number.isFinite(e.t)
    && (!down || e.t < down.t));
  const parryWheel = Array.isArray(wheels) && parryCue
    ? [...wheels].reverse().find(w => w?.deltaY > 0
      && Number.isFinite(w.t) && Number.isFinite(w.epochMs)
      && w.t <= parryCue.t) : null;
  if (!parryWheel || !parryCue) {
    missing.push("genuine-parry-wheel-or-cue-not-paired");
  } else {
    const lag = positiveDuration(parryWheel.t, parryCue.t);
    // Do not attribute an ancient W3C attempt to a later successful parry.
    output.wheelToParryCueMs = lag !== null && lag <= 500 ? lag : null;
    if (output.wheelToParryCueMs === null) missing.push("ambiguous-parry-wheel-cue");
  }

  // A target stun is a replicated authoritative action observed in this
  // browser, not a precise server commitment timestamp.
  const actions = Array.isArray(focusActionTransitions) ? focusActionTransitions : [];
  const focusStun = parryWheel && Number.isInteger(stunnedAction)
    ? actions.find(a => a?.action === stunnedAction
      && Number.isFinite(a.epochMs)
      && a.epochMs >= parryWheel.epochMs
      && (!down || a.epochMs < down.epochMs)) : null;
  if (focusStun && parryWheel) {
    const lag = positiveDuration(parryWheel.epochMs, focusStun.epochMs);
    output.wheelToObservedStunMs = lag !== null && lag <= 500 ? lag : null;
    output.parryServerTick = Number.isInteger(focusStun.serverTick)
      ? focusStun.serverTick : null;
  }
  if (output.wheelToObservedStunMs === null) missing.push("authoritative-focus-stun-not-paired");

  const hitCue = down ? events.find(e => e?.text === HIT_TEXT
    && Number.isFinite(e.t) && e.t >= down.t) : null;
  if (hitCue && down) {
    const lag = positiveDuration(down.t, hitCue.t);
    output.punishPointerDownToHitCueMs = lag !== null && lag <= 1200 ? lag : null;
  }
  if (output.punishPointerDownToHitCueMs === null) missing.push("genuine-punish-down-hit-cue-not-paired");

  return Object.freeze(output);
}
