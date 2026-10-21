// Moon Games / World 9 - P0 native-approach routing regression.
// A real Core 8A four-browser flight first passed and then exposed a
// north-first route hitting Smith's east wall. Preserve south/west-first
// authored static clearance without changing client/server movement authority.
// This is NOT a pathfinding implementation or proof of live travel.
import test from "node:test";
import assert from "node:assert/strict";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {
  WORLD_ALPHA_ARMORY,
  WORLD_ALPHA_SPAWN_COORDINATES,
  WORLD_ALPHA_SWORD_RACK_SOCKETS,
} from "../src/world/alpha-armory.mjs";
import {WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS} from "../src/world/alpha-solid-geometry.mjs";

const fighterRadius=18;
const solids=WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS;

// Conservative swept radius-18 query against an expanded fixed AABB.
// It blocks tangent contact and guards the *whole* segment, not samples.
// Core 8C's compiled Rust collision tests remain the authority cross-check.
function intersectsInflatedSolid(a,b,s){
  let entry=0,exit=1;
  for(const [axis,minimum,maximum] of [
    ["x",s.min_x-fighterRadius,s.max_x+fighterRadius],
    ["y",s.min_y-fighterRadius,s.max_y+fighterRadius],
  ]){
    const delta=b[axis]-a[axis];
    if(delta===0){
      if(a[axis]<minimum||a[axis]>maximum)return false;
      continue;
    }
    const lo=(minimum-a[axis])/delta;
    const hi=(maximum-a[axis])/delta;
    entry=Math.max(entry,Math.min(lo,hi));
    exit=Math.min(exit,Math.max(lo,hi));
    if(entry>exit)return false;
  }
  return entry<=exit;
}
const clear=(a,b)=>solids.every(s=>!intersectsInflatedSolid(a,b,s));
const inCity=(p,city)=>p.x-fighterRadius>city.x&&
  p.x+fighterRadius<city.x+city.w&&
  p.y-fighterRadius>city.y&&
  p.y+fighterRadius<city.y+city.h;

test("P0 four named server-staging spawns keep cardinal west-first approaches to four rack sockets",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  assert.equal(map?.city?.id,"greyhaven");
  assert.equal(WORLD_ALPHA_ARMORY.mapId,MAP_IDS.overworld);
  assert.equal(WORLD_ALPHA_ARMORY.requiresZoneTransfer,false);
  assert.equal(solids.length,23);
  assert.deepEqual(WORLD_ALPHA_SPAWN_COORDINATES.map(p=>[p.x,p.y]),[
    [4110,4160],[4206,4160],[4110,4256],[4206,4256],
  ]);
  assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>
    [s.socketId,s.approach.x,s.approach.y]),[
    ["greyhaven-rack-1",3740,4088],
    ["greyhaven-rack-2",3780,4088],
    ["greyhaven-rack-3",3820,4088],
    ["greyhaven-rack-4",3860,4088],
  ]);
  for(let i=0;i<4;i++){
    const start=WORLD_ALPHA_SPAWN_COORDINATES[i];
    const finish=WORLD_ALPHA_SWORD_RACK_SOCKETS[i].approach;
    // Before moving north, stay on the original open southern street.
    const west=Object.freeze({x:finish.x,y:start.y});
    for(const p of [start,west,finish])
      assert.ok(inCity(p,map.city),"route waypoint outside authored Greyhaven for player "+(i+1));
    assert.ok(clear(start,west),"west-first leg blocked for player "+(i+1));
    assert.ok(clear(west,finish),"northward final leg blocked for player "+(i+1));
    assert.ok(clear(finish,west),"return south leg blocked for player "+(i+1));
    assert.ok(clear(west,start),"return east leg blocked for player "+(i+1));
    assert.ok(start.x>finish.x&&start.y>finish.y);
  }
});

test("P0 north-first shortcut is NOT a valid substitute for the reviewed south-side route",()=>{
  const smith=solids.find(s=>s.id==="building:smith");
  assert.ok(smith,"missing actual fixed Blacksmith collider");
  // Regression witness from Core 8A #608: entering Smith's east wall
  // while moving west at y=4020 must be blocked, not made passable.
  const blockedStart={x:4110,y:4020};
  const blockedEnd={x:3820,y:4020};
  assert.equal(intersectsInflatedSolid(blockedStart,blockedEnd,smith),true);
  assert.equal(clear(blockedStart,blockedEnd),false);
  // This proves only known STATIC rectangles, never river/doors/players,
  // authoritative position, player input timing or sword ownership.
});
