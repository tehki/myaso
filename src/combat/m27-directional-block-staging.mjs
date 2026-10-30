// Original-v1 browser QA staging only: arm against replicated LightWindup
// and keep that held Block input through the original World contact.
// No input fabrication, World changes, timings or acceptance relaxations.
export function planM27DirectionalBackblock({isAttacker, ownAction, peerAction, distance}) {
  const inRange = Number.isFinite(distance) && distance >= 0 && distance <= 74;
  return {
    attackReady: isAttacker === true && ownAction === 0 && inRange,
    // Arm only from authentic Windup; keep that same held input while our
    // replicated actor is already blocking. Releasing on own Block toggled
    // the original input off before the actual World contact.
    blockReady: isAttacker === false && ((ownAction === 0 && peerAction === 1)
      || (ownAction === 6 && (peerAction === 1 || peerAction === 2))),
  };
}
