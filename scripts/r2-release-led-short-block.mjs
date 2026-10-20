// R2 browser acceptance uses only native W3C input. LMB-down begins
// charging; ONLY LMB-up commits the light attack. Firefox wheel-back is a
// genuine trusted event, independently attested and W3C-ACKed. Under loaded
// native browsers its attestation fetch can arrive far later than the actual
// DOM wheel event. Do not keep LMB held until a delayed receipt: doing so
// stretches the unchanged 135ms light hit beyond the 240ms short block.
// Allow a bounded interval for Firefox's actual trusted wheel delivery before
// releasing the same real button once. Require trusted receipt, wheel ACK and
// native cross-browser event ordering before accepting HP/guard/parry proof.
import { setTimeout as sleepTimer } from "node:timers/promises";

export async function dispatchR2ReleaseLedShortBlock({
  sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp,
  now = () => performance.now(), sleep = sleepTimer,
  maxHoldMs = 280, receiptGraceMs = 100,
}) {
  if (![sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp, now, sleep]
    .every(fn => typeof fn === "function")
    || !Number.isFinite(maxHoldMs) || maxHoldMs < 10 || maxHoldMs >= 320
    || !Number.isFinite(receiptGraceMs) || receiptGraceMs < 0
    || receiptGraceMs >= maxHoldMs) {
    throw new TypeError("R2 guard-break requires bounded genuine W3C held-release and attestation");
  }
  const startedAt = now();
  const ms = () => Math.max(0, now() - startedAt);
  const attackDownDispatchMs = ms();
  await sendAttackDown();
  const attackDownAckMs = ms();
  const wheelDispatchMs = ms();
  let wheelAckMs = null;
  const wheelOutcome = Promise.resolve().then(sendWheel).then(
    () => { wheelAckMs = ms(); return { ok: true }; },
    error => { wheelAckMs = ms(); return { ok: false, error }; },
  );
  let trustedWheelObservedMs = null;
  const attestation = Promise.resolve().then(awaitTrustedWheel).then(report => {
    if (report?.trusted !== true || !(report.deltaY > 0)) {
      throw new Error("R2 guard-break requires a trusted real Firefox wheel-back event");
    }
    trustedWheelObservedMs = ms();
    return report;
  });
  const earlyWheelFailure = wheelOutcome.then(result =>
    result.ok ? new Promise(() => {}) : Promise.reject(result.error));
  // On a fast native delivery release immediately. On a slow *receipt* release
  // at the bounded grace, then verify actual DOM ordering and required
  // attestation in the caller. Never silently accept missing/bad wheel.
  // Quality #39430978668 proved 70ms grace released before a 94ms native
  // Firefox wheel. Quality #39434360024 proved 200ms grace can delay the
  // actual 135ms light until AFTER the unchanged 240ms short block expires,
  // even when wheel DOM arrives early but its HTTP attestation is delayed.
  // Cap the wait at 100ms so late attestations never prolong the light.
  // Actual trusted wheel-before-pointerUP, no HP, expected guard and no
  // parry remain mandatory, independently of any attestation delay.
  await Promise.race([attestation, sleep(receiptGraceMs), earlyWheelFailure]);
  const attackUpDispatchMs = ms();
  if (attackUpDispatchMs - attackDownDispatchMs > maxHoldMs) {
    throw new Error("R2 genuine LMB hold exceeded light-charge budget before release; no strike allowed");
  }
  await sendAttackUp();
  const attackUpAckMs = ms();
  // Both external observations remain mandatory even if Chrome already
  // released during a delayed wheel receipt. A rejected W3C wheel or missing
  // trusted DOM event can NEVER produce a passing acceptance run.
  await attestation;
  const wheelResult = await wheelOutcome;
  if (!wheelResult.ok) throw wheelResult.error;
  const rounded = n => Number(n.toFixed(1));
  return {
    wheelDispatchMs: rounded(wheelDispatchMs),
    wheelAckMs: rounded(wheelAckMs),
    attackDownDispatchMs: rounded(attackDownDispatchMs),
    attackDownAckMs: rounded(attackDownAckMs),
    attackUpDispatchMs: rounded(attackUpDispatchMs),
    attackUpAckMs: rounded(attackUpAckMs),
    completeMs: rounded(ms()),
    trustedWheelObservedMs: rounded(trustedWheelObservedMs),
    receiptGraceMs,
    wheelHeadStartMs: 0,
    postTrustedWheelMs: 0,
    clickHoldMs: rounded(attackUpDispatchMs - attackDownDispatchMs),
  };
}
