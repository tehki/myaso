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

  const blockOnlyMidpointMs = (parryWindowMs + shortBlockMs) / 2;
  const pointerPauseMs = Math.max(0, Math.floor(
    (blockOnlyMidpointMs - attackWindupMs) / 5,
  ) * 5);
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
