// R2 authoritative release-to-strike changes the safe native W3C guard-break
// handshake: mouseDOWN starts holding/charging, but never attacks. Arm that
// genuine input first, send exactly ONE real Firefox wheel-back, and release
// Chrome LMB only after the trusted DOM-wheel receipt. The resulting 135ms
// server light windup lands after the 125ms parry window yet inside the
// unchanged 240ms short block (without relying on a slow WebDriver receipt).
// W3C wheel ACK and short-hold identity remain fail-closed. No retry or
// synthetic DOM input occurs inside this dispatcher.
export async function dispatchR2ReleaseLedShortBlock({
  sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp,
  now = () => performance.now(), maxHoldMs = 280,
}) {
  if (![sendAttackDown,sendWheel,awaitTrustedWheel,sendAttackUp,now].every(fn=>typeof fn==="function")
    || !Number.isFinite(maxHoldMs) || maxHoldMs < 10 || maxHoldMs >= 320) {
    throw new TypeError("R2 guard-break requires genuine W3C down/wheel/attestation/up and a bounded sub-320ms hold");
  }
  const startedAt = now();
  const ms = () => Math.max(0, now() - startedAt);
  const attackDownDispatchMs = ms();
  await sendAttackDown();
  const attackDownAckMs = ms();
  const wheelDispatchMs = ms();
  let wheelAckMs = null;
  // Start the actual W3C wheel now; do not wait for a delayed ACK to
  // authorize Chrome release, but a late rejection still fails the test.
  const wheelOutcome = Promise.resolve().then(sendWheel).then(
    () => { wheelAckMs = ms(); return {ok:true}; },
    error => { wheelAckMs = ms(); return {ok:false,error}; },
  );
  const observed = Promise.resolve().then(awaitTrustedWheel).then(report=>{
    if (report?.trusted !== true || !(report.deltaY > 0)) {
      throw new Error("R2 guard-break requires a trusted real Firefox wheel-back event");
    }
    return report;
  });
  await Promise.race([
    observed,
    wheelOutcome.then(result=>result.ok ? new Promise(()=>{}) : Promise.reject(result.error)),
  ]);
  const trustedWheelObservedMs = ms();
  if (trustedWheelObservedMs > maxHoldMs) {
    throw new Error("R2 genuine LMB hold exceeded light-charge budget before trusted wheel; no strike allowed");
  }
  // This is the ONLY attack commitment point. All preceding W3C input
  // merely held the button in the authoritative charging state.
  const attackUpDispatchMs = ms();
  await sendAttackUp();
  const attackUpAckMs = ms();
  const wheelResult = await wheelOutcome;
  if (!wheelResult.ok) throw wheelResult.error;
  const rounded = n=>Number(n.toFixed(1));
  return {
    wheelDispatchMs:rounded(wheelDispatchMs),
    wheelAckMs:rounded(wheelAckMs),
    attackDownDispatchMs:rounded(attackDownDispatchMs),
    attackDownAckMs:rounded(attackDownAckMs),
    attackUpDispatchMs:rounded(attackUpDispatchMs),
    attackUpAckMs:rounded(attackUpAckMs),
    completeMs:rounded(ms()),
    trustedWheelObservedMs:rounded(trustedWheelObservedMs),
    wheelHeadStartMs:0,
    postTrustedWheelMs:0,
    clickHoldMs:rounded(attackUpDispatchMs-attackDownDispatchMs),
  };
}
