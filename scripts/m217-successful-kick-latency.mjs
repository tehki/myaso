// M217: read-only proven genuine short-RMB kick -> browser-observed
// authoritative kick-windup + FFA knockdown focus cue in the SAME Chrome actor.
const duration = (start, end) =>
  Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start
    ? Number((end - start).toFixed(1)) : null;

export function summarizeM217SuccessfulKickLatency({
  sameBrowserClock, pointers, successfulPointerOffset, actionTransitions,
  focusTransitions, kickWindupAction, victimId,
} = {}) {
  const missingReasons = [];
  const result = {
    provenance: "same-attacker-browser-observer",
    scope: "M153 true short RMB kick -> observed authoritative windup + knockdown focus",
    rightDownToObservedWindupMs: null,
    rightDownToKnockdownFocusMs: null,
    // M228: distinguish deliberate RMB hold from actual post-release latency.
    rightHoldMs: null,
    rightUpToObservedWindupMs: null,
    rightUpToKnockdownFocusMs: null,
    observedWindupServerTick: null,
    missingReasons,
  };
  if (sameBrowserClock !== true) {
    missingReasons.push("clock-provenance-unknown");
    return Object.freeze(result);
  }
  const recent = Number.isInteger(successfulPointerOffset) && successfulPointerOffset >= 0
    && Array.isArray(pointers) ? pointers.slice(successfulPointerOffset) : [];
  const rightDowns = recent.filter(x => x?.button === 2 && x?.type === "pointerdown"
    && Number.isFinite(x.epochMs) && Number.isFinite(x.t));
  const rightUps = recent.filter(x => x?.button === 2 && x?.type === "pointerup"
    && Number.isFinite(x.epochMs) && Number.isFinite(x.t));
  const down = rightDowns[0];
  const up = rightUps[0];
  // M153 accepts only a real genuine short RMB kick; do not estimate if the
  // probe lacked that precise successful-attempt provenance.
  if (rightDowns.length !== 1 || rightUps.length !== 1 || !down || !up
    || up.epochMs <= down.epochMs || up.epochMs - down.epochMs >= 180
    || up.t <= down.t) {
    missingReasons.push("one-genuine-short-rmb-missing");
    return Object.freeze(result);
  }
  result.rightHoldMs = duration(down.epochMs, up.epochMs);
  const windup = Array.isArray(actionTransitions) && Number.isInteger(kickWindupAction)
    ? actionTransitions.find(x => x?.action === kickWindupAction
      && Number.isFinite(x.epochMs) && x.epochMs >= down.epochMs) : null;
  result.rightDownToObservedWindupMs = windup
    ? duration(down.epochMs, windup.epochMs) : null;
  if (result.rightDownToObservedWindupMs !== null && result.rightDownToObservedWindupMs > 1200) {
    result.rightDownToObservedWindupMs = null;
  }
  result.rightUpToObservedWindupMs = result.rightDownToObservedWindupMs === null
    ? null : duration(up.epochMs, windup.epochMs);
  if (windup && result.rightDownToObservedWindupMs !== null
    && result.rightUpToObservedWindupMs === null) {
    missingReasons.push("authoritative-windup-precedes-rmb-release");
  }
  if (result.rightDownToObservedWindupMs === null) {
    missingReasons.push("authoritative-kick-windup-not-paired");
  } else {
    result.observedWindupServerTick = Number.isInteger(windup.serverTick)
      ? windup.serverTick : null;
  }
  const focusLabel = "KNOCKDOWN #" + victimId;
  const focus = Array.isArray(focusTransitions)
    ? focusTransitions.find(x => x?.label === focusLabel
      && Number.isFinite(x.t) && x.t >= down.t) : null;
  result.rightDownToKnockdownFocusMs = focus
    ? duration(down.t, focus.t) : null;
  if (result.rightDownToKnockdownFocusMs !== null && result.rightDownToKnockdownFocusMs > 1500) {
    result.rightDownToKnockdownFocusMs = null;
  }
  result.rightUpToKnockdownFocusMs = result.rightDownToKnockdownFocusMs === null
    ? null : duration(up.t, focus.t);
  if (focus && result.rightDownToKnockdownFocusMs !== null
    && result.rightUpToKnockdownFocusMs === null) {
    missingReasons.push("knockdown-focus-precedes-rmb-release");
  }
  if (result.rightDownToKnockdownFocusMs === null) {
    missingReasons.push("knockdown-focus-cue-not-paired");
  }
  return Object.freeze(result);
}
