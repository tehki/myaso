// M212: genuine cross-browser light/block scheduling. The authoritative
// 125ms parry / 240ms short block / 135ms light windup are never altered.
// Chrome W3C click completion varies from ~11ms to >200ms; sending a whole
// click after Firefox block can hit after block expiry, while finishing the
// whole click before Firefox block can trigger a parry.
//
// Send exactly one true Chrome mouse-down, then dispatch one real Firefox
// wheel-back while Chrome is still down. After a bounded genuine W3C lead,
// send one true Chrome mouse-up, committing the strike. A late input fails
// the original M194 server-authoritative guard/HP/parry acceptance checks.
export async function dispatchM212AttackLedShortBlock({
  sendAttackDown, sendWheel, sendAttackUp, sleep,
  now = () => performance.now(), wheelHeadStartMs = 55,
}) {
  if (![sendAttackDown, sendWheel, sendAttackUp, sleep, now]
    .every(callback => typeof callback === "function")
    || !Number.isFinite(wheelHeadStartMs)
    || wheelHeadStartMs < 0 || wheelHeadStartMs > 125) {
    throw new TypeError("M212 requires bounded genuine W3C input callbacks");
  }
  const startedAt = now();
  // An unsuccessful real Chrome down must not dispatch a Firefox wheel.
  await Promise.resolve().then(sendAttackDown);
  const attackDownAckMs = Math.max(0, now() - startedAt);
  // Wheel starts before the real Chrome release. Never replay either input.
  const wheelDispatchMs = Math.max(0, now() - startedAt);
  const wheelOutcome = Promise.resolve().then(sendWheel).then(
    () => ({ ok: true, value: null }),
    error => ({ ok: false, error }),
  );
  // Allow only a bounded cross-browser input lead. Do not compare browser
  // monotonic clock origins or claim server success from harness timing.
  // Even when Firefox fails, release Chrome's real button exactly once.
  await sleep(wheelHeadStartMs);
  const attackUpDispatchMs = Math.max(0, now() - startedAt);
  const [releaseResult, wheelResult] = await Promise.allSettled([
    Promise.resolve().then(sendAttackUp), wheelOutcome,
  ]);
  if (releaseResult.status === "rejected") throw releaseResult.reason;
  if (wheelResult.status === "rejected") throw wheelResult.reason;
  if (!wheelResult.value.ok) throw wheelResult.value.error;
  const completeMs = Math.max(0, now() - startedAt);
  return {
    attackDownAckMs: Number(attackDownAckMs.toFixed(1)),
    wheelDispatchMs: Number(wheelDispatchMs.toFixed(1)),
    attackUpDispatchMs: Number(attackUpDispatchMs.toFixed(1)),
    completeMs: Number(completeMs.toFixed(1)),
    wheelHeadStartMs,
  };
}
