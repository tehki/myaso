import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MAP_IDS,AUTHORED_MAPS} from "../src/world/authored-maps.mjs";
import {WORLD_ALPHA_ARMORY_VERSION,WORLD_ALPHA_ARMORY_ID,WORLD_ALPHA_ARMORY,
 WORLD_ALPHA_SPAWN_COORDINATES,WORLD_ALPHA_SWORD_RACK_SOCKETS,
 getWorldAlphaSwordSocket,validateWorldAlphaArmoryLayout} from "../src/world/alpha-armory.mjs";

const map=AUTHORED_MAPS[MAP_IDS.overworld],smith=map.buildings.find(b=>b.id==="smith");
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const circleRect=(p,r,b)=>{
 const dx=p.x-Math.max(b.x,Math.min(p.x,b.x+b.w));
 const dy=p.y-Math.max(b.y,Math.min(p.y,b.y+b.h));
 return dx*dx+dy*dy<=r*r;
};
const walkableFixedBuildingFootprints=(p)=>{
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||
   p.x<18||p.y<18||p.x>map.width-18||p.y>map.height-18)return false;
 if(map.buildings.some(b=>circleRect(p,18,b)))return false;
 // These P0 routes are wholly inside Greyhaven and nowhere near its wall.
 return p.x>map.city.x+40 && p.x<map.city.x+map.city.w-40 &&
   p.y>map.city.y+40 && p.y<map.city.y+map.city.h-40;
};
const swept=(a,b)=>{
 const n=Math.ceil(dist(a,b)/4);
 for(let k=0;k<=n;k++){
  const t=k/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  if(!walkableFixedBuildingFootprints(p))return false;
 }
 return true;
};

test("P0 four frozen distinct rack sockets represent render fixtures, never item IDs",()=>{
 assert.equal(WORLD_ALPHA_ARMORY_VERSION,1);
 assert.equal(WORLD_ALPHA_ARMORY_ID,"greyhaven-smith-open-front");
 assert.ok(Object.isFrozen(WORLD_ALPHA_ARMORY));
 assert.deepEqual([WORLD_ALPHA_ARMORY.mapId,WORLD_ALPHA_ARMORY.buildingId,
  WORLD_ALPHA_ARMORY.layout],[MAP_IDS.overworld,"smith","outdoor-open-front"]);
 assert.equal(WORLD_ALPHA_ARMORY.requiresZoneTransfer,false);
 assert.equal(WORLD_ALPHA_ARMORY.hasImplicitInventory,false);
 assert.ok(Object.isFrozen(WORLD_ALPHA_SWORD_RACK_SOCKETS));
 assert.equal(WORLD_ALPHA_SWORD_RACK_SOCKETS.length,4);
 assert.equal(new Set(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>s.socketId)).size,4);
 assert.ok(WORLD_ALPHA_SWORD_RACK_SOCKETS.every(s=>Object.isFrozen(s)&&Object.isFrozen(s.approach)));
 assert.ok(WORLD_ALPHA_SWORD_RACK_SOCKETS.every(s=>s.displayCategory==="sword"));
 assert.ok(WORLD_ALPHA_SWORD_RACK_SOCKETS.every(s=>!("worldItemId" in s)&&!("owner" in s)&&!("clickShape" in s)));
 assert.equal(validateWorldAlphaArmoryLayout(),true);
});

test("P0 Blacksmith location and rack fronts remain in same authored overworld",()=>{
 assert.deepEqual([smith.x,smith.y,smith.w,smith.h,smith.kind],
  [3710,3850,182,162,"smith"]);
 assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>[s.x,s.y]),
  [[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
 for(const s of WORLD_ALPHA_SWORD_RACK_SOCKETS){
  assert.equal(s.mapId,MAP_IDS.overworld);
  assert.ok(s.x>smith.x+18&&s.x<smith.x+smith.w-18);
  assert.equal(s.y,smith.y+smith.h+26);
  assert.equal(s.approach.x,s.x);
  assert.equal(s.approach.y,4088);
 }
});

test("P0 four distinct full-radius characters may stand at the rack simultaneously",()=>{
 for(let i=0;i<4;i++){
  const a=WORLD_ALPHA_SWORD_RACK_SOCKETS[i];
  assert.ok(walkableFixedBuildingFootprints(a));
  assert.ok(walkableFixedBuildingFootprints(a.approach));
  assert.ok(swept(a,a.approach));
  assert.equal(dist(a,a.approach),50);
  for(let j=i+1;j<4;j++){
   const b=WORLD_ALPHA_SWORD_RACK_SOCKETS[j];
   assert.ok(dist(a,b)>=40);
   assert.ok(dist(a.approach,b.approach)>=40);
  }
 }
});

test("P0 all four Core 8C staging arrivals have sampled-clear paths to all four rack stands",()=>{
 assert.deepEqual(WORLD_ALPHA_SPAWN_COORDINATES.map(p=>[p.x,p.y]),
  [[4110,4160],[4206,4160],[4110,4256],[4206,4256]]);
 const waypoints=[{x:3990,y:4180},{x:3980,y:4090}];
 for(const spawn of WORLD_ALPHA_SPAWN_COORDINATES){
  assert.ok(Object.isFrozen(spawn)&&walkableFixedBuildingFootprints(spawn));
  for(const s of WORLD_ALPHA_SWORD_RACK_SOCKETS){
   const points=[spawn,...waypoints,s.approach];
   for(let i=1;i<points.length;i++)
    assert.ok(swept(points[i-1],points[i]),
      "blocked segment from "+JSON.stringify(points[i-1])+" to "+JSON.stringify(points[i]));
  }
 }
});

test("P0 socket IDs are stable for render mapping, without inventing World item ownership",()=>{
 for(const socket of WORLD_ALPHA_SWORD_RACK_SOCKETS){
  assert.equal(getWorldAlphaSwordSocket(socket.socketId),socket);
  assert.ok(Object.isFrozen(getWorldAlphaSwordSocket(socket.socketId)));
 }
 for(const fake of ["",null,undefined,42,{},["greyhaven-rack-1"],"unknown","smith"])
  assert.equal(getWorldAlphaSwordSocket(fake),null);
});

test("P0 no gameplay pickup, attack, server or networking modules consume static coordinates",()=>{
 const source=readFileSync(new URL("../src/world/alpha-armory.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(source,/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|window\.|document\./);
 assert.doesNotMatch(source,/TryPickup|claimItem|equippedSwordId|worldItemId\s*:/);
 for(const p of ["../web/online-game.mjs","../server/src/main.rs","../server/src/simulation.rs"]){
  assert.doesNotMatch(readFileSync(new URL(p,import.meta.url),"utf8"),
   /alpha-armory|WORLD_ALPHA_SWORD_RACK_SOCKETS/);
 }
});
