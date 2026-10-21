// Moon Games First Playable Alpha: WORLD-OWNED named facade replacement contract.
// The opt-in Graphics layer can draw one authored building with correct visual
// depth without also painting World's original tiled placeholder.
// This is render presentation only; no authority over collision, zones, doors,
// player movement, network snapshots, respawn, or equipped assets.
import {MAP_IDS,getAuthoredMap} from "./authored-maps.mjs";

export const WORLD_BUILDING_PRESENTATION_VERSION=1;
export const WORLD_ALPHA_REPLACEABLE_BUILDING_IDS=Object.freeze(["red-lion"]);

// Visual occlusion is an artist-facing threshold, NOT an interaction anchor.
// Existing authored building entrance y=4060 and portal trigger y=4075 are
// separate immutable inputs from authored-maps.mjs; neither is moved here.
const DEPTH_Y_BY_ID=Object.freeze({"red-lion":4075});

export function normalizeWorldBuildingReplacementIds(mapId,ids=[]) {
  if(mapId!==MAP_IDS.overworld||!Array.isArray(ids)||
     ids.length>WORLD_ALPHA_REPLACEABLE_BUILDING_IDS.length)
    throw new RangeError("invalid World building replacement list");
  const map=getAuthoredMap(mapId);
  const allowed=new Set(WORLD_ALPHA_REPLACEABLE_BUILDING_IDS);
  const seen=new Set();
  for(const id of ids){
    if(typeof id!=="string"||!allowed.has(id)||seen.has(id)||
       !map.buildings.some(b=>b.id===id))
      throw new RangeError("unknown or duplicate World building replacement");
    seen.add(id);
  }
  return Object.freeze([...seen]);
}

// Graphics calls this with its *existing* actor objects; it is a pure
// presentation split and preserves caller order, world geometry and identity.
// Ties are in FRONT of the facade to avoid obscuring a player at the threshold.
export function worldBuildingPresentation(mapId,buildingId,actors=[]) {
  const map=getAuthoredMap(mapId);
  if(!map||mapId!==MAP_IDS.overworld||
     !WORLD_ALPHA_REPLACEABLE_BUILDING_IDS.includes(buildingId)||
     !Array.isArray(actors)||actors.length>256)
    return null;
  const b=map.buildings.find(item=>item.id===buildingId);
  const portal=map.portals.find(p=>p.id===b?.portal);
  if(!b?.entrance||!portal||!Number.isFinite(DEPTH_Y_BY_ID[buildingId]))
    return null;
  const behind=[],front=[],depthY=DEPTH_Y_BY_ID[buildingId];
  for(const actor of actors){
    if(!actor||!Number.isFinite(actor.x)||!Number.isFinite(actor.y))
      return null;
    if(actor.y<depthY)behind.push(actor);
    else front.push(actor);
  }
  return Object.freeze({
    mapId,buildingId,
    footprint:Object.freeze({x:b.x,y:b.y,w:b.w,h:b.h}),
    gameplayEntrance:Object.freeze({x:b.entrance.x,y:b.entrance.y}),
    interactionPortal:Object.freeze({id:portal.id,x:portal.x,y:portal.y,radius:portal.radius}),
    visualDepthY:depthY,
    // Absence of an asset path is deliberate: Graphics owns facade/roof assets.
    actorsBehind:Object.freeze(behind),
    actorsInFront:Object.freeze(front),
    placeholderSuppressedByDefault:false,
  });
}
