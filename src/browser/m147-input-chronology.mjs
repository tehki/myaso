// Read-only, bounded chronology for genuine M147 browser input.
// Never samples, synthesizes, queues or transmits a combat action.
export function createM147InputChronology({
  clock = () => performance.now(),
  epoch = () => Date.now(),
  maxEvents = 96,
} = {}) {
  if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 256) {
    throw new RangeError("M147 chronology requires 1..256 bounded entries");
  }
  const events = [];
  let pendingLight = false;
  let sampledFirst = false;
  let previousRafMs = null;

  function mark(stage, fields = {}) {
    const row = { stage, perfMs: clock(), epochMs: epoch(), ...fields };
    events.push(row);
    if (events.length > maxEvents) events.shift();
    return row;
  }

  function pointerUp(event) {
    const at = clock();
    const eventTimestampMs = Number.isFinite(event.timeStamp) ? event.timeStamp : null;
    const callbackLagMs = eventTimestampMs !== null
      && at >= eventTimestampMs && at - eventTimestampMs < 60000
      ? at - eventTimestampMs : null;
    mark("pointerup-handler-entry", {
      trusted: event.isTrusted === true,
      pointerId: event.pointerId,
      eventTimestampMs,
      callbackLagMs,
    });
  }

  function onLight() {
    pendingLight = true;
    sampledFirst = false;
    mark("onLight-callback");
  }

  function releaseInvocation() {
    mark("charge-release-invocation");
  }

  function release(classification) {
    mark("charge-release-return", { classification });
  }

  function audioStage(stage) {
    if (!["audio-unlock-enter", "audio-unlock-exit", "audio-play-exit"].includes(stage)) {
      throw new TypeError("unrecognized read-only audio stage");
    }
    mark(stage);
  }

  function pointerHandlerEnd() {
    mark("pointerup-handler-end");
  }

  function raf(nowMs) {
    const frameGapMs = previousRafMs === null ? null : nowMs - previousRafMs;
    previousRafMs = nowMs;
    if (pendingLight) mark("raf-entry", { frameGapMs });
  }

  function sampled(input, step) {
    if (!pendingLight || sampledFirst) return;
    sampledFirst = true;
    mark("first-prediction-sample", {
      predictionStep: step,
      attack: Boolean(input.attack),
      heavyAttack: Boolean(input.heavyAttack),
    });
  }

  function sendInput(input, clientTick) {
    if (!pendingLight) return;
    mark("original-sendInput-invocation", {
      clientTick, attack: Boolean(input.attack),
      heavyAttack: Boolean(input.heavyAttack),
    });
    pendingLight = false;
  }

  return Object.freeze({ events, pointerUp, onLight, releaseInvocation, release, audioStage, pointerHandlerEnd, raf, sampled, sendInput });
}
