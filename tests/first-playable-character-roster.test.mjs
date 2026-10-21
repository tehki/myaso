import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_PLAYABLE_VISUAL_ROSTER_VERSION, ALPHA_ACTOR_KINDS,
  ALPHA_ROLE_APPEARANCES, ADULT_CHARACTER_RELEASE,
  firstPlayableAppearanceForActorKind,
} from "../src/browser/first-playable-character-roster.mjs";

test("First Playable character policy is explicit, stable and immutable", () => {
  assert.equal(FIRST_PLAYABLE_VISUAL_ROSTER_VERSION, 1);
  assert.deepEqual(ALPHA_ACTOR_KINDS, ["player", "npc"]);
  assert.deepEqual(ALPHA_ROLE_APPEARANCES,
    { player: "silver-knight", npc: "t1-sentinel" });
  assert.equal(ADULT_CHARACTER_RELEASE, "development-only");
  assert.equal(Object.isFrozen(ALPHA_ACTOR_KINDS), true);
  assert.equal(Object.isFrozen(ALPHA_ROLE_APPEARANCES), true);
});

test("every genuine player is a Silver Knight, local or remote", () => {
  // Local vs remote are rendering/transport positions, not actor identities.
  for (const player of [
    { kind: "player", local: true },
    { kind: "player", local: false, networkId: 42 },
    { kind: "player", local: false, networkId: 1007 },
  ]) {
    assert.equal(firstPlayableAppearanceForActorKind(player.kind), "silver-knight");
  }
});

test("server-identified NPCs use Sentinel, never a remote player's sprite", () => {
  assert.equal(firstPlayableAppearanceForActorKind("npc"), "t1-sentinel");
  assert.notEqual(firstPlayableAppearanceForActorKind("player"),
    firstPlayableAppearanceForActorKind("npc"));
});

test("adult bodies and invented role names are not enabled for First Playable", () => {
  for (const kind of [
    "adult", "adult-masculine", "adult-feminine",
    "remote", "sentinel", "knight", "bot", "unknown",
    "__proto__", "toString", "", null, undefined, 0, {}, [],
  ]) {
    assert.equal(firstPlayableAppearanceForActorKind(kind), null,
      `unsupported kind ${String(kind)} must use honest existing fallback`);
  }
});

test("the role lookup never creates or changes equipment and is deterministic", () => {
  for (let attempt = 0; attempt < 50; attempt++) {
    assert.equal(firstPlayableAppearanceForActorKind("player"), "silver-knight");
    assert.equal(firstPlayableAppearanceForActorKind("npc"), "t1-sentinel");
  }
});
