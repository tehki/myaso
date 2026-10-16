// M235: bounded, read-only proof retained only when genuine M38 pixel gate is RED.
// Keep M38's pixel thresholds, native Firefox RAF sampler, and W3C gestures intact.
const tail = (items, max) => Array.isArray(items) ? items.slice(-max) : [];
const finite = (n) => Number.isFinite(n) ? n : null;

function browserTrace(sample) {
  const p = sample?.sampler;
  const ui = sample?.ui;
  return {
    browser: sample?.browser ?? null,
    samplerError: sample?.samplerError ?? null,
    uiError: sample?.uiError ?? null,
    sampledFrames: Number.isInteger(p?.sampledFrames) ? p.sampledFrames : null,
    maxPixels: finite(p?.maxPixels),
    lastPixels: finite(p?.lastPixels),
    maxPixelsEpochMs: finite(p?.maxPixelsEpochMs),
    lastSampleEpochMs: finite(p?.lastSampleEpochMs),
    firstSampleEpochMs: finite(p?.firstSampleEpochMs),
    arena: p?.arena ? {
      width: finite(p.arena.width), height: finite(p.arena.height),
      x: finite(p.arena.x), y: finite(p.arena.y),
      sampleWidth: finite(p.arena.sampleWidth), sampleHeight: finite(p.arena.sampleHeight),
    } : null,
    focusLabel: typeof ui?.focusLabel === "string" ? ui.focusLabel : null,
    recoveryVisible: ui?.recoveryVisible === true,
    recoveryTransitions: tail(ui?.recoveryTransitions, 8).map((e) => ({
      visible: e?.visible === true, state: e?.state ?? null, label: e?.label ?? null,
    })),
    focusTransitions: tail(ui?.focusTransitions, 8).map((e) => ({
      label: e?.label ?? null, t: finite(e?.t),
    })),
    playerHp: finite(ui?.playerHp),
    opponentHp: finite(ui?.opponentHp),
  };
}

export function summarizeM235RecoveryTellFailure({ samples = [], observerBrowser, localBrowser, serverOutput = "" } = {}) {
  const observer = browserTrace(samples.find((s) => s?.browser === observerBrowser));
  const local = browserTrace(samples.find((s) => s?.browser === localBrowser));
  const authoritativeEdges = typeof serverOutput === "string"
    ? serverOutput.split("\n").filter((line) => /^M201_AUTH_ACTION\b/.test(line)).slice(-16)
    : [];
  return {
    source: "actual-browser-native-M38-RAF-canvas-and-HUD-on-strict-red",
    observer, local,
    observerRafObserved: Number.isInteger(observer.sampledFrames) && observer.sampledFrames > 0,
    observerHudRecoveryObserved: observer.recoveryTransitions.some((e) => e.visible && e.state === "attack-recovery"),
    authoritativeEdges,
  };
}
