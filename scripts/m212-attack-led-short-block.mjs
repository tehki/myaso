// M212 strict, acceptance-only W3C input sequencing (revised after CI).
// True full-click Firefox-wheel-first could expire during a 203ms Chrome
// pointer release. True full-click Chrome-first, and then down/wheel/up,
// instead parried: Firefox's server block began ~90ms before impact.
// A genuine Firefox wheel leads the split Chrome down/up by at least 48ms.
// When WebDriver's real wheel ACK takes longer, wait for that ACK before
// pressing Chrome; otherwise the defensive 125ms parry begins too late.
// The unchanged 125..240ms block-only window must still pass in real CI.
//
// No simulated events, retries, direct server writes or combat changes.
export async function dispatchM212AttackLedShortBlock({
  sendWheel, sendAttackDown, sendAttackUp, sleep,
  sendAttackClick = null, awaitTrustedWheel = null,
  now = () => performance.now(), wheelHeadStartMs = 48, clickHoldMs = 10,
}) {
  if (![sendWheel, sleep, now].every(fn => typeof fn === "function")
    || (sendAttackClick === null
      ? typeof sendAttackDown !== "function" || typeof sendAttackUp !== "function"
      : typeof sendAttackClick !== "function")
    || (awaitTrustedWheel !== null && typeof awaitTrustedWheel !== "function")
    || !Number.isFinite(wheelHeadStartMs) || wheelHeadStartMs < 0
    || wheelHeadStartMs > 125
    || !Number.isFinite(clickHoldMs) || clickHoldMs < 0
    || clickHoldMs > 100) {
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
    // A constant head start measured AFTER genuine DOM delivery makes
    // Chrome's down independent of geckodriver's slow command ACK tail.
    await sleep(wheelHeadStartMs);
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
    clickHoldMs,
    trustedWheelObservedMs: trustedWheelObservedMs === null ? null : Number(trustedWheelObservedMs.toFixed(1)),
  };
}
