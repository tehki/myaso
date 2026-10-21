import test from "node:test";
import assert from "node:assert/strict";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {WORLD_ALPHA_SWORD_RACK_SOCKETS} from "../src/world/alpha-armory.mjs";
import {
 WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS,
 WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE,
} from "../src/world/alpha-solid-geometry.mjs";
import {
 WORLD_ALPHA_COMBAT_SPACE_VERSION,WORLD_ALPHA_COMBAT_SPACE,
} from "../src/world/alpha-combat-space.mjs";

const area=WORLD_ALPHA_COMBAT_SPACE,solids=WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS;
const radius=area.referenceActorRadius;
const distanceSquared=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const overlap=(p,r,s)=>{
 const x=Math.max(s.min_x,Math.min(p.x,s.max_x));
 const y=Math.max(s.min_y,Math.min(p.y,s.max_y));
 return (p.x-x)**2+(p.y-y)**2<=r*r;
};
const staticallyClear=(p)=>solids.every(s=>!overlap(p,radius,s));
const inside=(p,r=radius)=>p.x-r>=area.bounds.min_x&&
 p.x+r<=area.bounds.max_x&&p.y-r>=area.bounds.min_y&&
 p.y+r<=area.bounds.max_y;
const sweptStaticClear=(from,to)=>{
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4));
 for(let i=0;i<=steps;i++){
  const t=i/steps,p={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
  if(!staticallyClear(p))return false;
 }
 return true;
};

test("P0 Blacksmith combat clearing remains in the same authored Greyhaven map",()=>{
 assert.equal(WORLD_ALPHA_COMBAT_SPACE_VERSION,1);
 assert.equal(area.id,"greyhaven-smith-south-courtyard");
 assert.equal(area.mapId,MAP_IDS.overworld);
 assert.equal(area.adjacentBuildingId,"smith");
 assert.equal(area.requiresZoneTransfer,false);
 assert.equal(area.hasCombatAuthority,false);
 assert.equal(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.includesRiverOrDynamicSolids,false);
 assert.ok(Object.isFrozen(area)&&Object.isFrozen(area.stations));
 assert.deepEqual(area.bounds,{min_x:3700,min_y:4120,max_x:3940,max_y:4360});
 assert.equal(radius,18);
 assert.equal(solids.length,23);
});

test("P0 entire combat clearing is outside all 23 fixed solids with fighter-radius clearance",()=>{
 // Rectangular envelope with all boundaries inflated by player radius. This
 // guards a future new building or wall from silently occupying the courtyard.
 for(const s of solids){
  const separated=area.bounds.max_x+radius<s.min_x||
   area.bounds.min_x-radius>s.max_x||
   area.bounds.max_y+radius<s.min_y||
   area.bounds.min_y-radius>s.max_y;
  assert.ok(separated,"combat clearing intersects fixed solid "+s.id);
 }
 assert.equal(area.stations.length,4);
 for(let i=0;i<area.stations.length;i++){
  const a=area.stations[i];
  assert.ok(Object.isFrozen(a)&&inside(a)&&staticallyClear(a));
  for(let j=i+1;j<area.stations.length;j++)
   assert.ok(distanceSquared(a,area.stations[j])>(radius*2)**2,
    "four combat stations must support simultaneous nonoverlapping players");
 }
});

test("P0 each of four sword approaches has a fixed-solid-clear route to all four melee stations",()=>{
 assert.equal(WORLD_ALPHA_SWORD_RACK_SOCKETS.length,4);
 for(const socket of WORLD_ALPHA_SWORD_RACK_SOCKETS){
  assert.ok(staticallyClear(socket.approach));
  for(const station of area.stations)
   assert.ok(sweptStaticClear(socket.approach,station),
    socket.socketId+" cannot reach courtyard station "+JSON.stringify(station));
 }
});

test("P0 eight mouse headings have 64-unit sampled static clearance with fighter radius",()=>{
 const {origin,length}=area.directionalProbe;
 assert.ok(inside(origin)&&staticallyClear(origin));
 assert.equal(length,64);
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4;
  const dest={x:origin.x+length*Math.cos(angle),y:origin.y+length*Math.sin(angle)};
  assert.ok(inside(dest),"clearance envelope misses heading "+i);
  assert.ok(sweptStaticClear(origin,dest),"fixed geometry blocks heading "+i);
 }
 // This does not assert that server roll/dash/knockback actually travels 64,
 // nor does it authorize movement through dynamic players or other obstacles.
});
