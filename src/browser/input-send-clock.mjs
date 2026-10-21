// Network input must not depend on a rendered frame or replay render catch-up
// as a burst of input packets. Missed timer opportunities are never replayed.
export function createInputSendClock({
  send, shouldSend, intervalMs = 1000 / 60,
  now = () => performance.now(),
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = timer => clearTimeout(timer),
}) {
  if (![send, shouldSend, now, schedule, cancel].every(value => typeof value === "function")
    || !Number.isFinite(intervalMs) || intervalMs < 8 || intervalMs > 1000) {
    throw new TypeError("input clock requires bounded cadence and lifecycle callbacks");
  }
  let active = false;
  let timer = null;
  let generation = 0;
  let deadline = 0;
  function arm(version) {
    // Browser timers truncate fractional delays. Round the remaining local
    // monotonic deadline up so 16.67ms does not silently become 16ms/62.5Hz.
    timer = schedule(() => tick(version), Math.max(1, Math.ceil(deadline - now())));
  }
  function tick(version) {
    if (!active || version !== generation) return;
    timer = null;
    if (now() < deadline) { arm(version); return; }
    if (shouldSend()) send();
    if (!active || version !== generation) return;
    const sampledAt = now();
    deadline += intervalMs;
    if (deadline <= sampledAt) deadline = sampledAt + intervalMs;
    arm(version);
  }
  return Object.freeze({
    start() {
      if (active) return;
      active = true;
      const version = ++generation;
      deadline = now() + intervalMs;
      arm(version);
    },
    stop() {
      active = false;
      generation++;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  });
}
