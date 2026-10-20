import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS, KNIGHT_FRAME_PX, KNIGHT_ROLL_PRESENTATION_MS,
  KNIGHT_PRESENTATION_SCALE, knightPresentationRect, knightDirectionIndex, knightClip,
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
  assert.equal(knightClip(COMBAT_ACTION.dodge,false), "silver_roll");
  assert.equal(knightClip(COMBAT_ACTION.dodgeRecovery,false), "silver_roll");
  assert.equal(knightClip(COMBAT_ACTION.dodge,true), "t1_roll");
  assert.equal(knightClip(COMBAT_ACTION.dodgeRecovery,true), "t1_roll");
  assert.equal(knightClip(COMBAT_ACTION.dash,true), null);
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

test("roll preserves one 350ms presentation cycle across active/recovery states", () => {
  assert.equal(KNIGHT_ROLL_PRESENTATION_MS,350);
  assert.equal(KNIGHT_CLIPS.silver_roll,8);
  assert.equal(KNIGHT_CLIPS.t1_roll,8);
  const seen=[];
  class MockImage {
    set src(url) {
      const clip = url.match(/([^/]+)\.webp$/)?.[1];
      this.naturalWidth = (KNIGHT_CLIPS[clip] ?? 0) * KNIGHT_FRAME_PX;
      this.naturalHeight = 8 * KNIGHT_FRAME_PX;
      this.onload?.();
    }
  }
  const sprites=createKnightSpriteRenderer({ImageCtor:MockImage,
    assetBase:new URL("https://example.test/knights/")});
  const ctx={save(){},restore(){},rotate(){},beginPath(){},ellipse(){},fill(){},
    drawImage(...args){seen.push(args);}};
  const fighter={x:80,y:90,facing:Math.PI/2,action:COMBAT_ACTION.dodge};
  assert.equal(sprites.draw(ctx,fighter,{nowMs:1000}),true);
  const first=seen.at(-1);
  assert.equal(first[1],0);
  assert.deepEqual(first.slice(5),[-67,-78,134,134]);
  fighter.action=COMBAT_ACTION.dodgeRecovery;
  assert.equal(sprites.draw(ctx,fighter,{nowMs:1180}),true);
  assert.equal(seen.at(-1)[1],4*KNIGHT_FRAME_PX,
    "recovery must not restart clip at frame zero");
  assert.equal(sprites.draw(ctx,fighter,{nowMs:1400}),true);
  assert.equal(seen.at(-1)[1],7*KNIGHT_FRAME_PX,
    "roll must hold the final frame until recovery ends");
  const remote={...fighter,netId:47,action:COMBAT_ACTION.dodge};
  assert.equal(sprites.draw(ctx,remote,{nowMs:1500,remote:true}),true);
  assert.equal(seen.at(-1)[1],0);
  remote.action=COMBAT_ACTION.dodgeRecovery;
  assert.equal(sprites.draw(ctx,remote,{nowMs:1670,remote:true}),true);
  assert.equal(seen.at(-1)[1],3*KNIGHT_FRAME_PX);
});
import { readFileSync } from "node:fs";

// The public game consumes these real WebP files; a report alone is not enough.
test("both A3 roll atlases exist as RIFF/WebP and match the published asset contract", () => {
  const manifest=JSON.parse(readFileSync(new URL("../web/assets/knights/asset-build-report.json",import.meta.url),"utf8"));
  for (const name of ["silver_roll","t1_roll"]) {
    assert.equal(manifest[name].frames,KNIGHT_CLIPS[name]);
    assert.equal(manifest[name].visualDurationMs,KNIGHT_ROLL_PRESENTATION_MS);
    assert.deepEqual(manifest[name].sourceKeyframes,[1,3,5,7,9,11,15,22]);
    const file=readFileSync(new URL("../web/assets/knights/"+name+".webp",import.meta.url));
    assert.equal(file.subarray(0,4).toString("ascii"),"RIFF");
    assert.equal(file.subarray(8,12).toString("ascii"),"WEBP");
    assert.equal(file.length,manifest[name].bytes);
    assert.ok(file.length>4096);
  }
});


test("A2.11 approved 120% affects only the optional sprite draw rectangle", () => {
  assert.equal(KNIGHT_PRESENTATION_SCALE,1.2);
  assert.deepEqual(knightPresentationRect(false,1),
    {x:-40,y:-52,width:80,height:80});
  assert.deepEqual(knightPresentationRect(true,1),
    {x:-56,y:-65,width:112,height:112});
  assert.deepEqual(knightPresentationRect(false),
    {x:-48,y:-62.4,width:96,height:96});
  assert.deepEqual(knightPresentationRect(true),
    {x:-67,y:-78,width:134,height:134});
  assert.throws(()=>knightPresentationRect(true,1.4),RangeError);
  assert.throws(()=>knightPresentationRect(false,0),RangeError);
});

test("A2.11 baseline 100% rollback and approved 120% keep identical atlas frames and world-origin center",()=>{
  class MockImage{
    set src(url){
      const clip = new URL(url).pathname.split("/").at(-1)?.replace(".webp","");
      this.naturalWidth=(KNIGHT_CLIPS[clip]??0)*KNIGHT_FRAME_PX;
      this.naturalHeight=8*KNIGHT_FRAME_PX;
      this.onload?.();
    }
  }
  function testDraw(scale,action){
    const draws=[],ellipses=[];
    const ctx={save(){},restore(){},rotate(){},beginPath(){},
      ellipse(...args){ellipses.push(args);},fill(){},
      drawImage(...args){draws.push(args);}};
    const renderer=createKnightSpriteRenderer({ImageCtor:MockImage,
      presentationScale:scale,
      assetBase:new URL("https://example.test/knights/")});
    const actor={x:50,y:75,facing:Math.PI/2,action};
    assert.equal(renderer.draw(ctx,actor,{nowMs:1000}),true);
    return {draw:draws[0],shadow:ellipses[0]};
  }
  for(const action of [COMBAT_ACTION.idle,COMBAT_ACTION.dodge]){
    const before=testDraw(1,action),after=testDraw(1.2,action);
    assert.deepEqual(after.draw.slice(1,5),before.draw.slice(1,5),
      "Atlas coordinates and source frame must remain unchanged");
    assert.equal(after.draw[5]+after.draw[7]/2,0,
      "Knight remains horizontally centered on exact fighter origin");
    assert.equal(before.draw[5]+before.draw[7]/2,0);
    assert.equal(after.draw[7],Math.round(before.draw[7]*1.2));
    assert.equal(after.draw[8],Math.round(before.draw[8]*1.2));
    assert.equal(after.shadow[0],before.shadow[0]);
    assert.equal(after.shadow[2],before.shadow[2]*1.2);
    assert.equal(after.shadow[3],before.shadow[3]*1.2);
  }
  assert.throws(()=>createKnightSpriteRenderer({ImageCtor:MockImage,
    presentationScale:1.5}),RangeError);
});
