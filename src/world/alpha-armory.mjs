// Moon Games / World Department 9: P0 first-playable physical armory layout.
// Authoring coordinates only. Core + Items alone create authoritative per-sword
// world-item IDs, validate proximity/LOS, own transactions and replication.
// UI/Graphics provide actual visible pixel bounds and click intent routing.
// No inventory, server world mutation, pickup, portal or attack is implemented.
import {MAP_IDS,getAuthoredMap} from "./authored-maps.mjs";

export const WORLD_ALPHA_ARMORY_VERSION=1;
export const WORLD_ALPHA_ARMORY_ID="greyhaven-smith-open-front";
export const WORLD_ALPHA_SPAWN_COORDINATES=Object.freeze([
  Object.freeze({x:4110,y:4160}),
  Object.freeze({x:4206,y:4160}),
  Object.freeze({x:4110,y:4256}),
  Object.freeze({x:4206,y:4256}),
]);

const makeSocket=(index,x)=>Object.freeze({
  socketId:"greyhaven-rack-"+index,
  // This is a fixture *socket*, not a sword, an item ID or a click hitbox.
  itemKind:"practice-sword",
  mapId:MAP_IDS.overworld,
  x,y:4038,
  approach:Object.freeze({x,y:4088}),
});
export const WORLD_ALPHA_SWORD_RACK_SOCKETS=Object.freeze([
  makeSocket(1,3740),
  makeSocket(2,3780),
  makeSocket(3,3820),
  makeSocket(4,3860),
]);

export const WORLD_ALPHA_ARMORY=Object.freeze({
  id:WORLD_ALPHA_ARMORY_ID,
  mapId:MAP_IDS.overworld,
  buildingId:"smith",
  layout:"outdoor-open-front",
  // Do not activate an interior or door: the alpha stays in ONE shared zone.
  requiresZoneTransfer:false,
  hasImplicitInventory:false,
  rackSockets:WORLD_ALPHA_SWORD_RACK_SOCKETS,
});

// Minimal exact-ID lookup for Graphics/Items mapping once the authoritative
// world item is spawned at an approved socket. Never derive item identity.
export function getWorldAlphaSwordSocket(id){
  if(typeof id!=="string")return null;
  return WORLD_ALPHA_SWORD_RACK_SOCKETS.find(s=>s.socketId===id)??null;
}

export function validateWorldAlphaArmoryLayout(){
  const map=getAuthoredMap(MAP_IDS.overworld);
  const smith=map?.buildings.find(b=>b.id===WORLD_ALPHA_ARMORY.buildingId);
  if(!smith||smith.kind!=="smith"||!map?.city)return false;
  const seen=new Set(),anchors=[];
  for(const s of WORLD_ALPHA_SWORD_RACK_SOCKETS){
    if(seen.has(s.socketId)||s.mapId!==map.id||!Number.isFinite(s.x)||
      !Number.isFinite(s.y)||s.x<smith.x+18||
      s.x>smith.x+smith.w-18||s.y<smith.y+smith.h+26||
      s.y>smith.y+smith.h+65||
      s.approach.x!==s.x||s.approach.y-s.y!==50)
      return false;
    seen.add(s.socketId);
    anchors.push(s,s.approach);
  }
  // Independent fixture points cannot collapse into one clickable prop.
  for(let i=0;i<anchors.length;i++){
    for(let j=i+1;j<anchors.length;j++){
      if(Math.hypot(anchors[i].x-anchors[j].x,
        anchors[i].y-anchors[j].y)<30)return false;
    }
  }
  return WORLD_ALPHA_SWORD_RACK_SOCKETS.length===4 &&
    WORLD_ALPHA_SPAWN_COORDINATES.length===4;
}
