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

export async function dispatchM41ObservedParry({ sendAttack, awaitWorldCue, sendWheel }) {
  if (![sendAttack,awaitWorldCue,sendWheel].every(fn=>typeof fn === "function")) {
    throw new TypeError("M41 requires native click, observed World cue and native wheel callbacks");
  }
  const attack = (async () => {
    try { await sendAttack(); return {ok:true}; }
    catch (error) { return {ok:false,error}; }
  })();
  let cue, wheel = {ok:true}, observationError;
  try {
    cue = await awaitWorldCue();
    if (!cue) throw new Error("M41 missing fresh actor-bound World cue; no native wheel allowed");
    wheel = await Promise.resolve().then(sendWheel).then(
      () => ({ok:true}), error => ({ok:false,error}));
  } catch (error) { observationError = error; }
  // Even absent/invalid cues and failed wheels cannot hide a driver failure
  // or abandon the real click while its physical button is still held.
  const attackResult = await attack;
  const errors = [observationError, !attackResult.ok && attackResult.error, !wheel.ok && wheel.error].filter(Boolean);
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors,"M41 native click, cue or wheel failed");
  return {cue, nativeClickAck:true, nativeWheelAck:true};
}

// Native QA only: observe the identical production World cue inside its OWN
// real browser instead of serializing many W3C execute/sync HTTP responses.
// The returned cue still has to pass waitForM41WorldWindup actor/index/text
// checks before the one real Firefox parry wheel can be sent. No simulated
// keyboard/mouse, action writer or World authority is introduced.
export function m41NativeAsyncCueScript() {
  return "const observe = " + readM41ScalarWorldCue.toString() + ";"
    + "const [baseline, actorId, allowHeavy, timeoutMs] = arguments;"
    + "const done = arguments[arguments.length - 1];"
    + "const started = performance.now();"
    + "let poll;"
    + "const check = () => {"
    + "const cue = observe(window.__MYASO_M30_UI__, baseline, actorId, allowHeavy);"
    + "if (cue || performance.now() - started >= timeoutMs) {"
    + "clearInterval(poll);done(cue ?? null);"
    + "}};"
    + "poll = setInterval(check, 4);check();";
}
