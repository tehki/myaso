import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS,knightPresentationRect } from "../web/knight-sprites.mjs";
import { SILVER_MAINHAND_REVIEW,planSilverCommittedSword,
  drawSilverCommittedSword } from "../src/browser/silver-committed-mainhand-visual.mjs";

const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const anchors=JSON.parse(read("web/assets/knights/silver_hand_anchors_p0.json"));
const ACTOR="authoritative-player-42";
const valid=()=>({
  provenance:"core-items-committed-snapshot",actorKey:ACTOR,
  snapshotRevision:17,serverTick:818,
  mainHand:{slot:"MainHand",location:"equipped",visualKind:"sword",
    itemId:"ITEM-EXAMPLE-NOT-A-REAL-U128",ownerActorKey:ACTOR,
    revision:3,committedSequence:7}
});
const data=(snapshot=valid())=>({actorKind:"player",actorKey:ACTOR,
  equipmentSnapshot:snapshot,clip:"silver_idle",frame:0,direction:0,anchors});

test("3A only reuses exact original Graphics 3B Blender sword artwork",()=>{
 const sword=read("docs/art/silver-mainhand-review/armory_sword_original_3b.webp");
 assert.equal(sword.subarray(0,4).toString("ascii"),"RIFF");
 assert.equal(sword.subarray(8,12).toString("ascii"),"WEBP");
 assert.equal(createHash("sha256").update(sword).digest("hex"),
   SILVER_MAINHAND_REVIEW.swordSourceSha256);
 assert.equal(SILVER_MAINHAND_REVIEW.hasAuthoritativeItemStream,false);
 assert.equal(SILVER_MAINHAND_REVIEW.gameplayIntegrated,false);
 assert.equal(SILVER_MAINHAND_REVIEW.humanVisualApproved,false);
 assert.equal(SILVER_MAINHAND_REVIEW.altersDamageOrMovement,false);
 assert.equal(anchors.humanArtApproved,false);
 assert.equal(anchors.actualGameplayValidated,false);
});

test("unarmed, pending, predicted, mismatched or unknown actor never plans a held sword",()=>{
 const bad=[
 null,{}, {...valid(),mainHand:null},
 {...valid(),provenance:"client-click-prediction"},
 {...valid(),actorKey:"another"},
 {...valid(),snapshotRevision:-1}, {...valid(),serverTick:NaN},
 {...valid(),mainHand:{...valid().mainHand,location:"rack"}},
 {...valid(),mainHand:{...valid().mainHand,slot:"OffHand"}},
 {...valid(),mainHand:{...valid().mainHand,committedSequence:0}},
 {...valid(),mainHand:{...valid().mainHand,itemId:""}},
 {...valid(),mainHand:{...valid().mainHand,ownerActorKey:"another"}},
 {...valid(),mainHand:{...valid().mainHand,visualKind:"shield"}},
 ];
 assert.equal(planSilverCommittedSword({...data(),equipmentSnapshot:undefined}),null);
 for(const snapshot of bad){
  assert.equal(planSilverCommittedSword(data(snapshot)),null,
    "invalid/missing equipment must be invisible");
 }
 assert.equal(planSilverCommittedSword({...data(),actorKind:"npc"}),null);
 assert.equal(planSilverCommittedSword({...data(),actorKind:"remote"}),null);
 assert.equal(planSilverCommittedSword({...data(),actorKey:"another"}),null);
 assert.equal(planSilverCommittedSword({...data(),clip:"t1_attack"}),null);
 assert.equal(planSilverCommittedSword({...data(),clip:"silver_jump"}),null,
   "jump blade is not visually approved");
 assert.equal(planSilverCommittedSword({...data(),clip:"silver_roll"}),null,
   "rotating held sword floated beneath the roll body; visual QA hold");
 assert.equal(planSilverCommittedSword({...data(),clip:"unknown"}),null);
 assert.equal(planSilverCommittedSword({...data(),direction:-1}),null);
 assert.equal(planSilverCommittedSword({...data(),direction:8}),null);
 assert.equal(planSilverCommittedSword({...data(),frame:999}),null);
 assert.equal(planSilverCommittedSword({...data(),anchors:{}}),null);
 assert.equal(planSilverCommittedSword({...data(),equipmentSnapshot:{
  ...valid(),mainHand:{...valid().mainHand,itemId:"\u0000"}}}),null);
});
test("hand attachment covers exact 8 facings and all original Silver animation frames",()=>{
 let total=0;
 for(const clip of ["silver_idle","silver_walk","silver_sprint"]){
  for(let d=0;d<8;d++)for(let f=0;f<KNIGHT_CLIPS[clip];f++){
   const p=planSilverCommittedSword({...data(),clip,direction:d,frame:f});
   assert.ok(p,clip+" "+d+" "+f);
   assert.equal(p.asset,SILVER_MAINHAND_REVIEW.swordArt);
   assert.equal(p.itemId,"ITEM-EXAMPLE-NOT-A-REAL-U128");
   assert.equal(p.serverTick,818);
   assert.equal(p.authoritativeEquipmentNotValidatedHere,true);
   assert.equal(p.mayApprovePickup,false);
   assert.ok(p.width>=12&&p.width<=23);
   assert.ok(p.height>=32&&p.height<=65);
   assert.ok(Number.isFinite(p.wristX)&&Number.isFinite(p.wristY));
   assert.ok(Object.isFrozen(p));
   assert.ok(Object.isFrozen(p.swordPivot));
   const rect=knightPresentationRect(clip==="silver_roll",1.2);
   assert.equal(p.width,Math.round(rect.width*.16));
   total++;
  }
 }
 assert.equal(total,160);
});
test("draw is side-effect-free Canvas presentation and source-dimension fail-closed",()=>{
 const calls=[];
 const ctx={save(){calls.push("save")},restore(){calls.push("restore")},
  translate(...x){calls.push(["translate",...x])},
  rotate(v){calls.push(["rotate",v])},
  drawImage(...x){calls.push(["drawImage",...x])}};
 const plan=planSilverCommittedSword(data());
 assert.equal(drawSilverCommittedSword(ctx,{naturalWidth:42,naturalHeight:115},plan),true);
 assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==="drawImage").length,1);
 assert.equal(drawSilverCommittedSword(ctx,{naturalWidth:20,naturalHeight:115},plan),false);
 assert.equal(drawSilverCommittedSword(ctx,{naturalWidth:42,naturalHeight:115},null),false);
 assert.equal(calls.filter(x=>Array.isArray(x)&&x[0]==="drawImage").length,1);
});
