import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {WORLD_ALPHA_SPAWN_COORDINATES,WORLD_ALPHA_SWORD_RACK_SOCKETS} from "../src/world/alpha-armory.mjs";
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
// Exact segment intersection against a conservative fighter-radius-expanded
// fixed AABB. Includes tangency and endpoints: never approve a narrow solid
// merely because it falls between sampled movement points. Square inflation
// is intentionally stricter at corners than circle-vs-rectangle collision.
const segmentIntersectsInflatedSolid=(from,to,solid,r=radius)=>{
 let entry=0,exit=1;
 for(const [axis,min,max] of [
  ["x",solid.min_x-r,solid.max_x+r],
  ["y",solid.min_y-r,solid.max_y+r],
 ]){
  const direction=to[axis]-from[axis];
  if(direction===0){
   if(from[axis]<min||from[axis]>max)return false;
   continue;
  }
  const tA=(min-from[axis])/direction;
  const tB=(max-from[axis])/direction;
  entry=Math.max(entry,Math.min(tA,tB));
  exit=Math.min(exit,Math.max(tA,tB));
  if(entry>exit)return false;
 }
 return entry<=exit;
};
const sweptStaticClear=(from,to)=>solids.every(s=>
 !segmentIntersectsInflatedSolid(from,to,s));

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

test("P0 exact swept collision rejects thin between-sample solids and tangent touch",()=>{
 // From x=0 to x=10 a thin obstacle spans x=1.1..1.2. A legacy 4-unit
 // sampling scheme misses this obstacle, but exact continuous sweep does not.
 const thin={min_x:1.1,max_x:1.2,min_y:-0.25,max_y:0.25};
 const from={x:0,y:0},to={x:10,y:0};
 assert.equal(segmentIntersectsInflatedSolid(from,to,thin,0),true);
 assert.equal(segmentIntersectsInflatedSolid(to,from,thin,0),true);
 assert.equal(segmentIntersectsInflatedSolid(from,to,thin,18),true);
 assert.equal(segmentIntersectsInflatedSolid({x:0,y:18.25},{x:10,y:18.25},thin,18),true,
  "inflated AABB tangency is blocked");
 assert.equal(segmentIntersectsInflatedSolid({x:0,y:18.26},{x:10,y:18.26},thin,18),false);
 assert.equal(segmentIntersectsInflatedSolid({x:0,y:25},{x:10,y:25},thin,18),false);
});

// Cross-owner static-source proof. Import the actual server-owned staging
// positions from the Core 8C Rust admission source, never a duplicated test
// constant or client-provided coordinates. Reject unfamiliar source shapes
// rather than guessing that World and Core still have the same four spawns.
const coreStagingSpawnsFromSource=(source)=>{
 const declaration=/const\s+GREYHAVEN_SPAWNS\s*:\s*\[\s*\(\s*f32\s*,\s*f32\s*\)\s*;\s*4\s*\]\s*=\s*\[([\s\S]*?)\];/g;
 const blocks=[...source.matchAll(declaration)];
 assert.equal(blocks.length,1,"expected one reviewed Core 8C four-spawn declaration");
 const body=blocks[0][1];
 const tuple=/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*,?/g;
 const rows=[...body.matchAll(tuple)].map(v=>({x:Number(v[1]),y:Number(v[2])}));
 assert.equal(body.replace(tuple,"").trim(),"","unreviewed Core 8C spawn expression");
 assert.equal(rows.length,4,"Core 8C must expose exactly four numeric spawns");
 assert.ok(rows.every(p=>Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)),
  "staging World-compatible coordinates must be integer values");
 assert.equal(new Set(rows.map(p=>p.x+","+p.y)).size,4,
  "Core 8C cannot silently duplicate a staging position");
 assert.match(source,/GREYHAVEN_SPAWNS\.iter\(\)\.copied\(\)\.find\(/,
  "server admission must use the declared staging positions");
 return rows;
};

test("P0 World spawn-to-courtyard routes pin the ACTUAL Core 8C server admission coordinates",()=>{
 const source=readFileSync(new URL("../server/src/alpha_spawn.rs",import.meta.url),"utf8");
 const actual=coreStagingSpawnsFromSource(source);
 assert.deepEqual(actual,WORLD_ALPHA_SPAWN_COORDINATES.map(p=>({x:p.x,y:p.y})));
 // Tampering controls: a future server respawn move cannot leave World
 // route proof green, and duplicate/removed/floating source must fail closed.
 const moved=source.replace("(4206.0, 4256.0)","(4207.0, 4256.0)");
 assert.notEqual(moved,source);
 assert.notDeepEqual(coreStagingSpawnsFromSource(moved),actual);
 const duplicate=source.replace("(4206.0, 4256.0)","(4110.0, 4160.0)");
 assert.notEqual(duplicate,source);
 assert.throws(()=>coreStagingSpawnsFromSource(duplicate));
 const omitted=source.replace("(4206.0, 4256.0),","");
 assert.notEqual(omitted,source);
 assert.throws(()=>coreStagingSpawnsFromSource(omitted));
 const renamed=source.replace("const GREYHAVEN_SPAWNS:","const OTHER_SPAWNS:");
 assert.notEqual(renamed,source);
 assert.throws(()=>coreStagingSpawnsFromSource(renamed));
 // This checks a static, opt-in staging contract only; it does not assert
 // current server lease/zone/epoch, successful admission or real path motion.
});

test("P0 all four server-designated city spawn fixtures can walk straight to every courtyard station",()=>{
 // World-authored Core 8C nominal arrival points, never a client-selected
 // spawn or a promise about real-time players, movement or dynamic blockers.
 const city=getAuthoredMap(MAP_IDS.overworld)?.city;
 assert.equal(city?.id,"greyhaven");
 assert.equal(WORLD_ALPHA_SPAWN_COORDINATES.length,4);
 assert.equal(area.stations.length,4);
 const seen=new Set();
 for(const [i,spawn] of WORLD_ALPHA_SPAWN_COORDINATES.entries()){
  const key=spawn.x+","+spawn.y;
  assert.equal(seen.has(key),false,"repeated authored staging spawn");
  seen.add(key);
  assert.ok(spawn.x-radius>city.x&&spawn.x+radius<city.x+city.w);
  assert.ok(spawn.y-radius>city.y&&spawn.y+radius<city.y+city.h);
  assert.ok(staticallyClear(spawn),"spawn "+i+" overlaps an authored solid");
  for(const [j,station] of area.stations.entries()){
   assert.ok(sweptStaticClear(spawn,station),
    "unarmed fighter from spawn "+i+" cannot reach courtyard station "+j);
   assert.ok(sweptStaticClear(station,spawn),
    "courtyard fighter cannot return to arrival "+i+" from station "+j);
  }
 }
 // Static direct routes stay in one convex authored city rectangle. No
 // portal, server-side pathfinding, dynamic occupancy or respawn is exercised.
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
