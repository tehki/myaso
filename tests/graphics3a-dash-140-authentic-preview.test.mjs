import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { COMBAT } from "../src/combat/model.mjs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import {
 KNIGHT_CLIPS, KNIGHT_DASH_TRACTION_CLIP, KNIGHT_DASH_TRACTION_PRESENTATION_MS,
 createKnightSpriteRenderer, knightClip, spriteAtlasRect
} from "../web/knight-sprites.mjs";

const originalFiles=["silver_idle.webp","silver_jump.webp","silver_roll.webp","silver_sprint.webp","silver_walk.webp"];
const dashSha="ac399c5ce02473ca68d8d99474b230c4782f6bfb2f6e8232b950fcce5cf707fe";

test("Dash uses byte-identical original authorized eight-way Blender 140ms traction source without overwriting baseline",()=>{
 assert.equal(COMBAT.dash.durationMs,140);
 assert.equal(KNIGHT_DASH_TRACTION_PRESENTATION_MS,COMBAT.dash.durationMs);
 assert.equal(KNIGHT_CLIPS[KNIGHT_DASH_TRACTION_CLIP],undefined, "Frozen baseline five-clip manifest must not change");
 assert.deepEqual(readdirSync(new URL("../web/assets/knights/",import.meta.url)).filter(s=>s.endsWith(".webp")).sort(),originalFiles);
 const bytes=readFileSync(new URL("../web/assets/knights/review/silver_dash_traction_p0.webp",import.meta.url));
 assert.equal(createHash("sha256").update(bytes).digest("hex"),dashSha);
 assert.equal(bytes.toString("ascii",0,4),"RIFF");
 assert.equal(bytes.toString("ascii",8,12),"WEBP");
});

test("Dash is selected ONLY by explicit preview, never for original/unsupported Combat or NPC roles",()=>{
 assert.equal(knightClip(COMBAT_ACTION.dash,"player",0,false),null);
 assert.equal(knightClip(COMBAT_ACTION.dash,"player",0,false,"traction"),KNIGHT_DASH_TRACTION_CLIP);
 assert.equal(knightClip(COMBAT_ACTION.dash,"npc",0,false,"traction"),null);
 assert.equal(knightClip(COMBAT_ACTION.dodge,"player",0,false,"traction"),"silver_roll");
 assert.equal(knightClip(COMBAT_ACTION.jump,"player",0,false,"traction"),"silver_jump");
 for (const action of [COMBAT_ACTION.kickWindup,COMBAT_ACTION.kickActive,COMBAT_ACTION.knockdown,
 COMBAT_ACTION.dead,COMBAT_ACTION.attackActive]){
  assert.equal(knightClip(action,"player",0,false,"traction"),null);
 }
});

test("Original authored dash uses Roll-native source rows without mirroring under either locomotion lighting",()=>{
 for(const art of ["original","relit"])for(let row=0;row<8;row++){
  const facing=Math.PI/2+row*Math.PI/4;
  assert.equal(spriteAtlasRect(facing,0,8,KNIGHT_DASH_TRACTION_CLIP,art).y,row*160);
 }
});

test("Real Silver renderer uses original authored Dash frames for authenticated dash action only, resets timeline between real actions",()=>{
 class FakeImage {
  naturalWidth=0;naturalHeight=0;
  set src(url){
   this.url=url;
   const file=new URL(url).pathname.split("/").at(-1).replace(".webp","").replace("_relit","");
   this.naturalWidth=(file===KNIGHT_DASH_TRACTION_CLIP?8:KNIGHT_CLIPS[file])*160;
   this.naturalHeight=1280;
   this.onload();
  }
 }
 const sources=[];
 const ctx={
  save(){},restore(){},rotate(){},translate(){},beginPath(){},ellipse(){},fill(){},
  drawImage(img,sx,sy){sources.push({src:img.url,x:sx,y:sy});}
 };
 assert.throws(()=>createKnightSpriteRenderer({ImageCtor:FakeImage,dashArtVariant:"something"}),RangeError);
 const fallback=createKnightSpriteRenderer({ImageCtor:FakeImage});
 const review=createKnightSpriteRenderer({ImageCtor:FakeImage,dashArtVariant:"traction"});
 assert.equal(fallback.loaded().length,5);
 assert.equal(review.loaded().length,6);
 const fighter={netId:10,x:80,y:120,facing:Math.PI/2,action:COMBAT_ACTION.dash};
 assert.equal(fallback.draw(ctx,fighter,{actorKind:"player",nowMs:1000}),false);
 assert.equal(review.draw(ctx,fighter,{actorKind:"player",nowMs:1000}),true);
 assert.match(sources.at(-1).src,/\/assets\/knights\/review\/silver_dash_traction_p0\.webp$/);
 assert.equal(sources.at(-1).x,0);
 assert.equal(review.draw(ctx,fighter,{actorKind:"player",nowMs:1070}),true);
 assert.equal(sources.at(-1).x,4*160);
 assert.equal(review.draw(ctx,fighter,{actorKind:"player",nowMs:1141}),true);
 assert.equal(sources.at(-1).x,7*160);
 assert.equal(review.draw(ctx,{...fighter,action:COMBAT_ACTION.kickActive},{actorKind:"player",nowMs:1160}),false);
 assert.equal(review.draw(ctx,{...fighter,x:100,action:COMBAT_ACTION.dash},{actorKind:"player",nowMs:1170}),true);
 assert.equal(sources.at(-1).x,0,"later server Dash starts a new timeline");
 assert.equal(review.draw(ctx,fighter,{actorKind:"npc",nowMs:1300}),false);
});

test("actual authenticated game URL keeps Dash art disabled unless explicit separate double flag",()=>{
 const src=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(src,/params\.get\("knights"\) === "1"/);
 assert.match(src,/params\.get\("knightDashArt"\) === "traction"/);
 assert.match(src,/dashArtVariant:/);
 assert.doesNotMatch(src,/COMBAT_ACTION\.dash\s*=\s*/);
});
