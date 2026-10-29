import { COMBAT_ACTION, combatActionHint } from "./combat-readability.mjs";

// Render a genuine current-actor original World windup on snapshot receipt.
// Do not change, infer, predict, stage or send Combat inputs from this hint.
// Real higher-priority damage/feedback messages retain their normal lifetime.
export function authoritativeWindupHudHint(
  own, { now = 0, combatMessage = null, combatMessageUntil = 0 } = {},
) {
  if (!own || (combatMessage && now <= combatMessageUntil)) return null;
  if (own.action !== COMBAT_ACTION.attackWindup
    && own.action !== COMBAT_ACTION.heavyAttackWindup) return null;
  return combatActionHint(own);
}
