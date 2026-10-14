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
