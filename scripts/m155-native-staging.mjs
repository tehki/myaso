import { COMBAT } from "../src/combat/model.mjs";

// Plan only genuine movement from current replicas. Re-read after every native
// pulse; a planned duration is never evidence that an actor reached its target.
export function planM155NativeStaging(fighters, { kickerId, defenderId, punisherId }) {
  const ids = [kickerId, defenderId, punisherId];
  if (!Array.isArray(fighters) || fighters.length !== 3 || new Set(ids).size !== 3
    || new Set(fighters.map(f => f?.netId)).size !== 3
    || !ids.every(id => Number.isSafeInteger(id) && id > 0)) throw new Error("M155 needs three real staging roles");
  const actors = ids.map(id => fighters.find(f => f.netId === id));
  if (actors.some(f => !f || !Number.isFinite(f.x) || !Number.isFinite(f.y)
    || f.action !== 0 || f.hp !== 100 || f.guard !== 100)) throw new Error("M155 needs pristine idle replica positions");
  const [kicker, defender, punisher] = actors;
  const direction = Math.sign(defender.x - kicker.x);
  if (!direction || (punisher.x - defender.x) * direction <= 0
    || Math.abs(kicker.y - defender.y) > 8 || Math.abs(punisher.y - defender.y) > 8) {
    throw new Error("M155 needs actual opposite-side horizontal staging");
  }
  const kickLimit = COMBAT.kick.reach + COMBAT.fighterRadius;
  const lightLimit = COMBAT.attack.reach + COMBAT.fighterRadius;
  const desired = [
    [punisher, defender.x + direction * (COMBAT.kick.knockback + COMBAT.attack.reach - 12)],
    [kicker, defender.x - direction * (kickLimit - 12)],
  ];
  for (const [actor, x] of desired) {
    const delta = x - actor.x;
    if (Math.abs(delta) > 6) return { actorId: actor.netId, key: delta > 0 ? "d" : "a",
      holdMs: Math.max(20, Math.min(450, Math.ceil(Math.abs(delta) * 1000 / COMBAT.moveSpeed))) };
  }
  const kickDistance = Math.hypot(kicker.x - defender.x, kicker.y - defender.y);
  const excludedDistance = Math.hypot(kicker.x - punisher.x, kicker.y - punisher.y);
  const punishDistance = Math.hypot(punisher.x - defender.x - direction * COMBAT.kick.knockback,
    punisher.y - defender.y);
  if (kickDistance > kickLimit - 4 || kickDistance < 2 * COMBAT.fighterRadius + 6
    || excludedDistance <= kickLimit + 12 || punishDistance > lightLimit - 12
    || punishDistance < 2 * COMBAT.fighterRadius + 8) {
    throw new Error("M155 actual positions do not isolate unchanged kick and light reach");
  }
  return null;
}
