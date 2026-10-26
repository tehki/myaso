// Native QA orchestration only. These functions never create DOM input or
// World state; production-visible cues gate one existing native W3C wheel.
export function readM41ScalarWorldCue(state, baselineEventCount, expectedActorId, allowHeavy = false) {
  if (!Number.isInteger(baselineEventCount) || baselineEventCount < 0
      || !Number.isSafeInteger(expectedActorId) || expectedActorId < 1) return null;
  const actorId = Number(state?.online?.match(/player #(\d+)/)?.[1]);
  if (actorId !== expectedActorId || !Array.isArray(state?.events)
      || state.events.length < baselineEventCount) return null;
  // M35: earlier heavy charging starts Block too soon (BLOCK at 133ms);
  // demand actual released-light cue. M41: previous exact-head accepted
  // early heavy charging and waiting for Light can miss the parry entirely.
  // Preserve that separate earlier M41 cue via an explicit fixture flag.
  const latestText = state.events.at(-1);
  const light = latestText === "Attack committed - your windup is readable.";
  const heavy = latestText === "Heavy strike committed - the long windup is readable.";
  if (!light && !(allowHeavy && heavy)) return null;
  const index = state.events.length - 1;
  if (index < baselineEventCount) return null;
  const transition = state.eventTransitions?.[index];
  if (transition?.text !== latestText || !Number.isFinite(transition.t) || transition.t < 0) return null;
  return { actorId, eventIndex:index, text:latestText, t:transition.t,
    eventCount:state.events.length, latestText };
}

export async function dispatchM41ObservedParry({
  sendAttack, awaitWorldCue, sendWheel, now = () => Date.now(),
}) {
  if (![sendAttack, awaitWorldCue, sendWheel, now].every(fn => typeof fn === "function")) {
    throw new TypeError("M41 requires native click, observed World cue, wheel and clock callbacks");
  }
  // Read-only host chronology. Neither these timestamps nor native ACKs
  // authorize Block/Parry: only authentic original World contact qualifies.
  // Preserve native click/wheel issue order, both ACKs, and the cue gate.
  const chronology = {
    attackIssuedEpochMs: now(), cueResolvedEpochMs: null,
    wheelIssuedEpochMs: null, wheelAckEpochMs: null,
    attackAckEpochMs: null,
  };
  const attack = (async () => {
    try {
      await sendAttack();
      chronology.attackAckEpochMs = now();
      return {ok:true};
    } catch (error) { chronology.attackAckEpochMs = now(); return {ok:false,error}; }
  })();
  let cue, wheel = {ok:true}, observationError;
  try {
    cue = await awaitWorldCue();
    if (!cue || cue?.timedOut === true) throw new Error("M41 missing fresh actor-bound World cue; no native wheel allowed");
    chronology.cueResolvedEpochMs = now();
    wheel = await Promise.resolve().then(() => {
      chronology.wheelIssuedEpochMs = now();
      return sendWheel();
    }).then(
      () => { chronology.wheelAckEpochMs = now(); return {ok:true}; },
      error => { chronology.wheelAckEpochMs = now(); return {ok:false,error}; });
  } catch (error) { observationError = error; }
  // Even absent/invalid cues and failed wheels cannot hide a driver failure
  // or abandon the real click while its physical button is still held.
  const attackResult = await attack;
  const errors = [observationError, !attackResult.ok && attackResult.error, !wheel.ok && wheel.error].filter(Boolean);
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors,"M41 native click, cue or wheel failed");
  return {cue, nativeClickAck:true, nativeWheelAck:true, chronology};
}

// Failure-only, read-only provenance of the *same* live browser observer.
// Never authorize a wheel from this summary: a captured superseded cue is
// diagnostic history, NOT a currently valid attack-windup admission.
export function summarizeM41CueTimeout(state, baselineEventCount, expectedActorId, elapsedMs) {
  const events = Array.isArray(state?.events) ? state.events : [];
  const transitions = Array.isArray(state?.eventTransitions) ? state.eventTransitions : [];
  const start = Math.max(Number.isInteger(baselineEventCount) ? baselineEventCount : 0,
    events.length - 4);
  const recentEvents = events.slice(start).map((event, offset) => {
    const index = start + offset;
    return {
      index,
      text: typeof event === "string" ? event.slice(0, 100) : "",
      t: Number.isFinite(transitions[index]?.t) ? transitions[index].t : null,
    };
  });
  const actorId = Number(state?.online?.match(/player #(\\d+)/)?.[1]);
  return {
    timedOut: true,
    expectedActorId,
    observedActorId: Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null,
    baselineEventCount,
    eventCount: events.length,
    observerElapsedMs: Number.isFinite(elapsedMs) ? Math.round(elapsedMs) : null,
    recentEvents,
  };
}

// Native QA only: observe the identical production World cue inside its OWN
// real browser instead of serializing many W3C execute/sync HTTP responses.
// The returned cue still has to pass waitForM41WorldWindup actor/index/text
// checks before the one real Firefox parry wheel can be sent. No simulated
// keyboard/mouse, action writer or World authority is introduced.
export function m41NativeAsyncCueScript() {
  return "const observe = " + readM41ScalarWorldCue.toString() + ";"
    + "const timeoutEvidence = " + summarizeM41CueTimeout.toString() + ";"
    + "const [baseline, actorId, allowHeavy, timeoutMs] = arguments;"
    + "const done = arguments[arguments.length - 1];"
    + "const started = performance.now();"
    + "let poll;"
    + "const check = () => {"
    + "const state = window.__MYASO_M30_UI__;"
    + "const cue = observe(state, baseline, actorId, allowHeavy);"
    + "if (cue || performance.now() - started >= timeoutMs) {"
    + "clearInterval(poll);done(cue ?? timeoutEvidence(state, baseline, actorId, performance.now() - started));"
    + "}};"
    + "poll = setInterval(check, 4);check();";
}
