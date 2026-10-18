// R2 gesture recognizer: only two distinct genuine WASD keyDown edges
// can request a server-authoritative directional dash. Cooldown is mirrored
// here for responsiveness; the Rust server independently enforces 3 seconds.
export const DASH_DOUBLE_TAP_MS = 240;
export const DASH_COOLDOWN_MS = 3000;
const DIRECTIONS = Object.freeze({
  KeyW: Object.freeze({ x: 0, y: -1 }),
  KeyA: Object.freeze({ x: -1, y: 0 }),
  KeyS: Object.freeze({ x: 0, y: 1 }),
  KeyD: Object.freeze({ x: 1, y: 0 }),
});
export function createDirectionalDash({ doubleTapMs = DASH_DOUBLE_TAP_MS,
  cooldownMs = DASH_COOLDOWN_MS } = {}) {
  if (!Number.isFinite(doubleTapMs) || doubleTapMs <= 0 || doubleTapMs > 500 ||
      !Number.isFinite(cooldownMs) || cooldownMs < 1000 || cooldownMs > 10000) {
    throw new RangeError("invalid dash timing");
  }
  const last = new Map();
  let readyAt = 0;
  function press(code, timeMs, repeated = false) {
    if (!Object.hasOwn(DIRECTIONS, code) || !Number.isFinite(timeMs)
      || timeMs < 0 || repeated) return null;
    const prev = last.get(code);
    last.set(code, timeMs);
    if (timeMs < readyAt || prev === undefined || timeMs < prev
      || timeMs - prev > doubleTapMs) return null;
    readyAt = timeMs + cooldownMs;
    last.clear();
    return { ...DIRECTIONS[code] };
  }
  return Object.freeze({
    press,
    clearTaps() { last.clear(); },
    cooldownRemaining(nowMs) { return Number.isFinite(nowMs) ? Math.max(0, readyAt - nowMs) : null; },
  });
}
