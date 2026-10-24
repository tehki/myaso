// M223: read-only authoritative server action proof, never synthetic input.
export async function awaitM223HeavyWindup({
  readOutput, afterOffset, fighterId, sleep, now = () => Date.now(),
  timeoutMs = 800,
}) {
  if (typeof readOutput !== "function" || typeof sleep !== "function"
    || typeof now !== "function" || !Number.isSafeInteger(afterOffset) || afterOffset < 0
    || !Number.isSafeInteger(fighterId) || fighterId < 1
    || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 1500) {
    throw new TypeError("M223 requires bounded read-only server windup proof");
  }
  const startedAt = now();
  while (now() - startedAt <= timeoutMs) {
    const output = readOutput();
    if (typeof output !== "string" || output.length < afterOffset) {
      throw new Error("M223 server output stream unavailable");
    }
    const lines = output.slice(afterOffset).split(/\r?\n/);
    for (const line of lines.slice(0, -1)) {
      const match = /^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
      if (match && Number(match[2]) === fighterId && Number(match[3]) === 0
        && Number(match[4]) === 9) {
        return { serverTick: Number(match[1]), observedAfterMs: now() - startedAt };
      }
    }
    await sleep(4);
  }
  throw new Error("M223 did not observe genuine authoritative heavy windup in time");
}

// M223.1 / M226 acceptance-only sequencing budget, not gameplay timing.
// M226 moves only the genuine CI parry wheel objective 20ms later: observed
// Block ~6 server ticks before heavy Active can exceed the 125ms parry timer
// by actual hit time. Never change server hit/parry mechanics or proof gates.
// Median genuine W3C calibration is noisy across hosted Chrome/Firefox.
// Observed CI #38582705600: a 103ms calibration median over-predicted actual
// wheel ingress (~31ms), so subtracting all 103ms expired short block early.
// For restored short-reach heavy, the independent M107 155ms lead yielded
// authoritative block at tick 2643, expiry 2656 and 46HP hit at tick 2660.
// Explicit nonrelease 395ms BLOCK objective is grounded in 31ea9d3
// 14-tick (~233ms) near-expiry 365ms sample; the revised wheel targets
// ~12 ticks of server short block without entering the 125ms parry.
// 405ms with +40ms physical offset remains PARRY acceptance-only.
// Retain fail-closed
// real parry assertions and unchanged authoritative 125ms parry duration.
// Keep the planned defender activation safely between parry and block expiry.
// Wrong authoritative outcome still fails the existing strict M107 checks.
export function planM223WheelDelay({ targetAfterWindupMs, sampledWheelIngressMs }) {
  if (![155, 255, 285, 365, 395, 405].includes(targetAfterWindupMs)
    || !Number.isFinite(sampledWheelIngressMs)
    || sampledWheelIngressMs < 0 || sampledWheelIngressMs > 750) {
    throw new TypeError("M223 requires genuine bounded heavy wheel calibration");
  }
  const boundedWheelIngressMs = Math.max(65, Math.min(85, sampledWheelIngressMs));
  return Object.freeze({
    boundedWheelIngressMs,
    wheelDelayMs: Math.round(targetAfterWindupMs - boundedWheelIngressMs),
  });
}
