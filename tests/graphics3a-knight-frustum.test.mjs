import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { ARENA_VIEW_ZOOM, projectArenaPoint } from "../src/browser/arena-viewport.mjs";
import {
  KNIGHT_DIRECTIONS, KNIGHT_PRESENTATION_SCALE,
  knightPresentationRect, knightVisibilityMargin,
} from "../web/knight-sprites.mjs";

test("Silver remote render margin encloses original Roll/airborne/lean silhouette at arena zoom", () => {
  const margin = knightVisibilityMargin(ARENA_VIEW_ZOOM);
  const rect = knightPresentationRect(true, KNIGHT_PRESENTATION_SCALE);
  const maxX = Math.max(Math.abs(rect.x), Math.abs(rect.x + rect.width));
  const maxY = Math.max(Math.abs(rect.y), Math.abs(rect.y + rect.height));
  const upperBound = Math.hypot(maxX * 1.38 + 16, maxY + 18) * ARENA_VIEW_ZOOM;
  assert.ok(margin >= Math.ceil(upperBound), "do not prematurely cull a real Silver silhouette");
  assert.ok(margin > 64, "original abstract-fighter margin is too narrow for full Knight art");
  assert.equal(Number.isInteger(margin), true);
  assert.equal(KNIGHT_DIRECTIONS.length, 8, "all eight source facings share the bounded atlas footprint");
  const edge = projectArenaPoint(0, 0, 0, 0, 960, 540);
  assert.deepEqual(edge, {x: 480, y: 270});
});

test("the original unzoomed and opt-in 100-percent Knight sizes remain bounded", () => {
  for (const zoom of [0.84, 1]) {
    for (const scale of [1, KNIGHT_PRESENTATION_SCALE]) {
      const margin = knightVisibilityMargin(zoom, scale);
      assert.ok(margin >= 64 && margin < 256, "bounded Canvas culling, not world interest");
    }
  }
});

test("invalid visual zoom/scale never silently changes the actor's frustum", () => {
  for (const zoom of [0, -1, 1.01, Number.NaN, Infinity, "0.84", null]) {
    assert.throws(() => knightVisibilityMargin(zoom), RangeError);
  }
  assert.throws(() => knightVisibilityMargin(ARENA_VIEW_ZOOM, 2), RangeError);
});

test("authentic remote fighter Canvas culling is presentation-only and keeps legacy rollback", () => {
  const game = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(game, /const knightCullMargin = knightSprites \? knightVisibilityMargin\(ARENA_VIEW_ZOOM\) : 64/);
  assert.match(game, /projectArenaPoint\(fighter\.x, fighter\.y,/);
  assert.match(game, /projected\.x < -knightCullMargin \|\| projected\.x > canvas\.width \+ knightCullMargin/);
  assert.match(game, /projected\.y < -knightCullMargin \|\| projected\.y > canvas\.height \+ knightCullMargin/);
  assert.match(game, /drawFighterScreen\(screenX, screenY, fighter, body, shadow, true, damageTell, recoveryTell\)/);
  assert.match(game, /const drewKnight = knightSprites\?\.draw\(ctx, fighter,/);
  assert.match(game, /drawHeavyAttackTell\(action, remote\)/);
  assert.match(game, /drawParryTell\(\)/);
  assert.match(game, /drawGuardBreakTell\(\)/);
});
