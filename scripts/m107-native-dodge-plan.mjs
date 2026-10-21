// Native W3C acknowledgements remain mandatory, but cannot delay the sole
// wheel after actual server windup. Driver-owned pauses can overrun combat.
export async function dispatchM107NativeDodge({
  sendHeavyDown, sendPerpendicularDown, awaitWindup, sendWheel,
  sendPerpendicularUp, sendHeavyUp, sleep, now = () => Date.now(),
}) {
  if (![sendHeavyDown, sendPerpendicularDown, awaitWindup, sendWheel,
    sendPerpendicularUp, sendHeavyUp, sleep, now].every(fn => typeof fn === "function")) {
    throw new TypeError("M107 requires native input, acknowledgements and server-proof callbacks");
  }
  const settle = callback => Promise.resolve().then(callback).then(
    () => ({ ok: true }), error => ({ ok: false, error }),
  );
  const heavyAck = settle(sendHeavyDown);
  const perpendicularAck = settle(sendPerpendicularDown);
  try {
    const windup = await awaitWindup();
    if (!Number.isSafeInteger(windup?.serverTick) || windup.serverTick < 0) {
      throw new Error("M107 missing authoritative heavy windup proof");
    }
    const windupObservedEpochMs = now();
    const wheelTargetEpochMs = windupObservedEpochMs + 170;
    const remainingMs = wheelTargetEpochMs - now();
    if (remainingMs > 0) await sleep(remainingMs);
    const wheelIssuedEpochMs = now();
    await sendWheel();
    const acknowledgements = await Promise.all([heavyAck, perpendicularAck]);
    for (const result of acknowledgements) if (!result.ok) throw result.error;
    return { windup, plannedAfterWindupMs: 170,
      wheelIssuedAfterObservedMs: wheelIssuedEpochMs - windupObservedEpochMs };
  } finally {
    await Promise.all([heavyAck, perpendicularAck]);
    const released = await Promise.allSettled([
      Promise.resolve().then(sendPerpendicularUp), Promise.resolve().then(sendHeavyUp),
    ]);
    for (const result of released) if (result.status === "rejected") throw result.reason;
  }
}
