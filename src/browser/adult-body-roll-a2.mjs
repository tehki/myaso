// Graphics 3A — DORMANT source-art roll timing and presentation contract.
// Not a gameplay state machine. Authoritative Combat owns action/duration,
// server hitboxes, dodge i-frames and movement. Never import into live game
// before approved Core/Combat appearance integration.
export const ADULT_ROLL_PRESENTATION_MS = 350;
export const ADULT_ROLL_SOURCE_PX = 160;
export const ADULT_ROLL_FRAME_COUNT = 8;
export const ADULT_ROLL_DIRECTIONS = Object.freeze([
  "south", "southwest", "west", "northwest", "north",
  "northeast", "east", "southeast",
]);
export const ADULT_ROLL_PRESENTATION_RECT = Object.freeze({
  x: -67,
  y: -78,
  width: 134,
  height: 134,
});
export const ADULT_ROLL_SOURCE_FRAMES = Object.freeze([1,3,5,7,9,11,15,22]);

// A monotonic elapsed presentation phase must come from the accepted
// dodge/dodgeRecovery action lifecycle, not from frame refresh or a local
// self-issued roll. Don't reset at the active->recovery transition.
export function adultRollPhase(elapsedMs) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const clampedMs = Math.min(elapsedMs, ADULT_ROLL_PRESENTATION_MS);
  return Object.freeze({
    elapsedMs: clampedMs,
    frame: Math.min(ADULT_ROLL_FRAME_COUNT - 1,
      Math.floor(clampedMs / ADULT_ROLL_PRESENTATION_MS * ADULT_ROLL_FRAME_COUNT)),
    phase: clampedMs < 170 ? "active" : "recovery",
    durationMs: ADULT_ROLL_PRESENTATION_MS,
  });
}

export function adultRollAtlasRect(direction, elapsedMs) {
  if (!Number.isInteger(direction) || direction < 0 || direction >= 8) return null;
  const phase = adultRollPhase(elapsedMs);
  if (!phase) return null;
  return Object.freeze({
    source: Object.freeze({
      x: phase.frame * ADULT_ROLL_SOURCE_PX,
      y: direction * ADULT_ROLL_SOURCE_PX,
      width: ADULT_ROLL_SOURCE_PX, height: ADULT_ROLL_SOURCE_PX,
    }),
    destination: ADULT_ROLL_PRESENTATION_RECT,
    phase: phase.phase,
    frame: phase.frame,
  });
}
