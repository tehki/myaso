/**
 * Graphics 3B P0 bridge for original World 9 PR #493 Blacksmith sockets.
 * Source authored geometry is not server-authoritative, and IDs/pickups remain
 * solely owned by Core + Items. Does not modify World, Combat or network.
 */
import {createBlacksmithRackVisualPlan} from "./armory-rack-visual.mjs";

export const WORLD493_RACK_BRIDGE = Object.freeze({
  sourcePr:493,sourceHead:"07060f981b8a1dac89184b621b6893dd970a08ae",
  layoutVersion:1,armoryId:"greyhaven-smith-open-front",
  gameplayIntegrationApproved:false,productionApproved:false
});

export function createWorld493RackArtPlan({
 worldArmory,authoredMap,layoutVersion,
 committedWorldItems,camera,width=640,height=640,zoom
}={}) {
 if(layoutVersion!==WORLD493_RACK_BRIDGE.layoutVersion ||
    worldArmory?.id!==WORLD493_RACK_BRIDGE.armoryId ||
    worldArmory?.buildingId!=="smith" ||
    worldArmory?.layout!=="outdoor-open-front" ||
    worldArmory?.requiresZoneTransfer!==false ||
    worldArmory?.hasImplicitInventory!==false ||
    worldArmory?.mapId!==authoredMap?.id ||
    !Array.isArray(worldArmory?.rackSockets) ||
    worldArmory.rackSockets.length!==4 ||
    !Array.isArray(authoredMap?.buildings))
   throw new RangeError("Missing or mismatched World #493 armory contract");
 const building=authoredMap.buildings.find(b=>b.id==="smith");
 if(!building||building.kind!=="smith")
   throw new RangeError("World Blacksmith not found");
 const ids=new Set(),xs=new Set();
 const sockets=worldArmory.rackSockets.map(s=>{
   if(!s || typeof s.socketId!=="string" ||
     !/^greyhaven-rack-[1-4]$/.test(s.socketId) || ids.has(s.socketId) ||
     s.displayCategory!=="sword" || s.mapId!==authoredMap.id ||
     !Number.isInteger(s.x)||!Number.isInteger(s.y) ||
     s.x<=building.x||s.x>=building.x+building.w ||
     s.y<building.y+building.h+18||s.y>building.y+building.h+90 ||
     !s.approach || s.approach.x!==s.x ||
     !Number.isInteger(s.approach.y)||s.approach.y-s.y!==50 ||
     xs.has(s.x))
     throw new RangeError("Invalid or repeated World Blacksmith socket");
   ids.add(s.socketId);xs.add(s.x);
   return Object.freeze({id:s.socketId,worldX:s.x,worldY:s.y});
 });
 if(![1,2,3,4].every(n=>ids.has("greyhaven-rack-"+n))||
   !sockets.every(s=>s.worldY===sockets[0].worldY))
   throw new RangeError("Four aligned original World sockets required");
 const sorted=[...sockets].sort((a,b)=>a.worldX-b.worldX);
 if(sorted.some((s,i)=>i>0 && s.worldX-sorted[i-1].worldX<30))
   throw new RangeError("World rack sword visual stations overlap");
 const rack=Object.freeze({
   buildingId:"smith",
   version:worldArmory.id+"/v"+layoutVersion,
   zoneId:worldArmory.mapId,
   origin:Object.freeze({
     x:sockets.reduce((n,s)=>n+s.worldX,0)/4,
     y:sockets[0].worldY
   }),
   sockets:Object.freeze(sockets),
 });
 const plan=createBlacksmithRackVisualPlan({
   building,rack,committedWorldItems,camera,width,height,
   ...(zoom===undefined?{}:{zoom})
 });
 return Object.freeze({
   ...plan,
   sourceLayoutId:worldArmory.id,
   sourceWorldHeadExpected:WORLD493_RACK_BRIDGE.sourceHead,
   worldSourceContractMatched:true,
   serverSocketAuthorityVerified:false,
   actualGameSceneIntegrated:false,
   authoritativePickupEnabled:false,
   productionApproved:false
 });
}
