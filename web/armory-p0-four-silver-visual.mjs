import {createAuthoredWorldRenderer} from "/__world521__/src/browser/authored-world-renderer.mjs";
import {WORLD_ALPHA_ARMORY,WORLD_ALPHA_ARMORY_VERSION,validateWorldAlphaArmoryLayout} from "/__world521__/src/world/alpha-armory.mjs";
import {MAP_IDS,getAuthoredMap} from "/__world521__/src/world/authored-maps.mjs";
import {knightPresentationRect,spriteAtlasRect,KNIGHT_CLIPS,KNIGHT_PRESENTATION_SCALE} from "/__knight326__/web/knight-sprites.mjs";
import {projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {createWorld493RackArtPlan} from "../src/browser/armory-world493-visual-bridge.mjs";
import {paintArmoryRackPresentedFrame} from "../src/browser/armory-rack-presented-frame.mjs";
import {createArmorySwordAlphaSampler} from "../src/browser/armory-sword-alpha-sampler.mjs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d");
const status=document.getElementById("status");
const CAMERA={x:3800,y:4038},VIEW=640,ZOOM=.84;
let result=null;
window.__p0FourSilverSourceReview=()=>result;
try{
 if(!validateWorldAlphaArmoryLayout())throw Error("World source invalid");
 const load=async src=>{const i=new Image();i.src=src;await i.decode();return i;};
 const [rackImage,swordImage,silverImage]=await Promise.all([
  load(ARMORY_RACK_ART.rackSource),load(ARMORY_RACK_ART.swordSource),
  load("/__knight326__/web/assets/knights/silver_idle.webp")
 ]);
 if(silverImage.naturalWidth!==KNIGHT_CLIPS.silver_idle*160||
    silverImage.naturalHeight!==8*160)
   throw Error("Original 3A Silver atlas dimensions changed");
 const originalWorld=createAuthoredWorldRenderer({cacheCap:24,buildLimit:8});
 ctx.save();ctx.fillStyle="#475f4b";ctx.fillRect(0,0,640,640);
 ctx.translate(320,320);ctx.scale(ZOOM,ZOOM);ctx.translate(-320,-320);
 originalWorld.draw(ctx,MAP_IDS.overworld,CAMERA,VIEW,VIEW,ZOOM);
 ctx.restore();
 const items=WORLD_ALPHA_ARMORY.rackSockets.map((s,i)=>({
  itemId:"ART-ONLY-NO-SERVER-"+i,
  socketId:s.socketId,zoneId:WORLD_ALPHA_ARMORY.mapId,
  visualKind:"sword",location:"rack",revision:1
 }));
 const plan=createWorld493RackArtPlan({worldArmory:WORLD_ALPHA_ARMORY,
  authoredMap:getAuthoredMap(MAP_IDS.overworld),
  layoutVersion:WORLD_ALPHA_ARMORY_VERSION,
  committedWorldItems:items,camera:CAMERA});
 const sampler=createArmorySwordAlphaSampler(swordImage);
 const paint=paintArmoryRackPresentedFrame({ctx,plan,rackImage,swordImage,
  alphaSampler:sampler,frameId:1});
 const srcKnight=spriteAtlasRect(Math.PI/2,0,KNIGHT_CLIPS.silver_idle);
 const knightOffset=knightPresentationRect(false,KNIGHT_PRESENTATION_SCALE);
 const knights=WORLD_ALPHA_ARMORY.rackSockets.map((s,i)=>{
  const p=projectArenaPoint(s.approach.x,s.approach.y,CAMERA.x,CAMERA.y,640,640,ZOOM);
  return Object.freeze({id:"ILLUSTRATIVE-SILVER-"+i,sourceSocket:s.socketId,
   sourceWorldXY:[s.approach.x,s.approach.y],x:p.x+knightOffset.x,
   y:p.y+knightOffset.y,width:knightOffset.width,height:knightOffset.height});
 });
 const mask=draw=>{
  const m=document.createElement("canvas");m.width=m.height=640;
  const c=m.getContext("2d",{willReadFrequently:true});
  draw(c);
  const rgba=c.getImageData(0,0,640,640).data;
  const a=new Uint8Array(640*640);
  let covered=0;
  for(let i=0;i<a.length;i++){a[i]=rgba[i*4+3]>=64?1:0;if(a[i])covered++;}
  return{a,covered};
 };
 const knightMasks=knights.map(k=>mask(c=>
  c.drawImage(silverImage,srcKnight.x,srcKnight.y,
   srcKnight.width,srcKnight.height,k.x,k.y,k.width,k.height)));
 const swordMasks=plan.swords.map(s=>mask(c=>
  c.drawImage(swordImage,s.x,s.y,s.width,s.height)));
 const overlaps=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]&&b[i])n++;return n;};
 const silverPairIntersections=[];
 for(let i=0;i<knights.length;i++)for(let j=i+1;j<knights.length;j++){
  silverPairIntersections.push({pair:[i,j],
   opaqueOverlapPixels:overlaps(knightMasks[i].a,knightMasks[j].a)});
 }
 const swordVisibility=swordMasks.map((s,i)=>{
  let covered=0;
  for(let p=0;p<s.a.length;p++)if(s.a[p] && knightMasks.some(k=>k.a[p]))covered++;
  return{id:plan.swords[i].id,sourceCandidateAlphaPixels:s.covered,
    obscuredByAnySilverOpaquePixels:covered,
    stillUnobscuredCandidatePixels:s.covered-covered};
 });
 // Draw all human illustrative sprites as Silver, NEVER incorrectly choose
 // original T1 NPC just because another human actor is remote.
 for(const k of knights)
  ctx.drawImage(silverImage,srcKnight.x,srcKnight.y,160,160,
   k.x,k.y,k.width,k.height);
 const totalOverlaps=silverPairIntersections.reduce((n,p)=>n+p.opaqueOverlapPixels,0);
 result={ready:true,sourceWorldHead:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
  originalSilverSourceHead:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
  actualSourceWorldRenderer:true,originalSourceSilverAtlas:true,originalBlenderSwords:true,
  sourceKnightsCount:4,sourceSwordCount:paint.drawnSwordCount,
  actualWorldApproaches:knights.map(k=>k.sourceWorldXY),
  sourceKnightScale:KNIGHT_PRESENTATION_SCALE,
  screenKnightRects:knights,
  silverPairIntersections,
  totalPairwiseSilverOpaqueOverlapPixels:totalOverlaps,
  swordVisibility,worldTilesCached:originalWorld.stats.cached,
  swordUiPointerArbitrationIntegrated:false,serverPlayersAuthenticated:false,
  serverItemPresenceAuthenticated:false,realFourPlayerGameplay:false,
  productionApproved:false};
 status.textContent="Source-only QA: "+totalOverlaps+
 " actor/actor pairwise opaque overlap pixels. Sword coverage measured per sprite. "+
 "No real game actors/items/Combat/occlusion authorization.";
}catch(e){status.textContent="Fail-closed: "+e.message;console.error(e);}
