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

  // The Firefox wheel must complete before the Chrome click is dispatched.
  // The real cross-driver round trip already adds positive delay, so do
  // not add another 45ms Chrome pointer pause after that wheel ACK.
  const pointerPauseMs = 0;
  const nominalWheelToImpactMs = attackWindupMs + pointerPauseMs;
  if (nominalWheelToImpactMs <= parryWindowMs
    || nominalWheelToImpactMs >= shortBlockMs) {
    throw new RangeError("M198 genuine click cannot reach the block-only interval");
  }
  return Object.freeze({
    clicksPerWheel: 1,
    pointerPauseMs,
    nominalWheelToImpactMs,
    minimumExchanges: Math.ceil(maxGuard / guardDamage),
  });
}
