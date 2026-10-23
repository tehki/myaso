import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS, createKnightSpriteRenderer } from "../web/knight-sprites.mjs";

function spriteProbe() {
  class SourceWebP {
    naturalWidth = 0;
    naturalHeight = 0;
    set src(uri) {
      this.name = new URL(uri).pathname.split("/").pop().replace(".webp", "");
      this.naturalWidth = KNIGHT_CLIPS[this.name] * 160;
      this.naturalHeight = 8 * 160;
      this.onload();
    }
  }
  const draws = [];
  const ctx = {
    save() {}, restore() {}, rotate() {}, beginPath() {}, ellipse() {}, fill() {},
    drawImage(image, sourceX) { draws.push({ clip: image.name, sourceX }); },
  };
  const renderer = createKnightSpriteRenderer({ ImageCtor: SourceWebP });
  return { draws, ctx, renderer };
}

test("replacement local server actor does not inherit the previous Silver roll's last frame", () => {
  const { draws, ctx, renderer } = spriteProbe();
  const original = { netId: 1, x: 100, y: 100, facing: 0, action: COMBAT_ACTION.dodge };
  assert.equal(renderer.draw(ctx, original, { actorKind: "player", remote: false, nowMs: 1000 }), true);
  assert.equal(draws.at(-1).sourceX, 0);
  assert.equal(renderer.draw(ctx, original, { actorKind: "player", remote: false, nowMs: 1330 }), true);
  assert.equal(draws.at(-1).sourceX, 7 * 160, "original actor advances to last roll frame");
  assert.equal(renderer.draw(ctx, { ...original, netId: 5, x: 101 }, {
    actorKind: "player", remote: false, nowMs: 1340,
  }), true);
  assert.equal(draws.at(-1).clip, "silver_roll");
  assert.equal(draws.at(-1).sourceX, 0, "new authenticated actor must start its own roll at frame 0");
});

test("replacement local server actor does not inherit stale Silver sprint velocity", () => {
  const { draws, ctx, renderer } = spriteProbe();
  const original = { netId: 1, x: 100, y: 100, facing: 0, action: COMBAT_ACTION.idle };
  renderer.draw(ctx, original, { actorKind: "player", remote: false, nowMs: 1000 });
  renderer.draw(ctx, { ...original, x: 132 }, {
    actorKind: "player", remote: false, nowMs: 1100,
  });
  assert.equal(draws.at(-1).clip, "silver_sprint");
  renderer.draw(ctx, { ...original, netId: 8, x: 133 }, {
    actorKind: "player", remote: false, nowMs: 1110,
  });
  assert.equal(draws.at(-1).clip, "silver_idle",
    "fresh server actor must not inherit old authenticated actor's motion cache");
});

test("the live first-party local renderer carries its authenticated server netId into Silver cache", () => {
  const src = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(src, /const ownId = networkClient\.playerNetId;/,
    "local visual identity must come from the existing authenticated network client");
  assert.match(src, /if \(ownId && local\.initialized\) \{\s*local\.netId = ownId;\s*drawFighterScreen\(/,
    "the real local fighter object must be tagged before the existing sprite renderer call");
});
