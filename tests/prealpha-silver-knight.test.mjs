import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { alphaPlayPath } from "../web/alpha-config.mjs";
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

test("unsupported attack/kick/stun/death retain Combat tells over real Silver idle, not circles", () => {
  for (const action of [
    COMBAT_ACTION.kickWindup, COMBAT_ACTION.kickActive, COMBAT_ACTION.kickRecovery,
    COMBAT_ACTION.attackWindup, COMBAT_ACTION.attackActive,
    COMBAT_ACTION.heavyAttackWindup, COMBAT_ACTION.heavyAttackActive,
    COMBAT_ACTION.runningAttackActive, COMBAT_ACTION.block,
    COMBAT_ACTION.knockdown, COMBAT_ACTION.stunned, COMBAT_ACTION.dead,
    COMBAT_ACTION.jumpAttackActive,
  ]) assert.equal(knightClip(action, "player"), "silver_idle");
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
    {actorKind:"player",remote:true,nowMs:1100}), true);
  assert.equal(draws.length, 3);
});

test("actual server-derived Greyhaven-free arena renderer uses Silver for both human viewpoints", () => {
  const src = readFileSync(new URL("../web/online-game.mjs", import.meta.url),"utf8");
  assert.match(src,/const knightSprites = params\.get\("knights"\) === "1"/);
  assert.match(src,/createKnightSpriteRenderer\(\{sourceArtVariant: params\.get\("knightArt"\) === "original" \? "original" : "relit"\}\)/);
  assert.match(src,/drawFighterWorld\(sampled,/);
  assert.match(src,/drawFighterScreen\(canvas\.width \/ 2,/);
  assert.match(src,/knightSprites\?\.draw\(ctx, fighter,/);
  assert.match(src,/remote, actorKind: "player", rotation: presentationRotation/);
  assert.match(src,/const drewKnight/);
  assert.match(src,/if \(!drewKnight && !knightSprites\)/);
  assert.match(src,/drawAttackTell\(action, remote\)/);
  assert.match(src,/drawHeavyAttackTell\(action, remote\)/);
  assert.match(src,/drawKickTell\(action\)/);
  assert.match(src,/drawKnockdownTell\(\)/);
  assert.match(src,/showPrototypeWeaponStroke\(Boolean\(knightSprites\)\)/);
  assert.doesNotMatch(src,/actorKind: "npc"/);
  assert.doesNotMatch(src,/knightKickSource/);
  assert.doesNotMatch(src,/\/greyhaven\//);
});

test("the official Pre-Alpha multiplayer lobby activates Silver for every participant", () => {
  const url = new URL(alphaPlayPath({
    serverUrl: "https://game.open-trust-layer.org:4433/game",
    certificateSha256: "a".repeat(64),
    maxPlayers: 4,
  }), "https://game.open-trust-layer.org");
  assert.equal(url.pathname, "/web/");
  assert.equal(url.searchParams.get("knights"), "1");
  assert.equal(url.searchParams.get("server"), "https://game.open-trust-layer.org:4433/game");
  assert.equal(url.searchParams.get("cert"), "a".repeat(64));
});

test("original Graphics 3A Silver atlases retain exact source SHA-256, no NPC assets", () => {
  const original = {
    "silver_idle.webp": "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4",
    "silver_walk.webp": "8fd421ea2d96a38a70afd9e05bec1297e90bffd8fde586a79c6a0907413adbb7",
    "silver_sprint.webp": "3ec5b5c2b6a24d8bbad3639984f2020bec0519be08f8021be30d8d20b1e9f271",
    "silver_roll.webp": "31c774ac930a5cf1060640f1fc2914b02d6d5ddccd7d56591123efd098909426",
    "silver_jump.webp": "b73c506ad886fe68e01c834b36bb18ea951edd8327dfb8532c2eb0450dbc2e14",
  };
  const folder = new URL("../web/assets/knights/", import.meta.url);
  assert.deepEqual(readdirSync(folder).filter(name => name.endsWith(".webp")).sort(),
    Object.keys(original).sort(), "Pre-Alpha must not include T1 Sentinel or unapproved kick");
  for (const [filename, expected] of Object.entries(original)) {
    const bytes = readFileSync(new URL(filename, folder));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected, filename);
    assert.equal(bytes.subarray(0,4).toString(), "RIFF");
    assert.equal(bytes.subarray(8,12).toString(), "WEBP");
  }
});
