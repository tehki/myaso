// M207: genuine Firefox light LMB must start before genuine Chrome wheel.
// Bound only the W3C test harness's wait for Firefox's WebDriver ACK.
// Actual 125ms dodge iframe, 135ms light windup, 34HP hit and all browser
// acceptance assertions remain owned by the unchanged authoritative game.
export async function dispatchM207AttackLedDodge({
  sendAttackDown,
  sendDodgeWheel,
  sleep,
  now = () => performance.now(),
  maxAttackAckWaitMs = 35,
}) {
  if (![sendAttackDown, sendDodgeWheel, sleep, now]
    .every(fn => typeof fn === "function")
    || !Number.isFinite(maxAttackAckWaitMs)
    || maxAttackAckWaitMs < 0 || maxAttackAckWaitMs > 125) {
    throw new RangeError("M207 requires real input callbacks and bounded acknowledgement wait");
  }
  const startedAt = now();
  let attackAcknowledgedAtMs = null;
  // Exactly one real Firefox W3C mouseDown is sent. ACK can arrive later
  // than the actual Firefox input event; do not let it postpone the Chrome
  // wheel beyond the 135ms server light windup.
  const attackPromise = Promise.resolve().then(sendAttackDown).then(() => {
    attackAcknowledgedAtMs = Math.max(0, now() - startedAt);
  });
  const attackAckBeforeDodge = await Promise.race([
    attackPromise.then(() => true),
    sleep(maxAttackAckWaitMs).then(() => false),
  ]);
  const wheelDispatchedAtMs = Math.max(0, now() - startedAt);
  // Exactly one genuine Chrome wheel-forward, without a multi-source W3C
  // action. Both inputs must succeed. An ingress-order inversion or late
  // dodge still fails the independent server-derived HP/evade proof.
  await Promise.all([attackPromise, Promise.resolve().then(sendDodgeWheel)]);
  return {
    attackAckBeforeDodge,
    attackAckMs: Number(attackAcknowledgedAtMs.toFixed(1)),
    wheelDispatchedAtMs: Number(wheelDispatchedAtMs.toFixed(1)),
    maxAttackAckWaitMs,
  };
}
