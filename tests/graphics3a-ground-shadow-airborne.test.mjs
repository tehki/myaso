import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS, KNIGHT_PRESENTATION_SCALE, createKnightSpriteRenderer } from "../web/knight-sprites.mjs";

function make() {
  class FakeImage {
    naturalWidth = 0; naturalHeight = 0;
    set src(src) {
      const file = new URL(src).pathname.split("/").at(-1).replace("_relit", "").replace(".webp","");
      this.naturalWidth = KNIGHT_CLIPS[file] * 160;
      this.naturalHeight = 8 * 160;
      this.onload();
    }
  }
  let y = -18, stack = [];
  const events = [];
  const ctx = {
    save() { stack.push(y); },
    restore() { y = stack.pop(); },
    rotate() {},
    translate(_dx,dy) { y += dy; events.push({ kind: "translate", dy }); },
    beginPath() {}, fill() {},
    ellipse(_x,cy) { events.push({ kind: "ground", y: y + cy }); },
    drawImage(_img,_sx,_sy,_sw,_sh,_dx,dy) { events.push({ kind: "sprite", y: y + dy }); },
  };
  return {ctx,events,originalY:()=>y,renderer:createKnightSpriteRenderer({ ImageCtor:FakeImage })};
}

test("genuine authoritative jump: Silver shadow stays on arena floor while 18px lift applies only to the sprite", () => {
  const {ctx,events,renderer,originalY} = make();
  assert.equal(renderer.draw(ctx,{netId:1,x:0,y:0,action:COMBAT_ACTION.jump,facing:0},
    {actorKind:"player",nowMs:1000,visualLift:18}),true);
  const shadow=events.find(e=>e.kind==="ground");
  const sprite=events.find(e=>e.kind==="sprite");
  assert.ok(shadow && sprite);
  assert.equal(shadow.y,11*KNIGHT_PRESENTATION_SCALE,
    "arena floor remains at the unlifted world origin");
  assert.equal(sprite.y,-18-52*KNIGHT_PRESENTATION_SCALE,
    "jump sprite remains 18px above its ground-origin presentation");
  assert.equal(originalY(),-18, "caller canvas transformation must be restored");
});

test("idle shadow stays grounded and unsupported Combat draws the genuine idle knight with independent tells", () => {
  const {ctx,events,renderer} = make();
  assert.equal(renderer.draw(ctx,{netId:1,x:0,y:0,action:COMBAT_ACTION.idle,facing:0},
    {actorKind:"player",nowMs:1000}),true);
  assert.equal(events.find(e=>e.kind==="ground").y,-18+11*KNIGHT_PRESENTATION_SCALE);
  assert.equal(events.filter(e=>e.kind==="translate").length,0);
  assert.equal(renderer.draw(ctx,{netId:1,x:0,y:0,action:COMBAT_ACTION.kickActive,facing:0},
    {actorKind:"player",nowMs:1100,visualLift:18}),true);
  assert.equal(events.filter(e=>e.kind==="ground").length,2);
  assert.equal(events.filter(e=>e.kind==="sprite").length,2);
});

test("actual multiplayer fighter call forwards already-established presentation jump lift into the authentic renderer", () => {
  const src=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(src,/const lift = airborne \? 18 : 0;/);
  assert.match(src,/ctx\.translate\(x,\s*y - lift\)/);
  assert.match(src,/knightSprites\?\.draw\(ctx,\s*fighter,[\s\S]{0,180}visualLift:\s*lift/);
  const art=readFileSync(new URL("../web/knight-sprites.mjs",import.meta.url),"utf8");
  assert.match(art,/ctx\.rotate\(-rotation\)/);
  assert.match(art,/ctx\.translate\(0,\s*visualLift\)/);
  assert.match(art,/ctx\.translate\(0,\s*-visualLift\)/);
});
