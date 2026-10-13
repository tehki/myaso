// M212 strict, acceptance-only W3C input sequencing (revised after CI).
// True full-click Firefox-wheel-first could expire during a 203ms Chrome
// pointer release. True full-click Chrome-first, and then down/wheel/up,
// instead parried: Firefox's server block began ~90ms before impact.
// A genuine Firefox wheel ~48ms BEFORE a split Chrome down/up targets the
// intended impact in the unchanged 125..240ms block-only interval.
//
// No simulated events, retries, direct server writes or combat changes.
export async function dispatchM212AttackLedShortBlock({
  sendWheel, sendAttackDown, sendAttackUp, sleep,
  now = () => performance.now(), wheelHeadStartMs = 48, clickHoldMs = 10,
}) {
  if (![sendWheel, sendAttackDown, sendAttackUp, sleep, now]
    .every(fn => typeof fn === "function")
    || !Number.isFinite(wheelHeadStartMs) || wheelHeadStartMs < 0
    || wheelHeadStartMs > 125
    || !Number.isFinite(clickHoldMs) || clickHoldMs < 0
    || clickHoldMs > 100) {
    throw new TypeError("M212 requires bounded genuine W3C wheel/down/up callbacks");
  }
  const startedAt = now();
  // Exactly one Firefox wheel, started first. Do not equate its ACK or
  // browser monotonic clock with authoritative server activation.
  let wheelFailure = null;
  // Call the real W3C sender immediately so a synchronous driver failure
  // aborts before any Chrome down. The promise still tracks late rejections.
  const issuedWheel = sendWheel();
  const wheelOutcome = Promise.resolve(issuedWheel).then(
    () => ({ ok: true }), error => {
      wheelFailure = error;
      return { ok: false, error };
    },
  );
  await sleep(wheelHeadStartMs);
  // Fail before Chrome down if the actual W3C wheel has already failed.
  if (wheelFailure) throw wheelFailure;
  const attackDownDispatchMs = Math.max(0, now() - startedAt);
  await Promise.resolve().then(sendAttackDown);
  const attackDownAckMs = Math.max(0, now() - startedAt);
  // Genuine click release is required even when the Firefox ACK is late.
  await sleep(clickHoldMs);
  const attackUpDispatchMs = Math.max(0, now() - startedAt);
  const [releaseResult, wheelResult] = await Promise.allSettled([
    Promise.resolve().then(sendAttackUp), wheelOutcome,
  ]);
  if (releaseResult.status === "rejected") throw releaseResult.reason;
  if (wheelResult.status === "rejected") throw wheelResult.reason;
  if (!wheelResult.value.ok) throw wheelResult.value.error;
  return {
    attackDownDispatchMs: Number(attackDownDispatchMs.toFixed(1)),
    attackDownAckMs: Number(attackDownAckMs.toFixed(1)),
    attackUpDispatchMs: Number(attackUpDispatchMs.toFixed(1)),
    completeMs: Number(Math.max(0, now() - startedAt).toFixed(1)),
    wheelHeadStartMs,
    clickHoldMs,
  };
}
