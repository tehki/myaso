import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createBlacksmithRackVisualPlan,ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
import {ARMORY_SWORD_ALPHA_SPEC} from "../src/browser/armory-sword-alpha-sampler.mjs";
import {paintArmoryRackPresentedFrame,ARMORY_PRESENTED_FRAME_CONTRACT} from "../src/browser/armory-rack-presented-frame.mjs";
const building={id:"smith",x:3710,y:3850,w:182,h:162};
const rack={buildingId:"smith",zoneId:"moonvale-overworld",version:"source-world493-v1",
 origin:{x:3800,y:4038},sockets:[3740,3780,3820,3860].map((x,i)=>({
 id:"greyhaven-rack-"+(i+1),worldX:x,worldY:4038
 }))};
const items=rack.sockets.map((s,i)=>({
 itemId:"CORE-EXTERNAL-"+i,socketId:s.id,visualKind:"sword",
 location:"rack",zoneId:rack.zoneId,revision:2
}));
const plan=(worldItems=items)=>createBlacksmithRackVisualPlan({
 building,rack,committedWorldItems:worldItems,camera:{x:3800,y:4038}
});
const image=(src,w,h)=>({complete:true,naturalWidth:w,naturalHeight:h,
 currentSrc:"http://localhost"+src});
const sources={
 rackImage:image(ARMORY_RACK_ART.rackSource,240,166),
 swordImage:image(ARMORY_RACK_ART.swordSource,42,115),
 alphaSampler:Object.freeze({
  asset:ARMORY_SWORD_ALPHA_SPEC.source,
  width:42,height:115,presentationOnly:true,sampleAlpha:()=>255
 })
};
const makeCtx=(failAt=-1)=>{
 const calls=[],ctx={calls,save(){calls.push("save");},
 restore(){calls.push("restore");},
 drawImage(sprite,x,y,w,h){
  calls.push({src:sprite.currentSrc,x,y,w,h});
  if(calls.filter(x=>typeof x==="object").length===failAt)
   throw Error("Simulated Canvas failure");
 }};
 return ctx;
};

test("P0 painter draws rack FIRST and exactly four separately World-present sword images",()=>{
 const ctx=makeCtx(),p=plan();
 const result=paintArmoryRackPresentedFrame({ctx,plan:p,frameId:88,...sources});
 assert.equal(result.frameId,88);
 assert.equal(result.lastPresentedFrameId,88);
 assert.equal(result.plan,p);
 assert.equal(result.drawnRackCount,1);
 assert.equal(result.drawnSwordCount,4);
 assert.equal(result.sampleAlpha,sources.alphaSampler.sampleAlpha);
 assert.equal(result.presentedCanvasCallCompleted,true);
 assert.equal(result.actualGameFrameCompleted,false);
 assert.equal(result.serverItemsAuthenticatedByPainter,false);
 assert.equal(result.validCombatTargetAuthorized,false);
 assert.equal(result.playerActorDepthResolved,false);
 assert.equal(result.productionApproved,false);
 assert.ok(Object.isFrozen(result));
 assert.deepEqual(ctx.calls[0],"save");
 assert.deepEqual(ctx.calls.at(-1),"restore");
 assert.equal(ctx.calls.length,7);
 assert.equal(ctx.calls[1].src,sources.rackImage.currentSrc);
 for(let i=0;i<4;i++){
  const rect=ctx.calls[i+2];
  assert.equal(rect.src,sources.swordImage.currentSrc);
  assert.deepEqual([rect.x,rect.y,rect.w,rect.h],
   [p.swords[i].x,p.swords[i].y,42,115]);
 }
 assert.equal(ARMORY_PRESENTED_FRAME_CONTRACT.rackFirst,true);
 assert.equal(ARMORY_PRESENTED_FRAME_CONTRACT.productionApproved,false);
});

test("P0 presenter paints an EMPTY authentic rack with zero swords and no speculative equip",()=>{
 const ctx=makeCtx(),p=plan([]);
 const result=paintArmoryRackPresentedFrame({ctx,plan:p,frameId:0,...sources});
 assert.equal(result.drawnRackCount,1);
 assert.equal(result.drawnSwordCount,0);
 assert.equal(result.plan.count,0);
 assert.equal(ctx.calls.filter(x=>typeof x==="object").length,1);
 assert.equal(result.serverItemsAuthenticatedByPainter,false);
});

test("P0 invalid context, images, state, reused source IDs and resized swords reject before painting",()=>{
 const p=plan();
 for(const bad of [
  {frameId:-1},{frameId:2.5},{frameId:NaN},
  {rackImage:{...sources.rackImage,naturalWidth:241}},
  {swordImage:{...sources.swordImage,complete:false}},
  {swordImage:{...sources.swordImage,currentSrc:"https://third.party/sword.webp"}},
  {rackImage:{...sources.rackImage,currentSrc:"http://localhost/assets/environment/greyhaven/armory-p0/armory_rack.webp?cache=1"}},
  {alphaSampler:{...sources.alphaSampler,asset:"/other.webp"}},
  {alphaSampler:{...sources.alphaSampler,presentationOnly:false}},
  {ctx:{drawImage(){}}},
  {plan:{...p,serverOwnershipUnchanged:false}},
  {plan:{...p,canApprovePickup:true}},
  {plan:{...p,worldSocketCount:3}},
  {plan:{...p,swords:[p.swords[0],p.swords[0]],count:2}},
  {plan:{...p,swords:[{...p.swords[0],width:48},...p.swords.slice(1)]}},
  {plan:{...p,swords:[{...p.swords[0],asset:"/fake.webp"},...p.swords.slice(1)]}},
 ]) {
  const ctx=makeCtx();
  assert.throws(()=>paintArmoryRackPresentedFrame({
   ctx,plan:p,frameId:4,...sources,...bad}),"Must reject "+Object.keys(bad)[0]);
  if(bad.ctx===undefined)assert.equal(ctx.calls.length,0);
 }
});

test("P0 failed Canvas draw never advertises presented frame or leaves save unbalanced",()=>{
 const p=plan();
 for(const failAt of [1,2,3,4,5]){
  const ctx=makeCtx(failAt);
  assert.throws(()=>paintArmoryRackPresentedFrame({
   ctx,plan:p,frameId:31,...sources
  }),/Simulated Canvas failure/);
  assert.equal(ctx.calls[0],"save");
  assert.equal(ctx.calls.at(-1),"restore");
 }
});

test("P0 source page reuses presenter result as the last-painted UI gesture scene",()=>{
 const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
 const browser=read("web/armory-p0-world493-ui-review.mjs");
 const harness=read("tools/art/verify_armory_world493_ui503.mjs");
 assert.match(browser,/paintArmoryRackPresentedFrame/);
 assert.match(browser,/scene=presented/);
 assert.doesNotMatch(browser,/scene=\{plan,sampleAlpha:sourceAlpha/);
 assert.doesNotMatch(browser,/ctx\.drawImage\(rack,plan\.rack/);
 assert.match(harness,/armory-rack-presented-frame\.mjs/);
 assert.match(harness,/drawnSwordCount/);
 assert.doesNotMatch(read("web/online-game.mjs"),/paintArmoryRackPresentedFrame/);
});
