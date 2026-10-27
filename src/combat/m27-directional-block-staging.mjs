// Original-v1 browser QA staging only: react to a replicated LightWindup,
// instead of a premature held Block expiring before the original World HIT.
// No input fabrication, World changes, timings or acceptance relaxations.
export function planM27DirectionalBackblock({isAttacker, ownAction, peerAction, distance}) {
  const inRange = Number.isFinite(distance) && distance >= 0 && distance <= 74;
  return {
    attackReady: isAttacker === true && ownAction === 0 && inRange,
    blockReady: isAttacker === false && ownAction === 0 && peerAction === 1,
  };
}
