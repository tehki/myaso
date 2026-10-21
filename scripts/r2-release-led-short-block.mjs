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

export function planM194TrustedWheelDelay({ eventEpochMs, nowEpochMs, targetAgeMs }) {
  if (![eventEpochMs, nowEpochMs, targetAgeMs].every(Number.isFinite)
    || targetAgeMs <= 0 || targetAgeMs > 60) {
    throw new TypeError("M194 requires the real native wheel epoch and bounded target age");
  }
  const receiptAgeMs = nowEpochMs - eventEpochMs;
  // Same-host browser epoch only schedules native input. It never certifies
  // server admission. Leave headroom for the unchanged 135ms windup and input
  // sampling before 240ms expires; stale/future reports cannot start a strike.
  if (receiptAgeMs < 0 || receiptAgeMs > 70) {
    throw new Error("M194 trusted wheel receipt is stale or from a future clock");
  }
  return { receiptAgeMs, remainingMs: Math.max(0, targetAgeMs - receiptAgeMs) };
}

export async function dispatchR2ReleaseLedShortBlock({
  sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp,
  now = () => performance.now(), sleep = sleepTimer,
  maxHoldMs = 280, receiptGraceMs = 100, trustedWheelWaitMs = 0,
  postTrustedWheelMs = 0,
  compensateWheelReceipt = false, nowEpoch = () => Date.now(),
  awaitServerBlock,
}) {
  if (![sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp, now, sleep, nowEpoch]
    .every(fn => typeof fn === "function")
    || !Number.isFinite(maxHoldMs) || maxHoldMs < 10 || maxHoldMs >= 320
    || !Number.isFinite(receiptGraceMs) || receiptGraceMs < 0
    || receiptGraceMs >= maxHoldMs
    || !Number.isFinite(trustedWheelWaitMs) || trustedWheelWaitMs < 0
    || trustedWheelWaitMs >= maxHoldMs
    || !Number.isFinite(postTrustedWheelMs) || postTrustedWheelMs < 0
    || postTrustedWheelMs > 60
    || (postTrustedWheelMs > 0 && trustedWheelWaitMs === 0)
    || trustedWheelWaitMs + postTrustedWheelMs >= maxHoldMs
    || typeof compensateWheelReceipt !== "boolean"
    || (compensateWheelReceipt && postTrustedWheelMs === 0)
    || (awaitServerBlock !== undefined && (typeof awaitServerBlock !== "function"
      || compensateWheelReceipt || trustedWheelWaitMs === 0))) {
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
  let trustedWheelReport = null;
  const attestation = Promise.resolve().then(awaitTrustedWheel).then(report => {
    if (report?.trusted !== true || !(report.deltaY > 0)) {
      throw new Error("R2 guard-break requires a trusted real Firefox wheel-back event");
    }
    trustedWheelObservedMs = ms();
    trustedWheelReport = report;
    return report;
  });
  // In admission-led mode the real report may arrive after native release.
  // Retain rejection as required evidence without an unhandled promise race.
  const attestationOutcome = attestation.then(
    () => ({ ok: true }), error => ({ ok: false, error }),
  );
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
  // M194 repeated native proof only: #39453669647 delivered Firefox's
  // genuine wheel 133ms after Chrome down, AFTER the normal 100ms release.
  // Wait for the pre-established low-latency trusted WebSocket receipt before
  // this one LMB-up. A 190ms fail-closed ceiling prevents heavy commitment.
  // Other scenarios retain their existing 100ms receipt-grace behavior.
  let serverBlockProof = null;
  let serverBlockObservedMs = null;
  if (awaitServerBlock) {
    serverBlockProof = await Promise.race([
      Promise.resolve().then(awaitServerBlock), earlyWheelFailure,
      sleep(trustedWheelWaitMs).then(() => { throw new Error("M194 server Block not observed within release budget"); }),
    ]);
    if (!Number.isSafeInteger(serverBlockProof?.serverTick) || serverBlockProof.serverTick < 0
      || !Number.isSafeInteger(serverBlockProof?.fighterId) || serverBlockProof.fighterId < 1) {
      throw new Error("M194 requires actual authoritative Block admission");
    }
    serverBlockObservedMs = ms();
  } else if (trustedWheelWaitMs > 0) {
    await Promise.race([
      attestation,
      sleep(trustedWheelWaitMs).then(() => { throw new Error("M194 trusted native wheel not delivered within light-release budget"); }),
      earlyWheelFailure,
    ]);
  } else {
    await Promise.race([attestation, sleep(receiptGraceMs), earlyWheelFailure]);
  }
  // Scoped M194/M205 release immediately after real server Block admission.
  // Even the earliest next-tick light commitment reaches active after the
  // unchanged parry interval. A DOM-receipt sampling wait is unnecessary.
  // Report latency cannot prolong the strike; native attestation still must
  // complete below, and original HP/guard/parry proof remains mandatory.
  const wheelReceiptTiming = compensateWheelReceipt ? planM194TrustedWheelDelay({
    eventEpochMs: trustedWheelReport?.eventEpochMs, nowEpochMs: nowEpoch(),
    targetAgeMs: postTrustedWheelMs,
  }) : null;
  const remainingWheelDelayMs = wheelReceiptTiming?.remainingMs ?? postTrustedWheelMs;
  if (remainingWheelDelayMs > 0) await sleep(remainingWheelDelayMs);
  const wheelReleaseAgeMs = compensateWheelReceipt ? planM194TrustedWheelDelay({
    eventEpochMs: trustedWheelReport.eventEpochMs, nowEpochMs: nowEpoch(),
    targetAgeMs: postTrustedWheelMs,
  }).receiptAgeMs : null;
  const attackUpDispatchMs = ms();
  if (attackUpDispatchMs - attackDownDispatchMs > maxHoldMs) {
    throw new Error("R2 genuine LMB hold exceeded light-charge budget before release; no strike allowed");
  }
  await sendAttackUp();
  const attackUpAckMs = ms();
  // Both external observations remain mandatory even if Chrome already
  // released during a delayed wheel receipt. A rejected W3C wheel or missing
  // trusted DOM event can NEVER produce a passing acceptance run.
  const attested = await attestationOutcome;
  if (!attested.ok) throw attested.error;
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
    postTrustedWheelMs: rounded(postTrustedWheelMs),
    wheelReceiptTiming,
    wheelReleaseAgeMs,
    serverBlockProof,
    serverBlockObservedMs,
    clickHoldMs: rounded(attackUpDispatchMs - attackDownDispatchMs),
  };
}
