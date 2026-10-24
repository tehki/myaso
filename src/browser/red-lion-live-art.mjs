// Graphics 3B A2.32 opt-in live Greyhaven facade: immutable original Blender WebPs.
// World9 alone approves which authored placeholder can be suppressed.
// No item, movement, portal, collision, camera, combat or network authority.
import {createAuthoredWorldRenderer} from "./authored-world-renderer.mjs";
import {normalizeWorldBuildingReplacementIds,worldBuildingPresentation} from "../world/building-presentation.mjs";
import {MAP_IDS} from "../world/authored-maps.mjs";
// World and the live fighter painter each apply the one shared ARENA_VIEW_ZOOM transform.

export const ORIGINAL_RED_LION_ART=Object.freeze({
  day:Object.freeze({name:"red_lion_a232_day_ironwork.webp",sha256:"bdd2dcb2cb480f3631cbfe8cd4fa63ffee63699d8f17f33a520f8a3dcfd085fa",width:228,height:297}),
  dusk:Object.freeze({name:"red_lion_a232_dusk_ironwork.webp",sha256:"af2877c68dc88bd10baa90d1e32e6171fe9bc0e2ea537ebca1f2a9c767d2a54a",width:228,height:297}),
  roof:Object.freeze({name:"red_lion_a232_roof_unchanged.webp",sha256:"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1",width:238,height:197})
});
export const ORIGINAL_RED_LION_WORLD_ANCHOR=Object.freeze({x:4365,y:4075,facadeDx:-114,facadeDy:-269,roofDx:-119,roofDy:-283});
const imageUrl=name=>new URL("../../assets/environment/greyhaven/a232-review/"+name,import.meta.url);
const defaultDecode=data=>createImageBitmap(new Blob([data],{type:"image/webp"}));
const defaultCanvas=()=>document.createElement("canvas");
const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");
function validFrame(camera,w,h,z) {
 return Number.isFinite(camera?.x)&&Number.isFinite(camera?.y)&&
  Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&
  Number.isFinite(z)&&z>0&&z<=1;
}
function applyGameZoom(ctx,w,h,z) {
 ctx.translate(w/2,h/2);ctx.scale(z,z);ctx.translate(-w/2,-h/2);
}
export function drawScreenLayerInZoomedGame(ctx,canvas,w,h,z){
 if(!validFrame({x:0,y:0},w,h,z)||!canvas)throw new RangeError("real game Canvas viewport required");
 ctx.save();
 try{
  ctx.translate(w/2,h/2);ctx.scale(1/z,1/z);ctx.translate(-w/2,-h/2);
  ctx.drawImage(canvas,0,0);
 }finally{ctx.restore()}
}

// When the original building facade actually covers a world actor, its name,
// vitals and offscreen HUD marker must not appear THROUGH the opaque tavern.
// The original Combat arena or a failed detailed-art frame returns the EXACT
// unfiltered indicator behavior. This is presentation only; no actor state edit.
export function redLionActorHudVisible(art,redLionFrame,actor){
 return !redLionFrame || !art.behindFacade(actor);
}

