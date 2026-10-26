// M41/M35 acceptance-only chronology. This observer never authors, mutates or sends input.
// Browser performance time is local; host epochs and World ticks are separate clocks.
export function createM41PhysicalInputChronology({
  clock = () => performance.now(),
  epoch = () => Date.now(),
} = {}) {
  let wheel = null;
  let firstBlockSample = null;
  let sequence = 0;

  function wheelStart(event) {
    if (!event || !(event.deltaY > 0)) return null;
    const at = clock();
    const eventTimestampPerfMs = Number.isFinite(event.timeStamp) ? event.timeStamp : null;
    const callbackLagMs = eventTimestampPerfMs !== null
      && at >= eventTimestampPerfMs && at - eventTimestampPerfMs < 60000
      ? at - eventTimestampPerfMs : null;
    wheel = {
      sequence: ++sequence,
      trusted: event.isTrusted === true,
      deltaY: event.deltaY,
      eventTimestampPerfMs,
      callbackStartPerfMs: at,
      callbackStartEpochMs: epoch(),
      callbackLagMs,
    };
    firstBlockSample = null;
    return sequence;
  }

  function wheelEnd(token) {
    if (wheel && token === wheel.sequence) {
      wheel.callbackEndPerfMs = clock();
      wheel.callbackEndEpochMs = epoch();
    }
  }

  function sampled(input, predictionStep) {
    if (!wheel || firstBlockSample || !input?.block) return;
    firstBlockSample = {
      predictionStep,
      perfMs: clock(),
      epochMs: epoch(),
    };
  }

  function sendInvocation(clientTick, input) {
    if (!wheel || !firstBlockSample || !input?.block) return null;
    return {
      wheel: { ...wheel },
      firstBlockSample: { ...firstBlockSample },
      originalV1ClientTick: clientTick,
      originalV1SendInvocationPerfMs: clock(),
      originalV1SendInvocationEpochMs: epoch(),
    };
  }

  function reset() { wheel = null; firstBlockSample = null; }
  return Object.freeze({ wheelStart, wheelEnd, sampled, sendInvocation, reset });
}
