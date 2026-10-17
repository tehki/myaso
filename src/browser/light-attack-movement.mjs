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


// A short LMB is committed on release. Native W3C keyboard/key-up and pointer
// release callbacks can straddle one browser frame under load. Preserve the
// genuine held movement at pointerDOWN only if all lateral keys have already
// released at pointerUP. This is one attack's input provenance, never
// world/server geometry or a synthetic movement command.
export function resolveLightAttackReleaseMovement(released, pressed) {
  const release = released && Number.isFinite(released.moveX) && Number.isFinite(released.moveY)
    ? released : { moveX: 0, moveY: 0 };
  const initial = pressed && Number.isFinite(pressed.moveX) && Number.isFinite(pressed.moveY)
    ? pressed : { moveX: 0, moveY: 0 };
  return (release.moveX !== 0 || release.moveY !== 0)
    ? { moveX: release.moveX, moveY: release.moveY }
    : { moveX: initial.moveX, moveY: initial.moveY };
}
