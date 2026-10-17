// A light attack is committed on LMB release. Capture the player's real
// movement keys at that instant so its directional selection survives a
// same-frame keyup before the next fixed network/prediction input sample.
// This affects only the one attack-bearing input, not normal movement ticks.
export function captureLightAttackMovement(keys) {
  return {
    moveX: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    moveY: Number(keys.has("KeyS")) - Number(keys.has("KeyW")),
  };
}
