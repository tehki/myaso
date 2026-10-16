// M233: acceptance-only, read-only correlation of replicated fighter actions
// and decisions made during the actual Firefox HUD frame. No gameplay effect.
export const M233_MAX_SAMPLES = 96;

export function recordM233RecoveryHandoff(trace, {
  source, state, ownId, focusNetId, focusMode, serverTick, epochMs, isRecovery,
} = {}) {
  if (!Array.isArray(trace) || !(state instanceof Map)
    || (source !== "ingress" && source !== "hud")
    || !Number.isInteger(ownId) || ownId <= 0
    || typeof isRecovery !== "function") return trace;

  const own = state.get(ownId);
  const fighters = [...state.values()]
    .filter((entity) => entity && Number.isInteger(entity.netId)
      && entity.netId > 0 && entity.netId !== ownId)
    .sort((a, b) => a.netId - b.netId)
    .map((entity) => {
      const dx = entity.x - own?.x;
      const dy = entity.y - own?.y;
      const distanceSquared = Number.isFinite(dx) && Number.isFinite(dy)
        ? dx * dx + dy * dy : null;
      return {
        netId: entity.netId,
        action: Number.isInteger(entity.action) ? entity.action : null,
        recovery: Boolean(isRecovery(entity)),
        distanceSquared: Number.isFinite(distanceSquared) ? distanceSquared : null,
      };
    });

  // Do not turn 60 Hz state updates into an unbounded log, but preserve
  // each distinct action/eligibility or actual focus choice for each source.
  const decision = {
    source,
    focusNetId: Number.isInteger(focusNetId) ? focusNetId : 0,
    focusMode: typeof focusMode === "string" ? focusMode.slice(0, 32) : "",
    fighters,
  };
  const previous = trace.findLast((entry) => entry?.source === source);
  if (previous && previous.focusNetId === decision.focusNetId
    && previous.focusMode === decision.focusMode
    && previous.fighters?.length === fighters.length
    && fighters.every((fighter, index) =>
      fighter.netId === previous.fighters[index].netId
      && fighter.action === previous.fighters[index].action
      && fighter.recovery === previous.fighters[index].recovery)) return trace;

  trace.push({
    ...decision,
    ownId,
    serverTick: Number.isInteger(serverTick) && serverTick >= 0 ? serverTick : null,
    epochMs: Number.isFinite(epochMs) ? epochMs : null,
  });
  if (trace.length > M233_MAX_SAMPLES) trace.splice(0, trace.length - M233_MAX_SAMPLES);
  return trace;
}

export function summarizeM233RecoveryHandoff(trace, { jumpId, lightId } = {}) {
  const samples = Array.isArray(trace) ? trace.slice(-M233_MAX_SAMPLES) : [];
  const observed = (source, netId) => samples.find((entry) =>
    entry?.source === source
    && Array.isArray(entry.fighters)
    && entry.fighters.some((fighter) => fighter?.netId === netId && fighter.recovery === true)) ?? null;
  const selected = (source, netId) => samples.find((entry) =>
    entry?.source === source && entry.focusNetId === netId && entry.focusMode === "recovery") ?? null;
  const compact = (entry) => entry ? {
    epochMs: Number.isFinite(entry.epochMs) ? entry.epochMs : null,
    serverTick: Number.isInteger(entry.serverTick) ? entry.serverTick : null,
    focusNetId: Number.isInteger(entry.focusNetId) ? entry.focusNetId : 0,
    focusMode: entry.focusMode ?? "",
    fighters: (entry.fighters ?? []).slice(0, 8).map((f) => ({
      netId: f.netId, action: f.action, recovery: f.recovery,
      distanceSquared: Number.isFinite(f.distanceSquared) ? f.distanceSquared : null,
    })),
  } : null;
  return {
    source: "actual-browser-replicated-state-and-hud-frame",
    available: samples.length > 0,
    sampleCount: samples.length,
    observedJumpIngressRecovery: Boolean(observed("ingress", jumpId)),
    observedJumpHudRecovery: Boolean(observed("hud", jumpId)),
    selectedJumpInHud: Boolean(selected("hud", jumpId)),
    observedLightIngressRecovery: Boolean(observed("ingress", lightId)),
    selectedLightInHud: Boolean(selected("hud", lightId)),
    firstJumpIngressRecovery: compact(observed("ingress", jumpId)),
    firstJumpHudRecovery: compact(observed("hud", jumpId)),
    firstJumpHudSelection: compact(selected("hud", jumpId)),
    lastSamples: samples.slice(-20).map(compact),
  };
}
