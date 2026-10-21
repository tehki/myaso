// Network input must not depend on a rendered frame or replay render catch-up
// as a burst of input packets. Missed timer opportunities are never replayed.
export function createInputSendClock({
  send, shouldSend, intervalMs = 1000 / 60,
  schedule = (callback, delay) => setTimeout(callback, delay),
  cancel = timer => clearTimeout(timer),
}) {
  if (![send, shouldSend, schedule, cancel].every(value => typeof value === "function")
    || !Number.isFinite(intervalMs) || intervalMs < 8 || intervalMs > 1000) {
    throw new TypeError("input clock requires bounded cadence and lifecycle callbacks");
  }
  let active = false;
  let timer = null;
  let generation = 0;
  function tick(version) {
    if (!active || version !== generation) return;
    timer = null;
    if (shouldSend()) send();
    if (active && version === generation) timer = schedule(() => tick(version), intervalMs);
  }
  return Object.freeze({
    start() {
      if (active) return;
      active = true;
      const version = ++generation;
      timer = schedule(() => tick(version), intervalMs);
    },
    stop() {
      active = false;
      generation++;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  });
}
