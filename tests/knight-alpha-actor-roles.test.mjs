import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS, KNIGHT_FRAME_PX, knightClip,
  createKnightSpriteRenderer } from "../web/knight-sprites.mjs";

class InstantAtlas {
  set src(uri) {
    this.uri=String(uri);
    const clip=new URL(uri).pathname.split("/").at(-1).replace(/\.webp$/,"");
    this.naturalWidth=(KNIGHT_CLIPS[clip]??0)*KNIGHT_FRAME_PX;
    this.naturalHeight=8*KNIGHT_FRAME_PX;
    this.onload?.();
  }
}
const surface=()=>{
  const seen=[];
  const ctx={save(){},restore(){},rotate(){},beginPath(){},
    ellipse(){},fill(){},drawImage(image,...data){seen.push({
      filename:new URL(image.uri).pathname.split("/").at(-1),data,
    });}};
  return {seen,ctx};
};
function renderer(ImageCtor=InstantAtlas) {
  return createKnightSpriteRenderer({ImageCtor,assetBase:
    new URL("https://review.invalid/assets/knights/")});
}
const fighter=(netId,action=COMBAT_ACTION.idle)=>({
  netId,x:100+netId,y:120,facing:Math.PI/2,action,
});

test("explicit authenticated-player role token selects identical Silver for local and two remote players",()=>{
 const r=renderer(),{seen,ctx}=surface();
 assert.equal(r.draw(ctx,fighter(1),{actorKind:"player",nowMs:1000,remote:false}),true);
 assert.equal(r.draw(ctx,fighter(2),{actorKind:"player",nowMs:1000,remote:true}),true);
 assert.equal(r.draw(ctx,fighter(3),{actorKind:"player",nowMs:1000,remote:true}),true);
 assert.deepEqual(seen.map(d=>d.filename),
   ["silver_idle.webp","silver_idle.webp","silver_idle.webp"]);
 assert.equal(r.draw(ctx,fighter(2,COMBAT_ACTION.dodge),
   {actorKind:"player",nowMs:1200,remote:true}),true);
 assert.equal(seen.at(-1).filename,"silver_roll.webp");
 assert.equal(r.draw(ctx,fighter(3,COMBAT_ACTION.jump),
   {actorKind:"player",nowMs:1216,remote:true}),true);
 assert.equal(seen.at(-1).filename,"silver_jump.webp");
});

test("T1 Sentinel is exclusively selected from an explicit authoritative NPC role",()=>{
 const r=renderer(),{seen,ctx}=surface();
 const npc=fighter(12);
 assert.equal(r.draw(ctx,npc,{actorKind:"npc",nowMs:1000,remote:true}),true);
 assert.equal(seen.at(-1).filename,"t1_walk.webp");
 npc.action=COMBAT_ACTION.attackActive;
 assert.equal(r.draw(ctx,npc,{actorKind:"npc",nowMs:1050,remote:true}),true);
 assert.equal(seen.at(-1).filename,"t1_attack.webp");
 npc.action=COMBAT_ACTION.block;
 assert.equal(r.draw(ctx,npc,{actorKind:"npc",nowMs:1100,remote:true}),true);
 assert.equal(seen.at(-1).filename,"t1_block.webp");
});

test("network location or untrusted fighter.kind cannot promote a player to Sentinel",()=>{
 const r=renderer(),{seen,ctx}=surface();
 const spoof={...fighter(70),kind:"npc"};
 for(const actorKind of [undefined,null,"remote","NPC","adult",
   "__proto__","toString",7,{},[]]){
   const n=seen.length;
   assert.equal(r.draw(ctx,spoof,{actorKind,remote:true,nowMs:1500}),false);
   assert.equal(seen.length,n,"no sprite should be drawn without trusted kind");
 }
 // Caller explicitly asserts a validated human; hostile payload field is ignored.
 assert.equal(r.draw(ctx,spoof,{actorKind:"player",remote:true,nowMs:1516}),true);
 assert.equal(seen.at(-1).filename,"silver_idle.webp");
});

test("remote human attack/block/stun/knockdown/death cannot borrow Sentinel attack atlas",()=>{
 for(const action of [
   COMBAT_ACTION.attackWindup,COMBAT_ACTION.attackActive,
   COMBAT_ACTION.heavyAttackActive,COMBAT_ACTION.jumpAttackActive,
   COMBAT_ACTION.block,COMBAT_ACTION.kickActive,
   COMBAT_ACTION.stunned,COMBAT_ACTION.knockdown,COMBAT_ACTION.dead,
 ]) {
   assert.equal(knightClip(action,"player",400,true),null,
     "unsupported human action must preserve legacy Combat telegraph");
   const r=renderer(),{seen,ctx}=surface();
   assert.equal(r.draw(ctx,fighter(4,action),{actorKind:"player",
     remote:true,nowMs:2200}),false);
   assert.equal(seen.length,0);
 }
 assert.equal(knightClip(COMBAT_ACTION.attackActive,"npc"),"t1_attack");
});

test("missing or undecoded Silver atlas returns original Combat fallback",()=>{
 class MissingSilver extends InstantAtlas {
   set src(uri){
     this.uri=String(uri);
     const clip=new URL(uri).pathname.split("/").at(-1).replace(/\.webp$/,"");
     this.naturalWidth=(KNIGHT_CLIPS[clip]??0)*KNIGHT_FRAME_PX;
     this.naturalHeight=8*KNIGHT_FRAME_PX;
     if(clip==="silver_idle") this.onerror?.();
     else this.onload?.();
   }
 }
 const r=renderer(MissingSilver),{seen,ctx}=surface();
 assert.equal(r.draw(ctx,fighter(1),{actorKind:"player",nowMs:1000}),false);
 assert.equal(r.draw(ctx,fighter(2),{actorKind:"player",remote:true,nowMs:1000}),false);
 assert.equal(seen.length,0);
});
