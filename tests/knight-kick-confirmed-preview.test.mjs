import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {
  KNIGHT_FRAME_PX,KNIGHT_KICK_SOURCE_PHASE_MS,KNIGHT_KICK_SOURCE_FRAMES,
  knightKickSourceFrame,knightClip,createKnightSpriteRenderer
} from "../web/knight-sprites.mjs";

const base = new URL("../",import.meta.url);
const frames=[];
const loaded=[];
class FakeImage{
  set src(url) {
    const file=new URL(url).pathname.split("/").at(-1);
    loaded.push(file);
    this.naturalWidth=file==="silver_kick.webp" ? 1280 : file==="silver_idle.webp" ? 640 : 0;
    this.naturalHeight=1280;
    if(this.naturalWidth)this.onload?.();
    else this.onerror?.();
  }
}
const ctx={
  save(){},restore(){},rotate(){},beginPath(){},ellipse(){},fill(){},
  drawImage(...args){frames.push(args);}
};
const actor=(netId,action)=>({netId,x:20,y:30,facing:Math.PI/2,action});

test("no globally active source kick: existing Knight/Combat fallback stays the default",()=>{
  const kick=[COMBAT_ACTION.kickWindup,COMBAT_ACTION.kickActive,COMBAT_ACTION.kickRecovery];
  for(const action of kick) {
    assert.equal(knightClip(action,"player"),null);
    assert.equal(knightClip(action,"npc",0,false,true),null);
    assert.equal(knightClip(action,"player",0,false,true),"silver_kick");
    assert.equal(knightClip(action,"fake-user",0,false,true),null);
  }
  loaded.length=0;frames.length=0;
  const r=createKnightSpriteRenderer({ImageCtor:FakeImage,assetBase:new URL("https://test.invalid/assets/")});
  assert.ok(!loaded.includes("silver_kick.webp"),"default renderer must not even fetch candidate atlas");
  assert.equal(r.draw(ctx,actor(7,COMBAT_ACTION.kickActive),{actorKind:"player",nowMs:1000}),false);
  assert.equal(frames.length,0);
});
test("kick frames never jump into active/contact/recovery without confirmed action",()=>{
  assert.equal(KNIGHT_KICK_SOURCE_FRAMES,8);
  assert.deepEqual(Object.values(KNIGHT_KICK_SOURCE_PHASE_MS),[90,70,220]);
  for(const t of [0,40,89.9,90,300,3000]) {
    const f=knightKickSourceFrame(COMBAT_ACTION.kickWindup,t);
    assert.ok(f>=0&&f<=2,"windup cannot leak contact");
  }
  for(const t of [0,35,69.9,70,2000]) {
    const f=knightKickSourceFrame(COMBAT_ACTION.kickActive,t);
    assert.ok(f>=3&&f<=4,"only observed active may depict a contact pose");
  }
  for(const t of [0,50,219.9,220,5000]) {
    const f=knightKickSourceFrame(COMBAT_ACTION.kickRecovery,t);
    assert.ok(f>=5&&f<=7,"recovery frames cannot trigger impact");
  }
  for(const v of [NaN,Infinity,-Infinity])assert.equal(knightKickSourceFrame(COMBAT_ACTION.kickActive,v),null);
  assert.equal(knightKickSourceFrame(COMBAT_ACTION.idle,50),null);
  assert.equal(knightKickSourceFrame(999,50),null);
});
test("mock local and remote player roles share the same original-source derived aligned atlas and phase-gated frames",()=>{
  loaded.length=0;frames.length=0;
  const r=createKnightSpriteRenderer({ImageCtor:FakeImage,
    sourceKickPreview:true,assetBase:new URL("https://test.invalid/assets/")});
  assert.ok(loaded.includes("silver_kick.webp"));
  assert.ok(r.loaded().includes("silver_kick"));
  assert.equal(r.draw(ctx,actor(7,COMBAT_ACTION.idle),{actorKind:"player",nowMs:900}),true);
  const draw=(fighter,opts)=> {
    const result=r.draw(ctx,fighter,opts);
    return {result,x:frames.at(-1)?.[1]};
  };
  const local=actor(7,COMBAT_ACTION.kickWindup);
  let x=draw(local,{actorKind:"player",nowMs:1000});assert.deepEqual(x,{result:true,x:0});
  assert.equal(draw(local,{actorKind:"player",nowMs:1089}).x,2*KNIGHT_FRAME_PX);
  assert.equal(draw(local,{actorKind:"player",nowMs:1140}).x,2*KNIGHT_FRAME_PX,
    "late/no packet cannot synthesize the server's active state");
  local.action=COMBAT_ACTION.kickActive;
  assert.equal(draw(local,{actorKind:"player",nowMs:1160}).x,3*KNIGHT_FRAME_PX);
  assert.equal(draw(local,{actorKind:"player",nowMs:1210}).x,4*KNIGHT_FRAME_PX);
  local.action=COMBAT_ACTION.kickRecovery;
  assert.equal(draw(local,{actorKind:"player",nowMs:1230}).x,5*KNIGHT_FRAME_PX);
  assert.equal(draw(local,{actorKind:"player",nowMs:1500}).x,7*KNIGHT_FRAME_PX);
  local.action=COMBAT_ACTION.dead;
  const before=frames.length;
  assert.equal(r.draw(ctx,local,{actorKind:"player",nowMs:1515}),false);
  assert.equal(frames.length,before);
  local.action=COMBAT_ACTION.kickWindup;
  assert.equal(draw(local,{actorKind:"player",nowMs:1800}).x,0,
    "new confirmed separate kick must start at frame zero");
  const remote=actor(44,COMBAT_ACTION.kickActive);
  assert.equal(draw(remote,{actorKind:"player",remote:true,nowMs:2200}).x,3*KNIGHT_FRAME_PX);
  assert.equal(draw(remote,{actorKind:"player",remote:true,nowMs:2250}).x,4*KNIGHT_FRAME_PX);
  assert.equal(r.draw(ctx,actor(50,COMBAT_ACTION.kickActive),{
    actorKind:"npc",remote:true,nowMs:2210}),false,
    "remote authenticated human cannot be misclassified as T1 NPC");
});
test("opt-in atlas uniformly scales original approved source to match existing Knight idle, no geometry change",()=>{
  const load=p=>readFileSync(new URL(p,base));
  const a=load("web/assets/knights/silver_kick.webp");
  const b=load("docs/art/silver-spartan-high-forward-p0/silver_spartan_high_forward_p0.webp");
  const hash=x=>createHash("sha256").update(x).digest("hex");
  const alignment=JSON.parse(load("docs/art/silver-spartan-high-forward-p0/game_scale_alignment.json").toString("utf8"));
  assert.equal(hash(b),alignment.sourceSha256,"owner-approved source remains unchanged");
  assert.equal(hash(a),alignment.alignedSha256,"only opt-in presented bitmap is re-packed");
  assert.notEqual(hash(a),hash(b),"only viewport packing changes, not the source file");
  assert.equal(alignment.uniformScale,1.3);
  assert.equal(alignment.sourceUnmodified,true);
  assert.equal(alignment.serverHitboxesUnchanged,true);
  assert.equal(alignment.actorWorldRootUnchanged,true);
  assert.equal(alignment.notLiveMultiplayerProof,true);
  assert.equal(alignment.realFloorContactVerified,false);
  assert.equal(alignment.totalFrames,64);
  assert.ok(alignment.averageAlignedKnightHeightPx>alignment.averageSourceKnightHeightPx*1.25);
  assert.ok(Math.abs(alignment.averageAlignedKnightHeightPx-
    alignment.averageExistingIdleKnightHeightPx)<12);
  assert.equal(a.toString("ascii",0,4),"RIFF");
  const client=load("web/online-game.mjs").toString("utf8");
  assert.match(client,/knightQuery\.get\("knights"\) === "1"/);
  assert.match(client,/sourceKickPreview: knightQuery\.get\("knightKickSource"\) === "1"/);
  assert.ok(client.indexOf('sourceKickPreview:')>client.indexOf('knightQuery.get("knights") === "1"'));
  assert.doesNotMatch(client,/input\.kick\s*\?\s*"silver_kick"/);
});
