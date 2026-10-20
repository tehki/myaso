// D8: offline-only expedition navigation hints and a fixed cartographic sketch.
// Direction is straight-line orientation, NOT a route/LOS/portal authorization.
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "./authored-preview-collision.mjs";
import { localExpeditionProgress } from "./local-expeditions.mjs";
import { certifiedTrailForNext } from "./local-trails.mjs";

export const WAYFINDING_VERSION = 1;
export const WAYFINDING_DIRECTIONS = Object.freeze(["N","NE","E","SE","S","SW","W","NW"]);
export const WAYFINDING_SKETCH_SIZE = 248;

export function localWayfindingHint(state, mapId, x, y) {
  const progress=localExpeditionProgress(state);
  if(!progress.nextStep || mapId!==MAP_IDS.overworld
    || !Number.isFinite(x)||!Number.isFinite(y)
    || !isAuthoredPreviewWalkable(mapId,x,y))return null;
  const target=progress.nextStep.site;
  const dx=target.x-x,dy=target.y-y;
  const distance=Math.hypot(dx,dy);
  const bearing=(Math.atan2(dx,-dy)*180/Math.PI+360)%360;
  const direction=WAYFINDING_DIRECTIONS[Math.round(bearing/45)%8];
  const result={
    targetId:target.id,targetName:target.name,action:progress.nextStep.action,
    direction,bearingDeg:bearing,distance,
    // A geographic hint is not a collision-safe turn-by-turn route.
    caution:"Straight-line bearing only — follow roads and bridges.",
  };
  return Object.freeze(result);
}

// Draws a deliberately tiny, static sketch of the entire authored Moonvale.
// Never computes a path or reads the network; called only when M opens the map,
// and throttled by the preview to avoid creating per-frame map work.
export function drawLocalWayfindingSketch(ctx,mapId,x,y,state,size=WAYFINDING_SKETCH_SIZE) {
  const map=getAuthoredMap(mapId);
  const hint=localWayfindingHint(state,mapId,x,y);
  if(!ctx||typeof ctx.fillRect!=="function"||typeof ctx.beginPath!=="function"
    ||!map||mapId!==MAP_IDS.overworld
    ||!Number.isFinite(size)||size<128||size>512
    ||!isAuthoredPreviewWalkable(mapId,x,y))return false;
  const scale=(size-24)/Math.max(map.width,map.height);
  const tx=12,ty=12;
  const px=x0=>tx+x0*scale,py=y0=>ty+y0*scale;
  ctx.clearRect(0,0,size,size);
  ctx.fillStyle="#203127";ctx.fillRect(0,0,size,size);
  ctx.fillStyle="#6a865c";ctx.fillRect(tx,ty,map.width*scale,map.height*scale);
  function poly(points,color,width){
    if(points.length<2)return;
    ctx.beginPath();ctx.moveTo(px(points[0][0]),py(points[0][1]));
    for(let i=1;i<points.length;i++)ctx.lineTo(px(points[i][0]),py(points[i][1]));
    ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
  }
  poly(map.river.points,"#8ac6cc",Math.max(2,map.river.width*scale));
  for(const road of map.roads)poly(road.points,"#e0c99d",Math.max(1,road.width*scale));
  for(const bridge of map.bridges){
    ctx.fillStyle="#f3d9ab";ctx.fillRect(px(bridge.x-bridge.w/2),py(bridge.y-bridge.h/2),
      bridge.w*scale,Math.max(2,bridge.h*scale));
  }
  ctx.strokeStyle="#c4b7a2";ctx.lineWidth=1.2;
  ctx.strokeRect(px(map.city.x),py(map.city.y),map.city.w*scale,map.city.h*scale);
  for(const building of map.buildings){
    ctx.fillStyle="#55453b";ctx.fillRect(px(building.x),py(building.y),
      Math.max(1,building.w*scale),Math.max(1,building.h*scale));
  }
  // Target is shown only for the next selected stage, no hidden-site leakage.
  if(hint){
    const target=localExpeditionProgress(state).nextStep.site;
    const trail=certifiedTrailForNext(state,mapId);
    if(trail){
      // A certified route connects authored MILESTONES, not the player's
      // current position. Rejoin it on foot; no player-steering guarantee.
      ctx.strokeStyle="#f5c06a";ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(px(trail.points[0][0]),py(trail.points[0][1]));
      for(let i=1;i<trail.points.length;i++)
        ctx.lineTo(px(trail.points[i][0]),py(trail.points[i][1]));
      ctx.stroke();
    }else{
      // Before any milestone, only show the basic D8 straight bearing.
      ctx.strokeStyle="#9d9c88";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(px(x),py(y));ctx.lineTo(px(target.x),py(target.y));ctx.stroke();
    }
    ctx.fillStyle="#ffbf63";ctx.beginPath();ctx.arc(px(target.x),py(target.y),4,0,Math.PI*2);ctx.fill();
  }
  ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(px(x),py(y),4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#1c3029";ctx.lineWidth=2;ctx.stroke();
  return true;
}
