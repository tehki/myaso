export function createFrameBudget({
  stepMs = 1000 / 120,
  maxFrameDeltaMs = 50,
  maxStepsPerFrame = 6,
} = {}) {
  if (!Number.isFinite(stepMs) || stepMs <= 0) throw new RangeError("stepMs must be > 0");
  if (!Number.isFinite(maxFrameDeltaMs) || maxFrameDeltaMs <= 0) {
    throw new RangeError("maxFrameDeltaMs must be > 0");
  }
  if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
    throw new RangeError("maxStepsPerFrame must be a positive integer");
  }

  let lastNow = null;
  let accumulatorMs = 0;

  return Object.freeze({
    reset(now = null) {
      lastNow = Number.isFinite(now) ? now : null;
      accumulatorMs = 0;
    },

    advance(now, step) {
      if (!Number.isFinite(now)) throw new TypeError("now must be finite");
      if (typeof step !== "function") throw new TypeError("step must be a function");

      if (lastNow === null) {
        lastNow = now;
        return { steps: 0, elapsedMs: 0, droppedMs: 0, alpha: 0 };
      }

      const elapsedMs = Math.max(0, Math.min(maxFrameDeltaMs, now - lastNow));
      lastNow = now;
      accumulatorMs += elapsedMs;

      let steps = 0;
      while (accumulatorMs >= stepMs && steps < maxStepsPerFrame) {
        step(stepMs);
        accumulatorMs -= stepMs;
        steps += 1;
      }

      let droppedMs = 0;
      if (accumulatorMs >= stepMs) {
        droppedMs = accumulatorMs - (accumulatorMs % stepMs);
        accumulatorMs %= stepMs;
      }

      return {
        steps,
        elapsedMs,
        droppedMs,
        alpha: accumulatorMs / stepMs,
      };
    },
  });
}
