// Combat4 -> PlayCanvas: pure read-only presentation of ORIGINAL decoded Rust
// snapshots. No local hit inference, action prediction, charge timer or packets.
// Combat/HP/stamina remain exclusively owned by the original Rust World.
import { COMBAT_ACTION } from '../../../../src/browser/combat-readability.mjs';

const ACTION_NAMES = Object.freeze(Object.fromEntries(
  Object.entries(COMBAT_ACTION).map(([name, value]) => [value, name])
));
const RECOVERY_ACTIONS = new Set([
  COMBAT_ACTION.attackRecovery, COMBAT_ACTION.heavyAttackRecovery,
  COMBAT_ACTION.jumpAttackRecovery, COMBAT_ACTION.kickRecovery,
  COMBAT_ACTION.runningAttackRecovery, COMBAT_ACTION.attackLeftRecovery,
  COMBAT_ACTION.attackRightRecovery, COMBAT_ACTION.dodgeRecovery,
  COMBAT_ACTION.feintRecovery
]);

// Returns null when the snapshot has no complete authoritative Combat data.
// In particular, NEVER invent 100HP or a local action while awaiting Rust.
export function projectAuthoritativeCombat(entity) {
  if (!entity || !Number.isInteger(entity.netId) || entity.netId <= 0
    || !Number.isInteger(entity.serverTick) || entity.serverTick < 0
    || entity.serverTick > 0xffffffff
    || !Number.isInteger(entity.action)
    || !Object.hasOwn(ACTION_NAMES, entity.action)
    || ![entity.hp, entity.guard, entity.stamina].every(
      value => Number.isFinite(value) && value >= 0 && value <= 100)) {
    return null;
  }

  return Object.freeze({
    netId: entity.netId,
    serverTick: entity.serverTick,
    action: entity.action,
    actionName: ACTION_NAMES[entity.action],
    hp: entity.hp,
    guard: entity.guard,
    stamina: entity.stamina,
    // This is a DISPLAY CUE, not an input permit or a client-side 180ms clock.
    // A genuine Light34 punish is accepted and applied only by the Rust World.
    recoveryCue: entity.action === COMBAT_ACTION.jumpAttackRecovery
      ? 'jump-attack-recovery' : null,
    inRecovery: RECOVERY_ACTIONS.has(entity.action)
  });
}
