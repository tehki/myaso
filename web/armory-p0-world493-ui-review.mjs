import {createAuthoredWorldRenderer} from "/__world493__/src/browser/authored-world-renderer.mjs";
import {WORLD_ALPHA_ARMORY,WORLD_ALPHA_ARMORY_VERSION,validateWorldAlphaArmoryLayout} from "/__world493__/src/world/alpha-armory.mjs";
import {MAP_IDS,getAuthoredMap} from "/__world493__/src/world/authored-maps.mjs";
import {createWorld493RackArtPlan} from "../src/browser/armory-world493-visual-bridge.mjs";
import {hitTestVisibleSwordAlpha,ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
import {createArmorySwordAlphaSampler} from "../src/browser/armory-sword-alpha-sampler.mjs";
import {createAlphaSwordGestureGate} from "/__ui503__/src/browser/alpha-sword-gesture.mjs";
import {swordPointerCanvasPoint} from "/__ui503__/src/browser/sword-canvas-pointer.mjs";
const canvas=document.getElementById("scene"),ctx=canvas.getContext("2d");
const status=document.getElementById("status");
const worldCamera={x:3800,y:4038},uiGate=createAlphaSwordGestureGate(hitTestVisibleSwordAlpha);
let state=null,scene=null,items=[],frame=0,visualIntents=[],combatFallback=0,cancelled=0,events=[];
window.__p0WorldUiReview=()=>state;
window.__p0WorldUiRepaint=()=>repaint();
window.__p0WorldUiAdversarial=()=>adversarial();
/** Visual-only source alpha inquiry. Not a canonical server pickup target. */
window.__p0WorldUiPixelCandidate=(x,y)=>
 scene?hitTestVisibleSwordAlpha(scene.plan,{x,y},sourceAlpha)?.itemId??null:null;
window.__p0WorldUiSourceMaskOverlap=()=>{
 if(!scene||!sourceAlpha)return null;
 const sprites=scene.plan.swords;
 const sources=[];
 for(const sword of sprites){
  const covered=new Set();
  // Use exactly the integer-backed source-coordinate lookup contract, not
  // arbitrary canvas bounding-box overlap as a click proxy.
  const left=Math.floor(sword.x),top=Math.floor(sword.y);
  for(let yy=top;yy<top+sword.height+2;yy++)
   for(let xx=left;xx<left+sword.width+2;xx++){
    const sx=Math.floor(xx+.5-sword.x),sy=Math.floor(yy+.5-sword.y);
    if(sourceAlpha(sword.asset,sx,sy)>=64)
     covered.add(xx+","+yy);
   }
  sources.push(covered);
 }
 const pairs=[];
 for(let i=0;i<sources.length;i++)for(let j=i+1;j<sources.length;j++){
  let intersection=0;
  for(const k of sources[i])if(sources[j].has(k))intersection++;
  pairs.push({ids:[sprites[i].id,sprites[j].id],sourceMaskOverlapPixels:intersection});
 }
 return {count:sprites.length,pairs,maxOverlap:Math.max(0,...pairs.map(x=>x.sourceMaskOverlapPixels)),
  sourceMaskOnly:true,liveRenderedGameOcclusionValidated:false};
};
function snapshot(extra={}){
 const p=scene?.plan;
 state={ready:!!scene,worldHead:"07060f981b8a1dac89184b621b6893dd970a08ae",
 uiHead:"8d500d8ddeb4058f15dbc704bf78d685d1ca31ef",
 originalWorldImported:true,originalUiGestureImported:true,
 sourceWorldSocketPositions:WORLD_ALPHA_ARMORY.rackSockets.map(x=>[x.x,x.y]),
 lastPresentedFrameId:scene?.lastPresentedFrameId,frameId:scene?.frameId,
 visibleIds:p?.swords.map(s=>s.id)??[],swordRects:p?.swords.map(s=>({
  id:s.id,x:s.x,y:s.y,width:s.width,height:s.height,socketId:s.socketId,revision:s.revision
 }))??[],swordCount:p?.count??0,
 visualIntents:[...visualIntents],combatFallback,cancelled,
 browserPointerEvents:[...events],actualServerEvents:0,
 serverAuthenticatedItems:false,serverOwnedItemIds:false,
 combatHandlerActuallyCalled:false,gameClientIntegrated:false,
 productionApproved:false,...extra};
 return state;
}
let drawing=false,sourceAlpha=null,originalWorld=null;
function repaint(){
 if(!originalWorld||!sourceAlpha)return null;
 const map=getAuthoredMap(MAP_IDS.overworld);
 const plan=createWorld493RackArtPlan({worldArmory:WORLD_ALPHA_ARMORY,
  authoredMap:map,layoutVersion:WORLD_ALPHA_ARMORY_VERSION,
  committedWorldItems:items,camera:worldCamera});
 const w=originalWorld, rack=window.__rackImage,sword=window.__swordImage;
 ctx.fillStyle="#3a5747";ctx.fillRect(0,0,640,640);
 ctx.save();ctx.translate(320,320);ctx.scale(.84,.84);ctx.translate(-320,-320);
 w.draw(ctx,MAP_IDS.overworld,worldCamera,640,640,.84);ctx.restore();
 ctx.drawImage(rack,plan.rack.x,plan.rack.y);
 for(const v of plan.swords)ctx.drawImage(sword,v.x,v.y);
 frame++;
 scene={plan,sampleAlpha:sourceAlpha,frameId:frame,lastPresentedFrameId:frame};
 snapshot({cachedTiles:w.stats.cached,sourceWorldSocketPositions:WORLD_ALPHA_ARMORY.rackSockets.map(x=>[x.x,x.y])});
 return scene;
}
function toPoint(e){return swordPointerCanvasPoint(e,canvas);}
function adversarial(){
 const original=scene;
 if(!original||original.plan.swords.length===0)return{ready:false};
 const s=original.plan.swords[0],inside={x:s.x+20.5,y:s.y+13.5},
  empty={x:s.x+.5,y:s.y+.5};
 const fake=(p,alpha=255,sourcePixel={x:20,y:13})=>({
  itemId:s.id,socketId:s.socketId,revision:s.revision,
  alpha,sourcePixel,visualCandidateOnly:true,serverPickupCommitted:false
 });
 const badOutside=createAlphaSwordGestureGate(()=>fake());
 const outside=badOutside.down({button:0,pointerId:100,x:-12,y:inside.y},original);
 const badMismatch=createAlphaSwordGestureGate(()=>fake(inside,255,{x:0,y:0}));
 const mismatch=badMismatch.down({button:0,pointerId:101,x:inside.x,y:inside.y},original);
 const badTransparent=createAlphaSwordGestureGate(()=>fake(empty,255,{x:0,y:0}));
 const transparent=badTransparent.down({button:0,pointerId:102,x:empty.x,y:empty.y},original);
 const stale=createAlphaSwordGestureGate(hitTestVisibleSwordAlpha);
 const mismatchedFrame={...original,frameId:original.frameId+1};
 const frame=stale.down({button:0,pointerId:103,x:inside.x,y:inside.y},mismatchedFrame);
 return{outside,mismatch,transparent,frame,sourceTransparentAlpha:sourceAlpha(s.asset,0,0)};
}
try{
 if(!validateWorldAlphaArmoryLayout())throw Error("World493 layout failed");
 const load=async path=>{const im=new Image();im.src=path;await im.decode();return im;};
 const [rack,sword]=await Promise.all([load(ARMORY_RACK_ART.rackSource),load(ARMORY_RACK_ART.swordSource)]);
 if(rack.width!==240||rack.height!==166||sword.width!==42||sword.height!==115)
  throw Error("Original Blender assets do not match");
 window.__rackImage=rack;window.__swordImage=sword;
 const decoder=createArmorySwordAlphaSampler(sword);
 sourceAlpha=decoder.sampleAlpha;
 window.__alphaSamplerInfo=()=>({visiblePixels:decoder.visiblePixels,
  clickablePixels:decoder.clickablePixels,stableSourcePixel:decoder.stableSourcePixel,
  sourceShaExpected:decoder.sourceShaExpected,
  alphaOpaquePixel:sourceAlpha(ARMORY_RACK_ART.swordSource,20,13),
  alphaTransparentPixel:sourceAlpha(ARMORY_RACK_ART.swordSource,0,0),
  productionApproved:decoder.productionApproved});
 originalWorld=createAuthoredWorldRenderer({buildLimit:3,cacheCap:24});
 items=WORLD_ALPHA_ARMORY.rackSockets.map((s,i)=>({
  itemId:"ART-ONLY-NO-SERVER-"+i,socketId:s.socketId,
  zoneId:WORLD_ALPHA_ARMORY.mapId,visualKind:"sword",location:"rack",revision:0
 }));
 for(let i=0;i<7;i++)repaint();
 function eventPoint(e){const p=toPoint(e);return p;}
 canvas.addEventListener("pointerdown",e=>{
  const p=eventPoint(e);events.push("down:"+e.pointerType+":"+e.pointerId);
  if(e.button!==0)return;
  const choice=p?uiGate.down({button:e.button,pointerId:e.pointerId,x:p.x,y:p.y},scene):
   {handled:false,itemId:null};
  if(!choice.handled)combatFallback++; // simulated ONLY, NO real Combat call
  snapshot({downHandled:choice.handled});
 });
 canvas.addEventListener("pointerup",e=>{
  const p=eventPoint(e);events.push("up:"+e.pointerType+":"+e.pointerId);
  if(e.button!==0)return;
  const choice=p?uiGate.up({button:e.button,pointerId:e.pointerId,x:p.x,y:p.y},scene):
   {handled:false,itemId:null};
  if(choice.handled&&choice.itemId)visualIntents.push(choice.itemId);
  else if(choice.handled)cancelled++;
  snapshot({upHandled:choice.handled,upCandidate:choice.itemId});
 });
 canvas.addEventListener("pointercancel",e=>{uiGate.cancel(e.pointerId);cancelled++;snapshot();});
 for(const k of ["blur","visibilitychange"])window.addEventListener(k,()=>{
  if(k==="blur"||document.visibilityState==="hidden"){uiGate.reset();snapshot();}
 });
 document.getElementById("revision").addEventListener("click",()=>{
  items=items.map((v,i)=>i===0?{...v,revision:v.revision+1}:v);
  repaint();
 });
 document.getElementById("remove").addEventListener("click",()=>{items=items.slice(1);repaint();});
 document.getElementById("restore").addEventListener("click",()=>{
  items=WORLD_ALPHA_ARMORY.rackSockets.map((s,i)=>({
   itemId:"ART-ONLY-NO-SERVER-"+i,socketId:s.socketId,
   zoneId:WORLD_ALPHA_ARMORY.mapId,visualKind:"sword",location:"rack",revision:0
  }));repaint();
 });
 snapshot();
 status.textContent="Pinned World+3B+UI sources, four TEST ONLY sword sprites. Native pointerdown/up monitored.";
}catch(e){status.textContent="QA failure: "+e.message;console.error(e);}
