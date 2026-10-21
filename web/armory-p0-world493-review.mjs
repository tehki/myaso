import {createAuthoredWorldRenderer} from "/__world493__/src/browser/authored-world-renderer.mjs";
import {WORLD_ALPHA_ARMORY,WORLD_ALPHA_ARMORY_VERSION,validateWorldAlphaArmoryLayout} from "/__world493__/src/world/alpha-armory.mjs";
import {MAP_IDS,getAuthoredMap} from "/__world493__/src/world/authored-maps.mjs";
import {createWorld493RackArtPlan} from "../src/browser/armory-world493-visual-bridge.mjs";
import {hitTestVisibleSwordAlpha,ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d",{willReadFrequently:true});
const status=document.getElementById("status");
let state;
window.__world493ArmoryReview=()=>state;
try {
 if(!validateWorldAlphaArmoryLayout())throw Error("World source layout invalid");
 const map=getAuthoredMap(MAP_IDS.overworld);
 const camera={x:3800,y:4038},world=createAuthoredWorldRenderer({buildLimit:3,cacheCap:24});
 const assets=await Promise.all([ARMORY_RACK_ART.rackSource,ARMORY_RACK_ART.swordSource].map(async url=>{
  const i=new Image();i.src=url;await i.decode();return i;
 }));
 const [rackImg,swordImg]=assets;
 if(rackImg.width!==240||swordImg.width!==42||swordImg.height!==115)throw Error("3B original WebP mismatch");
 const alpha=document.createElement("canvas");alpha.width=42;alpha.height=115;
 const alphaCtx=alpha.getContext("2d",{willReadFrequently:true});
 alphaCtx.drawImage(swordImg,0,0);
 const pixels=alphaCtx.getImageData(0,0,42,115).data;
 const sample=(asset,x,y)=>asset===ARMORY_RACK_ART.swordSource&&x>=0&&x<42&&y>=0&&y<115?pixels[4*(42*y+x)+3]:0;
 // Deliberately synthetic art-only item IDs. REAL ITEMS MUST COME FROM CORE.
 const fakeItems=WORLD_ALPHA_ARMORY.rackSockets.map((s,i)=>({
  itemId:"ART-ONLY-NO-SERVER-"+i,socketId:s.socketId,visualKind:"sword",
  location:"rack",zoneId:WORLD_ALPHA_ARMORY.mapId,revision:0
 }));
 let plan,lastCandidate=null,clicks=0;
 const draw=()=>{
  ctx.fillStyle="#3c5548";ctx.fillRect(0,0,640,640);
  ctx.save();ctx.translate(320,320);ctx.scale(.84,.84);ctx.translate(-320,-320);
  world.draw(ctx,MAP_IDS.overworld,camera,640,640,.84);ctx.restore();
  plan=createWorld493RackArtPlan({worldArmory:WORLD_ALPHA_ARMORY,authoredMap:map,
   layoutVersion:WORLD_ALPHA_ARMORY_VERSION,committedWorldItems:fakeItems,camera});
  ctx.drawImage(rackImg,plan.rack.x,plan.rack.y,plan.rack.width,plan.rack.height);
  for(const v of plan.swords)ctx.drawImage(swordImg,v.x,v.y,v.width,v.height);
  state={ready:true,worldSourceVersion:WORLD_ALPHA_ARMORY_VERSION,
   worldLayoutId:WORLD_ALPHA_ARMORY.id,officialSocketIds:WORLD_ALPHA_ARMORY.rackSockets.map(x=>x.socketId),
   officialSwordAnchors:WORLD_ALPHA_ARMORY.rackSockets.map(x=>[x.x,x.y]),
   realWorldTerrainRenderer:true,renderedSwords:plan.count,
   renderedWorldItemIds:plan.swords.map(x=>x.id),
   swordRects:plan.swords.map(x=>({id:x.id,x:x.x,y:x.y,width:x.width,height:x.height})),
   rackRect:{x:plan.rack.x,y:plan.rack.y,width:plan.rack.width,height:plan.rack.height},
   cachedTiles:world.stats.cached,createdTiles:world.stats.created,
   clicks,lastCandidate,authenticatedServerItems:false,worldCollisionApproved:false,
   playerInputIntegrated:false,pickupCommitted:false,productionApproved:false};
 };
 const point=e=>{let b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*640/b.width,
  y:(e.clientY-b.top)*640/b.height};};
 canvas.addEventListener("click",e=>{
  const candidate=hitTestVisibleSwordAlpha(plan,point(e),sample);
  lastCandidate=candidate?.itemId??null;if(candidate)clicks++;
  status.textContent=candidate?"Visible sword pixel, ART ONLY: "+candidate.itemId:
   "No alpha-covered sword pixel; cannot select a rack/counter or transparent bounds.";
  draw();
 });
 for(let i=0;i<6;i++)draw();
 status.dataset.ready="1";
 status.textContent="Pinned World #493 sockets + 3B Blender art. Source art test only.";
}catch(error){status.textContent="Blocked: "+error.message;console.error(error);}
