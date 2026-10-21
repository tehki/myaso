// First Playable Alpha — owner-approved presentation roster.
// This module selects art only. Role assertions MUST come from Core's
// authenticated player identity or an authoritative NPC roster; client
// guesses (including remote/local or a fighter's network ID) are not roles.
// No sprite loading, game activation, item grants, combat or wire changes.
export const FIRST_PLAYABLE_VISUAL_ROSTER_VERSION = 1;
export const ALPHA_ACTOR_KINDS = Object.freeze(["player", "npc"]);
export const ALPHA_ROLE_APPEARANCES = Object.freeze({
  player: "silver-knight",
  npc: "t1-sentinel",
});
export const ADULT_CHARACTER_RELEASE = "development-only";

// A missing, unrecognized or untrusted kind must NOT be rendered as an NPC.
// The caller must use its current verified non-sprite fallback if null.
export function firstPlayableAppearanceForActorKind(actorKind) {
  if (typeof actorKind !== "string"
    || !Object.hasOwn(ALPHA_ROLE_APPEARANCES, actorKind)) return null;
  return ALPHA_ROLE_APPEARANCES[actorKind];
}
