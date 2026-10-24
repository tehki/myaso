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
  sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp, sendAttackClick,
  now = () => performance.now(), sleep = sleepTimer,
  maxHoldMs = 280, receiptGraceMs = 100, trustedWheelWaitMs = 0,
  // REVIEW-only M194: genuinely arm Firefox block BEFORE Chrome LMB down.
  preWheelHeadStartMs = 0,
}) {
  if (![sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp, now, sleep]
    .every(fn => typeof fn === "function")
    || !Number.isFinite(maxHoldMs) || maxHoldMs < 10 || maxHoldMs >= 320
    || !Number.isFinite(receiptGraceMs) || receiptGraceMs < 0
    || receiptGraceMs >= maxHoldMs
    || !Number.isFinite(trustedWheelWaitMs) || trustedWheelWaitMs < 0
    || trustedWheelWaitMs >= maxHoldMs
    || !Number.isFinite(preWheelHeadStartMs) || preWheelHeadStartMs < 0
    || preWheelHeadStartMs > 80
    || (sendAttackClick !== undefined && typeof sendAttackClick !== "function")
    || (sendAttackClick !== undefined && preWheelHeadStartMs === 0)
    || (preWheelHeadStartMs > 0 && trustedWheelWaitMs === 0)) {
    throw new TypeError("R2 guard-break requires bounded genuine W3C held-release and attestation");
  }
  if (preWheelHeadStartMs > 0) {
    return dispatchR2WheelFirstShortBlock({
      sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp, sendAttackClick,
      now, sleep, maxHoldMs, receiptGraceMs, trustedWheelWaitMs,
      preWheelHeadStartMs,
    });
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
  // M194 repeated native proof only: #39453669647 delivered Firefox's
  // genuine wheel 133ms after Chrome down, AFTER the normal 100ms release.
  // Wait for the pre-established low-latency trusted WebSocket receipt before
  // this one LMB-up. A 190ms fail-closed ceiling prevents heavy commitment.
  // Other scenarios retain their existing 100ms receipt-grace behavior.
  if (trustedWheelWaitMs > 0) {
    await Promise.race([
      attestation,
      sleep(trustedWheelWaitMs).then(() => { throw new Error("M194 trusted native wheel not delivered within light-release budget"); }),
      earlyWheelFailure,
    ]);
  } else {
    await Promise.race([attestation, sleep(receiptGraceMs), earlyWheelFailure]);
  }
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

// Strict M194 alternative physical choreography, separate from the original
// legacy attack-down-first path above. A genuine trusted wheel attestation is
// REQUIRED before Chrome LMB down; the brief real elapsed head start lets
// Firefox enter the server's block-only phase before the unchanged 135ms
// light lands. Any missing wheel, parry, HP loss or incorrect guard remains
// a failing *unchanged* native M194 acceptance assertion in the caller.
// This is review-only W3C QA, NOT a change to game/server defense timings.
async function dispatchR2WheelFirstShortBlock({
  sendAttackDown, sendWheel, awaitTrustedWheel, sendAttackUp, sendAttackClick,
  now, sleep, maxHoldMs, receiptGraceMs, trustedWheelWaitMs,
  preWheelHeadStartMs,
}) {
  const startedAt = now();
  const ms = () => Math.max(0, now() - startedAt);
  const wheelDispatchMs = ms();
  let wheelAckMs = null;
  const wheelOutcome = Promise.resolve().then(sendWheel).then(
    () => { wheelAckMs = ms(); return { ok: true }; },
    error => { wheelAckMs = ms(); return { ok: false, error }; },
  );
  let trustedWheelObservedMs = null;
  const attestation = Promise.resolve().then(awaitTrustedWheel).then(report => {
    if (report?.trusted !== true || !(report.deltaY > 0)) {
      throw new Error("M194 wheel-first requires a trusted real Firefox wheel-back");
    }
    trustedWheelObservedMs = ms();
    return report;
  });
  const earlyWheelFailure = wheelOutcome.then(result =>
    result.ok ? new Promise(() => {}) : Promise.reject(result.error));
  // A real W3C delivery, not a timer or synthetic event, must arrive first.
  // Original wheel driver ACK is still required before a session qualifies.
  await Promise.race([
    attestation,
    sleep(trustedWheelWaitMs).then(() => {
      throw new Error("M194 trusted native wheel not delivered before wheel-first attack");
    }),
    earlyWheelFailure,
  ]);
  await sleep(preWheelHeadStartMs);
  if (sendAttackClick) {
    // One genuine W3C down/pause/up command removes the down-ACK barrier.
    // Its command timing is NOT a physical down/up timestamp or hold length:
    // the caller still verifies actual trusted browser edges and World block.
    const attackClickDispatchMs = ms();
    let attackClickAckMs = null;
    const clickOutcome = Promise.resolve().then(sendAttackClick).then(
      () => { attackClickAckMs = ms(); return { ok: true }; },
      error => { attackClickAckMs = ms(); return { ok: false, error }; },
    );
    const [clickResult, wheelResult] = await Promise.all([clickOutcome, wheelOutcome]);
    const errors = [clickResult, wheelResult].filter(result => !result.ok).map(result => result.error);
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "M194 genuine compound click and wheel W3C commands failed");
    const rounded = n => Number(n.toFixed(1));
    return {
      wheelDispatchMs: rounded(wheelDispatchMs), wheelAckMs: rounded(wheelAckMs),
      attackClickDispatchMs: rounded(attackClickDispatchMs), attackClickAckMs: rounded(attackClickAckMs),
      attackDownDispatchMs: null, attackDownAckMs: null,
      attackUpDispatchMs: null, attackUpAckMs: null, clickHoldMs: null,
      completeMs: rounded(ms()), trustedWheelObservedMs: rounded(trustedWheelObservedMs),
      receiptGraceMs, wheelHeadStartMs: preWheelHeadStartMs, postTrustedWheelMs: preWheelHeadStartMs,
    };
  }
  const attackDownDispatchMs = ms();
  await sendAttackDown();
  const attackDownAckMs = ms();
  const attackUpDispatchMs = ms();
  if (attackUpDispatchMs - attackDownDispatchMs > maxHoldMs) {
    throw new Error("M194 real wheel-first LMB exceeded light-charge budget");
  }
  await sendAttackUp();
  const attackUpAckMs = ms();
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
    wheelHeadStartMs: preWheelHeadStartMs,
    postTrustedWheelMs: preWheelHeadStartMs,
    clickHoldMs: rounded(attackUpDispatchMs - attackDownDispatchMs),
  };
}
