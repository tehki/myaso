export function createDeterministicImpairment({
  baseDelayMs = 0,
  jitterPatternMs = [0],
  dropEvery = 0,
  reorderEvery = 0,
  reorderExtraDelayMs = 0,
} = {}) {
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) throw new RangeError("baseDelayMs must be finite and >= 0");
  if (!Array.isArray(jitterPatternMs) || jitterPatternMs.length === 0 || jitterPatternMs.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError("jitterPatternMs must contain finite non-negative values");
  }
  if (!Number.isInteger(dropEvery) || dropEvery < 0) throw new RangeError("dropEvery must be an integer >= 0");
  if (!Number.isInteger(reorderEvery) || reorderEvery < 0) throw new RangeError("reorderEvery must be an integer >= 0");
  if (!Number.isFinite(reorderExtraDelayMs) || reorderExtraDelayMs < 0) throw new RangeError("reorderExtraDelayMs must be finite and >= 0");

  let sequence = 0;
  const queue = [];
  let dropped = 0;
  let delivered = 0;

  function schedule(nowMs, payload) {
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be finite");
    sequence += 1;
    if (dropEvery > 0 && sequence % dropEvery === 0) {
      dropped += 1;
      return { sequence, dropped: true, dueMs: null };
    }
    const jitter = jitterPatternMs[(sequence - 1) % jitterPatternMs.length];
    const reorderDelay = reorderEvery > 0 && sequence % reorderEvery === 0 ? reorderExtraDelayMs : 0;
    const item = {
      sequence,
      dueMs: nowMs + baseDelayMs + jitter + reorderDelay,
      payload,
    };
    queue.push(item);
    queue.sort((left, right) => left.dueMs - right.dueMs || left.sequence - right.sequence);
    return { sequence, dropped: false, dueMs: item.dueMs };
  }

  function drain(nowMs, deliver) {
    if (!Number.isFinite(nowMs)) throw new TypeError("nowMs must be finite");
    if (typeof deliver !== "function") throw new TypeError("deliver must be a function");
    let count = 0;
    while (queue.length && queue[0].dueMs <= nowMs) {
      const item = queue.shift();
      deliver(item.payload, item);
      delivered += 1;
      count += 1;
    }
    return count;
  }

  return {
    schedule,
    drain,
    clear() { queue.length = 0; },
    get pending() { return queue.length; },
    get dropped() { return dropped; },
    get delivered() { return delivered; },
    get scheduled() { return sequence; },
  };
}
