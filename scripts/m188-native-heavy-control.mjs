import { COMBAT } from "../src/combat/model.mjs";

// Passive acceptance of original trusted native pointer observations only.
// A driver ACK, Key E, or a timer without actual matching UP cannot qualify.
export function requireM188NativeHeldLmb(pointers, attackRight, label = "M188") {
  if (!Array.isArray(pointers) || typeof attackRight !== "boolean") {
    throw new TypeError(label + " requires actual native pointer observations");
  }
  const upIndex = pointers.findLastIndex(e => e.type === "pointerup" && e.button === 0);
  const downIndex = pointers.findLastIndex(e => e.type === "pointerdown" && e.button === 0);
  const up = pointers[upIndex];
  const down = pointers[downIndex];
  const heldMs = up?.t - down?.t;
  if (!down || !up || upIndex <= downIndex || down.trusted !== true || up.trusted !== true
      || !Number.isSafeInteger(down.pointerId) || up.pointerId !== down.pointerId
      || !Number.isFinite(down.t) || !Number.isFinite(up.t)
      || !Number.isFinite(down.x) || !Number.isFinite(down.y)
      || !Number.isFinite(heldMs) || heldMs < COMBAT.heavyAttack.windupMs
      || Math.abs(down.y - .5) > .15
      || !(attackRight ? down.x >= .6 : down.x <= .4)) {
    throw new Error(label + " missing genuine aimed LMB hold and physical release beyond READY320ms: "
      + JSON.stringify({ down, up, heldMs }));
  }
  return { down, up, heldMs };
}
