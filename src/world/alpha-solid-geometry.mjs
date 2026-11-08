// Moon Games Department 9 - First Playable Alpha solid geometry handoff.
// Authoring-only, read-only AABB source for Core 8C/Physics 6 review.
// Never treat this client-importable manifest as a player/zone/movement/LOS
// authority. Core owns authenticated active map revision and complete same-tick
// solid windows. The model is scoped to GREYHAVEN, not the full 8192^2 world
// (river and dynamic objects require separate authoritative geometry).
import { MAP_IDS, getAuthoredMap } from "./authored-maps.mjs";

export const WORLD_ALPHA_SOLIDS_SCHEMA_VERSION = 1;
export const WORLD_ALPHA_SOLIDS_LAYOUT_ID = "moonvale-greyhaven-v10-solids-v1";
export const WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE = Object.freeze({
  mapId: MAP_IDS.overworld, cityId: "greyhaven", geometry: "fixed-buildings-and-city-walls",
  // Intentionally not "complete" or a server map revision.
  requiresCoreFence: true,
  includesRiverOrDynamicSolids: false,
});
export const WORLD_ALPHA_CITY_WALL_WIDTH = 37;
export const WORLD_ALPHA_GATE_X = 4130;
export const WORLD_ALPHA_GATE_Y = 4180;
export const WORLD_ALPHA_GATE_X_HALF = 73;
export const WORLD_ALPHA_GATE_Y_HALF = 68;

const freezeRect=(id,kind,min_x,min_y,max_x,max_y)=>Object.freeze({
  id, kind, min_x, min_y, max_x, max_y,
});

export function deriveAlphaGreyhavenStaticSolids(map=getAuthoredMap(MAP_IDS.overworld)) {
  if(map?.id!==MAP_IDS.overworld||map?.kind!=="outdoor"||
    map.city?.id!=="greyhaven"||!Array.isArray(map.buildings)||
    map.buildings.length!==15)return null;
  const city=map.city,coords=[city.x,city.y,city.w,city.h,
    ...map.buildings.flatMap(b=>[b.x,b.y,b.w,b.h])];
  if(!coords.every(Number.isFinite)||coords.some(x=>!Number.isInteger(x))||
    city.w<=0||city.h<=0)return null;
  const buildings=[],ids=new Set();
  for(const b of map.buildings){
    if(typeof b.id!=="string"||!/^[a-z0-9-]+$/.test(b.id)||
      ids.has(b.id)||b.w<=0||b.h<=0)return null;
    ids.add(b.id);
    buildings.push(freezeRect("building:"+b.id,"building",
      b.x,b.y,b.x+b.w,b.y+b.h));
  }
  // Exact D2 circle-rectangle collision footprints for the eight painted
  // 37-unit City wall spans. The two gaps MUST remain OPEN; avoid generating
  // opaque full-city AABBs that would invalidate a real passage.
  const t=WORLD_ALPHA_CITY_WALL_WIDTH/2,
    x=city.x,y=city.y,right=x+city.w,bottom=y+city.h,
    gx=WORLD_ALPHA_GATE_X,gy=WORLD_ALPHA_GATE_Y,
    dx=WORLD_ALPHA_GATE_X_HALF,dy=WORLD_ALPHA_GATE_Y_HALF;
  if(gx-dx<=x+t||gx+dx>=right-t||
     gy-dy<=y+t||gy+dy>=bottom-t)return null;
  const walls=[
    freezeRect("wall:north-west","city-wall",x-t,y-t,gx-dx,y+t),
    freezeRect("wall:north-east","city-wall",gx+dx,y-t,right+t,y+t),
    freezeRect("wall:south-west","city-wall",x-t,bottom-t,gx-dx,bottom+t),
    freezeRect("wall:south-east","city-wall",gx+dx,bottom-t,right+t,bottom+t),
    freezeRect("wall:west-north","city-wall",x-t,y-t,x+t,gy-dy),
    freezeRect("wall:west-south","city-wall",x-t,gy+dy,x+t,bottom+t),
    freezeRect("wall:east-north","city-wall",right-t,y-t,right+t,gy-dy),
    freezeRect("wall:east-south","city-wall",right-t,gy+dy,right+t,bottom+t),
  ];
  const solids=Object.freeze([...buildings,...walls]);
  if(solids.some(r=>!Number.isFinite(r.max_x)||!Number.isFinite(r.max_y)||
    !(r.max_x>r.min_x&&r.max_y>r.min_y)))return null;
  return solids;
}

// The complete KNOWN STATIC building/wall set for the reviewed Greyhaven
// content revision, NOT a claim that every runtime/dynamic obstruction exists.
// Deliberately expose neither a `complete: true` Physics flag nor an epoch
// or server-authoritative `map_revision`; those MUST come from Core 8C.
export const WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS=deriveAlphaGreyhavenStaticSolids();
if(!WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS||
  WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS.length!==23)
  throw new Error("World Alpha solids fail-closed: expected 15 buildings and 8 walls");

export function worldAlphaGreyhavenSolidById(id) {
  if(typeof id!=="string")return null;
  return WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS.find(s=>s.id===id)??null;
}
