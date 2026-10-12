// Acceptance-only timing plan: one genuine LMB per genuine Firefox block.
// Do not modify the authoritative parry/block durations or attack windup.
export function planM198GuardBreakW3cExchange({
  parryWindowMs, shortBlockMs, attackWindupMs, guardDamage, maxGuard,
}) {
  if (![parryWindowMs, shortBlockMs, attackWindupMs, guardDamage, maxGuard]
    .every(value => Number.isFinite(value) && value > 0)
    || parryWindowMs >= shortBlockMs) {
    throw new RangeError("M198 requires valid authoritative combat timing and guard parameters");
  }

  // M199: M198 post-merge quality #38259669037 parried the third real
  // Chrome click in repetition 5/5. The zero-pause 135ms impact target
  // was only 10ms beyond the unchanged 125ms parry boundary. Add one
  // bounded genuine W3C pointer pause AFTER the sequential Firefox wheel
  // acknowledgement, targeting 175ms nominally (50ms beyond parry,
  // 65ms before the short-block expiry). Cap at 40ms to protect the
  // upper-tail browser ingress jitter; never manipulate server actions.
  const nominalCenterMs = (parryWindowMs + shortBlockMs) / 2;
  const pointerPauseMs = Math.max(0, Math.min(40, Math.round(nominalCenterMs - attackWindupMs)));
  const nominalWheelToImpactMs = attackWindupMs + pointerPauseMs;
  const blockOnlyMarginMs = Math.min(
    nominalWheelToImpactMs - parryWindowMs,
    shortBlockMs - nominalWheelToImpactMs,
  );
  if (blockOnlyMarginMs <= 0) {
    throw new RangeError("M199 genuine click cannot reach the block-only interval");
  }  return Object.freeze({
    clicksPerWheel: 1,
    pointerPauseMs,
    nominalWheelToImpactMs,
    blockOnlyMarginMs,
    minimumExchanges: Math.ceil(maxGuard / guardDamage),
  });
}
