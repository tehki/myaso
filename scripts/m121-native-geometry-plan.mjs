import { COMBAT } from "../src/combat/model.mjs";

// A movement proposal only. Duration never proves that a native browser moved;
// the caller must reread real replicas after every genuine WASD transaction.
export function planM121NativeGeometry(own, target, attackRight) {
  if (!own || !target || !Number.isSafeInteger(own.netId) || !Number.isSafeInteger(target.netId)
      || own.netId === target.netId || typeof attackRight !== "boolean"
      || ![own.x, own.y, target.x, target.y].every(Number.isFinite)
      || own.action !== 0 || target.action !== 0) {
    throw new Error("M121 staging requires two distinct actual idle fighter replicas");
  }
  const direction = attackRight ? 1 : -1;
  const forwardGap = (target.x - own.x) * direction;
  const dy = target.y - own.y;
  if (forwardGap <= 0 || forwardGap > 400 || Math.abs(dy) > 200) {
    throw new Error("M121 actual fighters are outside bounded ordered staging geometry");
  }
  const pulse = (key, distance, axis) => ({ key, axis,
    durationMs: Math.max(20, Math.min(180, Math.ceil(Math.abs(distance) * 1000 / COMBAT.moveSpeed))),
  });
  if (Math.abs(dy) > 4) return pulse(dy > 0 ? "s" : "w", dy, "y");
  const desiredGap = COMBAT.attack.reach - 4; // 72px, well inside unchanged 94px contact reach
  if (Math.abs(forwardGap - desiredGap) > 4) {
    const toward = forwardGap > desiredGap;
    return pulse(toward === attackRight ? "d" : "a", forwardGap - desiredGap, "x");
  }
  // Preserve room for the later real directional chord's ~20px lateral move,
  // plus 10px radial margin. Do not expand light reach or infer a World HIT.
  const projectedDistance = Math.hypot(forwardGap, Math.abs(dy) + 20);
  const unchangedReach = COMBAT.attack.reach + COMBAT.fighterRadius;
  if (projectedDistance > unchangedReach - 10 || forwardGap <= COMBAT.fighterRadius * 2 + 4) {
    throw new Error("M121 real geometry lacks interior range for genuine directional movement");
  }
  return null;
}
