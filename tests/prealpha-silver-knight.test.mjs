import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import {
  KNIGHT_CLIPS, KNIGHT_PRESENTATION_SCALE, KNIGHT_ROLL_PRESENTATION_MS,
  createKnightSpriteRenderer, knightClip, knightPresentationRect,
  showPrototypeWeaponStroke,
} from "../web/knight-sprites.mjs";

test("Pre-Alpha bundles only five authentic Silver Knight movement clips, not Sentinel/NPC", () => {
  assert.deepEqual(Object.keys(KNIGHT_CLIPS).sort(),
    ["silver_idle", "silver_jump", "silver_roll", "silver_sprint", "silver_walk"]);
  assert.equal(KNIGHT_PRESENTATION_SCALE, 1.2);
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS, 350);
  assert.equal(knightPresentationRect(true).width, 134);
  assert.equal(knightClip(COMBAT_ACTION.idle, "player", 0, false), "silver_idle");
  assert.equal(knightClip(COMBAT_ACTION.idle, "player", 100, true), "silver_walk");
  assert.equal(knightClip(COMBAT_ACTION.idle, "player", 320, true), "silver_sprint");
  assert.equal(knightClip(COMBAT_ACTION.dodge, "player"), "silver_roll");
  assert.equal(knightClip(COMBAT_ACTION.dodgeRecovery, "player"), "silver_roll");
  assert.equal(knightClip(COMBAT_ACTION.jump, "player"), "silver_jump");
  for (const action of Object.values(COMBAT_ACTION)) {
    assert.equal(knightClip(action, "npc"), null);
    assert.equal(knightClip(action, null), null);
  }
});

test("unsupported attack/kick/stun/death retain real Combat tells, not counterfeit Silver animation", () => {
  for (const action of [
    COMBAT_ACTION.kickWindup, COMBAT_ACTION.kickActive, COMBAT_ACTION.kickRecovery,
    COMBAT_ACTION.attackWindup, COMBAT_ACTION.attackActive,
    COMBAT_ACTION.heavyAttackWindup, COMBAT_ACTION.heavyAttackActive,
    COMBAT_ACTION.runningAttackActive, COMBAT_ACTION.block,
    COMBAT_ACTION.knockdown, COMBAT_ACTION.stunned, COMBAT_ACTION.dead,
    COMBAT_ACTION.jumpAttackActive,
  ]) assert.equal(knightClip(action, "player"), null);
  assert.equal(showPrototypeWeaponStroke(true), false);
  assert.equal(showPrototypeWeaponStroke(false), true);
});

test("same source Silver atlases draw for local and remote authenticated human snapshots", () => {
  const images = [];
  class FakeImage {
    naturalWidth = 0;
    naturalHeight = 0;
    set src(uri) {
      const name = new URL(uri).pathname.split("/").pop().replace(".webp", "");
      assert.ok(name.startsWith("silver_"));
      images.push(name);
      this.naturalWidth = KNIGHT_CLIPS[name] * 160;
      this.naturalHeight = 1280;
      this.onload();
    }
  }
  const draws = [];
  const ctx = {
    save(){}, restore(){}, rotate(){}, beginPath(){}, ellipse(){}, fill(){},
    drawImage(...args){ draws.push(args); },
  };
  const renderer = createKnightSpriteRenderer({
    ImageCtor: FakeImage, assetBase: new URL("https://game.example/knights/"),
  });
  assert.deepEqual(renderer.loaded().sort(), Object.keys(KNIGHT_CLIPS).sort());
  assert.deepEqual(images.sort(), Object.keys(KNIGHT_CLIPS).sort());
  assert.equal(renderer.draw(ctx, {netId: 1,x:10,y:20,facing:0,action:COMBAT_ACTION.idle},
    {actorKind:"player",remote:false,nowMs:1000}), true);
  assert.equal(renderer.draw(ctx, {netId: 2,x:10,y:20,facing:0,action:COMBAT_ACTION.idle},
    {actorKind:"player",remote:true,nowMs:1000}), true);
  assert.equal(draws.length, 2);
  assert.equal(renderer.draw(ctx, {netId: 3,x:10,y:20,action:COMBAT_ACTION.idle},
    {actorKind:"npc",remote:true,nowMs:1000}), false);
  assert.equal(renderer.draw(ctx, {netId: 2,x:10,y:20,action:COMBAT_ACTION.dead},
    {actorKind:"player",remote:true,nowMs:1100}), false);
  assert.equal(draws.length, 2);
});

test("actual server-derived Greyhaven-free arena renderer uses Silver for both human viewpoints", () => {
  const src = readFileSync(new URL("../web/online-game.mjs", import.meta.url),"utf8");
  assert.match(src,/const knightSprites = params\.get\("knights"\) === "0" \? null : createKnightSpriteRenderer\(\)/);
  assert.match(src,/drawFighterWorld\(sampled,/);
  assert.match(src,/drawFighterScreen\(canvas\.width \/ 2,/);
  assert.match(src,/knightSprites\?\.draw\(ctx, fighter,/);
  assert.match(src,/remote, actorKind: "player", rotation: presentationRotation/);
  assert.match(src,/const drewKnight/);
  assert.match(src,/if \(!drewKnight\)/);
  assert.match(src,/drawAttackTell\(action, remote\)/);
  assert.match(src,/drawHeavyAttackTell\(action, remote\)/);
  assert.match(src,/drawKickTell\(action\)/);
  assert.match(src,/drawKnockdownTell\(\)/);
  assert.match(src,/showPrototypeWeaponStroke\(Boolean\(knightSprites\)\)/);
  assert.doesNotMatch(src,/actorKind: "npc"/);
  assert.doesNotMatch(src,/knightKickSource/);
  assert.doesNotMatch(src,/\/greyhaven\//);
});
