// M212 strict, acceptance-only W3C input sequencing (revised after CI).
// True full-click Firefox-wheel-first could expire during a 203ms Chrome
// pointer release. True full-click Chrome-first, and then down/wheel/up,
// instead parried: Firefox's server block began ~90ms before impact.
// Legacy M212 keeps the original split Chrome down/up and wheel-ACK gate.
// M221 uses one W3C click batch only after a trusted Firefox wheel receipt;
// its 48ms head start is measured from the real W3C wheel COMMAND START,
// not from a delayed localhost fetch receipt. ACK remains mandatory for proof.
// The unchanged 125..240ms block-only window must still pass in real CI.
//
// No simulated events, retries, direct server writes or combat changes.
export async function dispatchM212AttackLedShortBlock({
  sendWheel, sendAttackDown, sendAttackUp, sleep,
  sendAttackClick = null, awaitTrustedWheel = null,
  now = () => performance.now(), wheelHeadStartMs = 48, clickHoldMs = 10,
  postTrustedWheelMs = 0,
}) {
  if (![sendWheel, sleep, now].every(fn => typeof fn === "function")
    || (sendAttackClick === null
      ? typeof sendAttackDown !== "function" || typeof sendAttackUp !== "function"
      : typeof sendAttackClick !== "function")
    || (awaitTrustedWheel !== null && typeof awaitTrustedWheel !== "function")
    || !Number.isFinite(wheelHeadStartMs) || wheelHeadStartMs < 0
    || wheelHeadStartMs > 125
    || !Number.isFinite(clickHoldMs) || clickHoldMs < 0
    || clickHoldMs > 100
    || !Number.isFinite(postTrustedWheelMs) || postTrustedWheelMs < 0
    || postTrustedWheelMs > 60) {
    throw new TypeError("M212 requires bounded genuine W3C wheel/down/up callbacks");
  }
  const startedAt = now();
  // Exactly one Firefox wheel, started first. Do not equate its ACK or
  // browser monotonic clock with authoritative server activation.
  let wheelAckMs = null;
  let attackUpAckMs = null;
  // Call the real W3C sender immediately so a synchronous driver failure
  // aborts before any Chrome down. The promise still tracks late rejections.
  const issuedWheel = sendWheel();
  const wheelOutcome = Promise.resolve(issuedWheel).then(
    () => {
      wheelAckMs = Math.max(0, now() - startedAt);
      return { ok: true };
    }, error => {
      wheelAckMs = Math.max(0, now() - startedAt);
      return { ok: false, error };
    },
  );
  // Both constraints must be satisfied: the empirically qualified 48ms
  // head start and the Firefox driver's ACK for the ONE actual wheel.
  // This avoids the exact-head quality regression with a 119.7ms wheel
  // ACK where the first strike landed within the 125ms parry window.
  // No wheel or attack may be resent, and no game-side times are changed.
  // M221 optional genuine DOM-wheel delivery receipt comes through a
  // localhost-only test-harness side channel, not through synthetic dispatch.
  // The normal M212 path still waits for WebDriver ACK when no receipt exists.
  // Never treat a driver ACK (which may be late) as the DOM event timestamp.
  let trustedWheelObservedMs = null;
  if (awaitTrustedWheel) {
    const observedOutcome = Promise.resolve().then(awaitTrustedWheel).then(
      report => {
        if (report?.trusted !== true || !(report.deltaY > 0)) {
          throw new Error("M221 requires actual trusted wheel-back DOM delivery");
        }
        trustedWheelObservedMs = Math.max(0, now() - startedAt);
      },
    );
    // A wheel-command rejection is fatal even before the DOM receipt.
    await Promise.race([
      observedOutcome,
      wheelOutcome.then(result => result.ok ? new Promise(() => {}) : Promise.reject(result.error)),
    ]);
    // M221: the qualified head start begins at W3C wheel dispatch, not at
    // the later localhost fetch receipt. Waiting a second full 48ms after
    // receipt let overloaded Firefox exceed its unchanged 240ms short-block
    // interval (CI #38566792473). Trust the actual event BEFORE Chrome down,
    // but do not double-count time already elapsed in this harness clock.
    // This does not compare Firefox and Chrome local performance.now origins.
    const elapsedSinceWheelCommandMs = Math.max(0, now() - startedAt);
    const remainingHeadStartMs = Math.max(0, wheelHeadStartMs - elapsedSinceWheelCommandMs);
    if (remainingHeadStartMs > 0) await sleep(remainingHeadStartMs);
    // M329 acceptance-only: wait after the REAL trusted Firefox DOM event,
    // not after a delayed HTTP driver ACK or synthetic event. Real CI
    // #39303800110 recorded the third guard-break wheel at server tick 379,
    // Chrome windup already at 377, and a true PARRY at 385 (6 ticks).
    // Typical trusted receipts consume ~5-14ms; CI #39309716318 attempt
    // 5 consumed 70ms, then a further fixed 45ms made the genuine light hit
    // after the 240ms block expired (34 HP unblocked). Budget the pause from
    // actual elapsed time since the W3C wheel command, reserving the ordinary
    // 12ms receipt transit only. A delayed receipt consumes the pause instead
    // of appending it. Never send before the trusted event is observed.
    // The server's 125ms parry / 240ms block intervals and all HP/guard,
    // receipt, ACK, and genuine browser input assertions remain unchanged.
    if (postTrustedWheelMs > 0) {
      const normalReceiptBudgetMs = 12;
      const elapsedMs = Math.max(0, now() - startedAt);
      const alreadyConsumedMs = Math.max(0, elapsedMs - normalReceiptBudgetMs);
      const remainingPauseMs = Math.max(0, postTrustedWheelMs - alreadyConsumedMs);
      if (remainingPauseMs > 0) await sleep(remainingPauseMs);
    }
  } else {
    const [wheelResult] = await Promise.all([wheelOutcome, sleep(wheelHeadStartMs)]);
    if (!wheelResult.ok) throw wheelResult.error;
  }
  const attackDownDispatchMs = Math.max(0, now() - startedAt);
  let attackDownAckMs = null;
  let attackUpDispatchMs = null;
  if (sendAttackClick) {
    // M221: one real Chrome W3C request owns down, a 10ms pointer pause and
    // up. Never wait for an HTTP ACK between the browser's down and up.
    // Separate event timestamps come from the real DOM pointer observer,
    // not from invented driver-time offsets.
    await Promise.resolve().then(() => sendAttackClick(clickHoldMs)).finally(() => {
      attackUpAckMs = Math.max(0, now() - startedAt);
    });
  } else {
    // The original M212 split-action fallback remains unchanged.
    await Promise.resolve().then(sendAttackDown);
    attackDownAckMs = Math.max(0, now() - startedAt);
    await sleep(clickHoldMs);
    attackUpDispatchMs = Math.max(0, now() - startedAt);
    await Promise.resolve().then(sendAttackUp).finally(() => {
      attackUpAckMs = Math.max(0, now() - startedAt);
    });
  }
  // Late W3C command failures stay fatal. No second action is ever sent.
  if (awaitTrustedWheel) {
    const wheelResult = await wheelOutcome;
    if (!wheelResult.ok) throw wheelResult.error;
  }
  return {
    wheelDispatchMs: 0,
    wheelAckMs: Number(wheelAckMs.toFixed(1)),
    attackDownDispatchMs: Number(attackDownDispatchMs.toFixed(1)),
    attackDownAckMs: attackDownAckMs === null ? null : Number(attackDownAckMs.toFixed(1)),
    attackUpDispatchMs: attackUpDispatchMs === null ? null : Number(attackUpDispatchMs.toFixed(1)),
    attackUpAckMs: Number(attackUpAckMs.toFixed(1)),
    completeMs: Number(Math.max(0, now() - startedAt).toFixed(1)),
    wheelHeadStartMs,
    postTrustedWheelMs,
    clickHoldMs,
    trustedWheelObservedMs: trustedWheelObservedMs === null ? null : Number(trustedWheelObservedMs.toFixed(1)),
  };
}
