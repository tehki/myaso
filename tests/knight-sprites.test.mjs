import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS, KNIGHT_FRAME_PX, knightDirectionIndex, knightClip,
  spriteAtlasRect, createKnightSpriteRenderer } from "../web/knight-sprites.mjs";

test("eight directions agree with mouse-facing screen coordinates", () => {
  const cases = [[Math.PI/2,0],[3*Math.PI/4,1],[Math.PI,2],
    [-3*Math.PI/4,3],[-Math.PI/2,4],[-Math.PI/4,5],[0,6],[Math.PI/4,7]];
  for (const [angle,dir] of cases) assert.equal(knightDirectionIndex(angle),dir);
  assert.equal(knightDirectionIndex(Math.PI*2),6);
  assert.equal(knightDirectionIndex(NaN),0);
});

test("atlas source bounds are exact and negative animation phases wrap", () => {
  for (const [name,frames] of Object.entries(KNIGHT_CLIPS)) {
    const rect = spriteAtlasRect(Math.PI/4,frames-1,frames);
    assert.deepEqual(rect,{x:(frames-1)*KNIGHT_FRAME_PX,y:7*KNIGHT_FRAME_PX,
      width:KNIGHT_FRAME_PX,height:KNIGHT_FRAME_PX},name);
    assert.equal(spriteAtlasRect(Math.PI/2,-1,frames).x,(frames-1)*KNIGHT_FRAME_PX);
  }
});

test("graphics states use Silver locally and Sentinel remotely", () => {
  assert.equal(knightClip(COMBAT_ACTION.idle,false), "silver_idle");
  assert.equal(knightClip(COMBAT_ACTION.idle,false,215,true), "silver_walk");
  assert.equal(knightClip(COMBAT_ACTION.idle,false,333,true), "silver_sprint");
  assert.equal(knightClip(COMBAT_ACTION.jump,false), "silver_jump");
  assert.equal(knightClip(COMBAT_ACTION.block,true), "t1_block");
  assert.equal(knightClip(COMBAT_ACTION.attackActive,true), "t1_attack");
  assert.equal(knightClip(COMBAT_ACTION.idle,true), "t1_walk");
  assert.equal(knightClip(COMBAT_ACTION.dead,true), null);
  assert.equal(knightClip(COMBAT_ACTION.knockdown,false), null);
});

test("one atlas per clip is shared across fighters, failures use original graphics", () => {
  const seen=[];
  class MockImage {
    set src(value) {
      this.value=value;
      const name=value.match(/([^/]+)\.webp$/)?.[1];
      this.naturalWidth=(KNIGHT_CLIPS[name]??0)*KNIGHT_FRAME_PX;
      this.naturalHeight=8*KNIGHT_FRAME_PX;
      if(name==="silver_idle") this.onload?.();
    }
  }
  const renderer=createKnightSpriteRenderer({ ImageCtor:MockImage,
    assetBase:new URL("https://example.test/knights/") });
  assert.deepEqual(renderer.loaded(),["silver_idle"]);
  const ctx={save(){},restore(){},rotate(){},beginPath(){},ellipse(){},fill(){},
    drawImage(...args){seen.push(args);}};
  const fighter={x:20,y:30,facing:Math.PI/2,action:COMBAT_ACTION.idle};
  assert.equal(renderer.draw(ctx,fighter,{nowMs:1000,rotation:0}),true);
  assert.equal(seen.length,1);
  assert.equal(seen[0][3],KNIGHT_FRAME_PX);
  assert.equal(renderer.draw(ctx,{...fighter,action:COMBAT_ACTION.jump},
    {nowMs:1016}),false);
  assert.equal(renderer.draw(ctx,{...fighter,action:COMBAT_ACTION.dead},
    {nowMs:1032}),false);
});