// Deliberate default opt-in contract: no assets downloaded unless ?world=1&redlion=1.
// After a missing/corrupt original source, only the unchanged World renderer remains.
export function createOriginalRedLionLiveArt({
 fetchBytes=async url=>{
  const res=await fetch(url,{cache:"no-store"});
  if(!res.ok)throw new Error("Original Red Lion source unavailable: "+res.status);
  return res.arrayBuffer();
 },
 decode=defaultDecode, makeCanvas=defaultCanvas,
 makeWorld=createAuthoredWorldRenderer
}={}){
 let phase="idle",failure=null,promise=null,images=null,replacedWorld=null;
 const worldSurface=makeCanvas(),facadeSurface=makeCanvas();
 async function load(){
  if(promise)return promise;
  phase="loading";
  promise=(async()=>{
   try {
    const loaded={};
    for(const [key,meta] of Object.entries(ORIGINAL_RED_LION_ART)){
     const bytes=await fetchBytes(imageUrl(meta.name).href);
     if(!(bytes instanceof ArrayBuffer))
      throw new TypeError("Original source bytes must be an ArrayBuffer");
     if((await sha256(bytes))!==meta.sha256)
      throw new Error("Original "+key+" Red Lion source sha256 mismatch");
     const image=await decode(bytes,key);
     if(image?.width!==meta.width||image?.height!==meta.height)
      throw new Error("Original "+key+" Red Lion source dimensions mismatch");
     loaded[key]=image;
    }
    // An unapproved ID, missing World identity or graphics cache construction
    // error must never suppress original World Red Lion placeholder.
    normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["red-lion"]);
    const world=makeWorld({replacedBuildingIds:["red-lion"],
     worldReplacementValidator:normalizeWorldBuildingReplacementIds});
    if(!world?.draw||world.replacedBuildingIds?.[0]!=="red-lion")
     throw new Error("World 9 renderer refused canonical Red Lion replacement");
    images=Object.freeze(loaded);
    replacedWorld=world;
    phase="ready";
   }catch(error){failure=String(error);phase="failed";images=null;replacedWorld=null}
   return phase==="ready";
  })();
  return promise;
 }
 function prepare(camera,w,h,z,mood="day"){
  if(phase!=="ready")return null;
  if(!validFrame(camera,w,h,z))
   throw new RangeError("canonical Greyhaven source camera required");
  if(mood!=="day"&&mood!=="dusk")
   throw new RangeError("only original Blender day/dusk sources are supported");
  try{
   // Do not reset/reallocate both full-size Canvas backing stores every RAF
   // on an unchanged viewport. Still explicitly erase previous camera frames.
   for(const c of [worldSurface,facadeSurface]){
    if(c.width!==w)c.width=w;
    if(c.height!==h)c.height=h;
   }
   const worldCtx=worldSurface.getContext("2d",{alpha:false});
   const artCtx=facadeSurface.getContext("2d",{alpha:true});
   if(!worldCtx||!artCtx)throw new Error("Original 2D Canvas unavailable");
   worldCtx.clearRect(0,0,w,h);
   artCtx.clearRect(0,0,w,h);
   worldCtx.save();
   try{
    applyGameZoom(worldCtx,w,h,z);
    replacedWorld.draw(worldCtx,MAP_IDS.overworld,camera,w,h,z);
   }finally{worldCtx.restore()}
   artCtx.save();
   try{
    applyGameZoom(artCtx,w,h,z);
    // IMPORTANT: the artCtx already has the same WORLD-TO-CANVAS
    // ARENA_VIEW_ZOOM transform as the real live client. This anchor must
    // remain in UNZOOMED screen/world units here. Using projectArenaPoint()
    // (already zoomed) here would zoom camera displacement a SECOND time,
    // detaching the facade from World9 tiles whenever the camera moves.
    const loc={x:w/2+ORIGINAL_RED_LION_WORLD_ANCHOR.x-camera.x,
      y:h/2+ORIGINAL_RED_LION_WORLD_ANCHOR.y-camera.y};
    artCtx.drawImage(images[mood],loc.x+ORIGINAL_RED_LION_WORLD_ANCHOR.facadeDx,
      loc.y+ORIGINAL_RED_LION_WORLD_ANCHOR.facadeDy);
    artCtx.drawImage(images.roof,loc.x+ORIGINAL_RED_LION_WORLD_ANCHOR.roofDx,
      loc.y+ORIGINAL_RED_LION_WORLD_ANCHOR.roofDy);
   }finally{artCtx.restore()}
   // Both world and art were painted offscreen before any live Canvas write.
   return Object.freeze({world:worldSurface,facade:facadeSurface,visualOnly:true});
  }catch(error){
   phase="failed";failure=String(error);images=null;replacedWorld=null;
   return null; // next main frame paints the unchanged original World placeholder
  }
 }
 function behindFacade(actor){
  if(phase!=="ready"||!Number.isFinite(actor?.x)||!Number.isFinite(actor?.y))return false;
  const p=worldBuildingPresentation(MAP_IDS.overworld,"red-lion",[actor]);
  if(!p)return false;
  // Depth is World-owned; also require the genuine Red Lion footprint,
  // never occlude remote fighters across the rest of Greyhaven.
  return p.actorsBehind.length===1&&
   actor.x>=p.footprint.x&&actor.x<=p.footprint.x+p.footprint.w&&
   actor.y>=p.footprint.y-32&&actor.y<p.visualDepthY;
 }
 return Object.freeze({
  load,prepare,behindFacade,
  state:()=>Object.freeze({phase,failure,source:"original Blender A2.32 raised lower hinge",
   actorOcclusionVisualOnly:true,serverAuthorityChanged:false})
 });
}
