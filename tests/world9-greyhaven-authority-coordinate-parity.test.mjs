import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {AUTHORED_MAPS,MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {GREYHAVEN_ALPHA_FOUNDATION as authoring,
  validateGreyhavenAlphaFoundation} from "../src/world/greyhaven-alpha-foundation.mjs";
import {WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS as authoredSolids,
  WORLD_ALPHA_SOLIDS_LAYOUT_ID,
  WORLD_ALPHA_CITY_WALL_WIDTH,WORLD_ALPHA_GATE_X,WORLD_ALPHA_GATE_Y,
  WORLD_ALPHA_GATE_X_HALF,WORLD_ALPHA_GATE_Y_HALF} from "../src/world/alpha-solid-geometry.mjs";

// Tests compare the *actual* authored map with independently authored Rust
// and Physics6 sources. No browser-provided values authorize a World mutation.
const read=(relative)=>readFileSync(new URL("../"+relative,import.meta.url),"utf8");
const fixture=JSON.parse(read("assets/world/greyhaven-alpha-solids-v1.json"));
const rustGenerated=read("server/src/alpha_greyhaven_solids_generated.rs");
const coreSpawns=read("server/src/greyhaven_alpha.rs");
const originalServer=read("server/src/main.rs");
const actualClient=read("web/online-game.mjs");
const FIGHTER_RADIUS=18;
const rectKeys=["id","kind","min_x","min_y","max_x","max_y"];
const point=(x,y)=>({x,y});
const rectValue=(r)=>Object.fromEntries(rectKeys.map(k=>[k,r[k]]));

function rustSolids(){
  return [...rustGenerated.matchAll(/StaticSolid\s*\{([^}]+)\}/g)].map(([,body])=>{
    const getString=k=>body.match(new RegExp('\\b'+k+':\\s*"([^"]+)"'))?.[1];
    const getNumber=k=>Number(body.match(new RegExp('\\b'+k+':\\s*(-?[0-9.]+)'))?.[1]);
    return {id:getString("id"),kind:getString("kind"),
      min_x:getNumber("min_x"),min_y:getNumber("min_y"),
      max_x:getNumber("max_x"),max_y:getNumber("max_y")};
  });
}

function rustSpawns(){
  const list=coreSpawns.match(/pub const SPAWNS:\s*\[\(f32,\s*f32\);\s*4\]\s*=\s*\[([\s\S]*?)\];/)?.[1];
  assert.ok(list,"Core8C original Rust SPAWNS are mandatory");
  return [...list.matchAll(/\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)/g)].map(([,x,y])=>point(Number(x),Number(y)));
}

// Physics6's Rust is allowed to be conservative: this is the geometry of
// the known 23 fixed AABBs, not full terrain/river/dynamic world collisions.
function intersectsKnownStatic(from,to,radius=FIGHTER_RADIUS){
  return authoredSolids.some(r=>{
    let entry=0,exit=1;
    for(const [axis,min,max] of [
      ["x",r.min_x-radius,r.max_x+radius],["y",r.min_y-radius,r.max_y+radius]
    ]){
      const delta=to[axis]-from[axis],origin=from[axis];
      if(delta===0){if(origin<min||origin>max)return false;continue;}
      const near=(min-origin)/delta,far=(max-origin)/delta;
      entry=Math.max(entry,Math.min(near,far));
      exit=Math.min(exit,Math.max(near,far));
      if(entry>exit)return false;
    }
    return true;
  });
}
const assertOpen=(point,label)=>assert.equal(intersectsKnownStatic(point,point),false,label);

test("all 15 authored building bounds plus eight drawn gates match Physics6 generated Rust and reviewed JSON",()=>{
  const {map,city}=validateGreyhavenAlphaFoundation();
  assert.equal(map,AUTHORED_MAPS[MAP_IDS.overworld]);
  assert.equal(map.kind,"outdoor");
  assert.deepEqual([map.width,map.height],[8192,8192]);
  assert.deepEqual([city.x,city.y,city.w,city.h],[3520,3460,1240,1290]);
  assert.equal(WORLD_ALPHA_SOLIDS_LAYOUT_ID,"moonvale-greyhaven-v10-solids-v1");
  assert.equal(fixture.layout_id,WORLD_ALPHA_SOLIDS_LAYOUT_ID);
  assert.equal(fixture.map_id,map.id);
  assert.equal(fixture.city_id,city.id);
  assert.equal(fixture.solids_count,23);
  assert.equal(fixture.includes_river_or_dynamic_solids,false);
  const jsonSolids=fixture.solids.map(rectValue);
  const authored=authoredSolids.map(rectValue);
  assert.equal(map.buildings.length,15);
  assert.deepEqual(authored,jsonSolids);
  assert.deepEqual(rustSolids(),jsonSolids);
  for(const b of map.buildings){
    const expected={id:"building:"+b.id,kind:"building",min_x:b.x,min_y:b.y,
      max_x:b.x+b.w,max_y:b.y+b.h};
    assert.deepEqual(authored.find(s=>s.id===expected.id),expected,
      "authoring-vs-Rust building footprint "+b.id);
  }
  assert.equal(authored.filter(s=>s.kind==="building").length,15);
  assert.equal(authored.filter(s=>s.kind==="city-wall").length,8);
  const hash=createHash("sha256").update(JSON.stringify(jsonSolids)).digest("hex");
  assert.equal(hash,"9bb023c95d86821f219113d71b6e480789a72df064f083790e746d79423b3f43");
  assert.equal(fixture.solids_sha256,hash);
  assert.match(rustGenerated,new RegExp(hash));
  assert.equal(WORLD_ALPHA_CITY_WALL_WIDTH,37);
  assert.deepEqual([WORLD_ALPHA_GATE_X,WORLD_ALPHA_GATE_Y,
    WORLD_ALPHA_GATE_X_HALF,WORLD_ALPHA_GATE_Y_HALF],[4130,4180,73,68]);
});

test("all four World9 staging seats equal original Core8C Rust SPAWNS and do not overlap walls or each other",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  const fromServer=rustSpawns();
  assert.deepEqual(fromServer,[
    point(4110,4160),point(4206,4160),point(4110,4256),point(4206,4256)
  ]);
  assert.deepEqual(authoring.spawns,fromServer);
  assert.deepEqual(map.spawn,fromServer[0]);
  const seen=new Set();
  for(const [i,s] of fromServer.entries()){
    assert.ok(s.x>=FIGHTER_RADIUS&&s.x<=map.width-FIGHTER_RADIUS);
    assert.ok(s.y>=FIGHTER_RADIUS&&s.y<=map.height-FIGHTER_RADIUS);
    assertOpen(s,"Rust spawn "+i+" collides with authored fixed solid");
    assert.ok(!seen.has(s.x+":"+s.y),"duplicate server spawn");
    seen.add(s.x+":"+s.y);
    for(const other of fromServer.slice(0,i))
      assert.ok(Math.hypot(s.x-other.x,s.y-other.y)>=FIGHTER_RADIUS*2,
        "two server actors would overlap at admission");
  }
  assert.match(coreSpawns,/f\.spawn_x,\s*f\.spawn_y/);
  assert.match(coreSpawns,/FIGHTER_DIAMETER_SQUARED/);
  assert.match(coreSpawns,/DEFAULT_WORLD_WIDTH/);
  assert.match(originalServer,/greyhaven_alpha::free_spawn\(&state\.world\)/);
  assert.match(originalServer,/state\.world\.add_player_at\(player_id, x, y, 0\.0\)/);
});

test("original named landmarks and Red Lion visual door never become actor teleport destinations",()=>{
  const {map,lion,smith,view}=validateGreyhavenAlphaFoundation();
  assert.deepEqual([lion.x,lion.y,lion.w,lion.h],[4240,3880,250,170]);
  assert.deepEqual([smith.x,smith.y,smith.w,smith.h],[3710,3850,182,162]);
  assert.deepEqual(lion.entrance,point(4365,4060));
  assert.deepEqual(authoring.landmarks.redLionDoor,lion.entrance);
  assert.deepEqual(authoring.landmarks.redLionWalkableApproach,point(4365,4080));
  assert.deepEqual(authoring.landmarks.smith,point(3820,4088));
  assert.deepEqual(authoring.landmarks.marketWest,point(4230,4380));
  assert.deepEqual(authoring.landmarks.chapelSouth,point(4590,3850));
  assert.equal(smith.entrance,undefined,"do not fabricate a Blacksmith door");
  assert.equal(map.buildings.filter(b=>b.entrance).length,1);
  assert.equal(map.buildings.filter(b=>b.portal).length,1);
  assert.equal(map.buildings.find(b=>b.portal)?.id,"red-lion");

  assert.equal(intersectsKnownStatic(lion.entrance,lion.entrance),true,
    "visual door is only 10 units from wall; radius18 actor must NOT spawn/teleport here");
  assert.equal(intersectsKnownStatic(point(4365,4068),point(4365,4068)),true,
    "exact-radius contact is blocking in Physics6");
  assertOpen(authoring.landmarks.redLionWalkableApproach,"Red Lion outdoors");
  assertOpen(point(4365,4070),"reachable radius18 frontage near Red Lion south wall");
  assert.equal(intersectsKnownStatic(point(4365,4080),point(4365,4020)),true,
    "attempted forward move through Red Lion wall must be denied");
  for(const [label,p] of Object.entries(authoring.landmarks)){
    if(label!=="redLionDoor")assertOpen(p,"non-door landmark "+label);
  }
  const entranceMeta=map.portals.find(p=>p.id==="red-lion-enter");
  assert.deepEqual(point(entranceMeta.x,entranceMeta.y),point(4365,4075));
  assert.equal(view.visualDepthY,4075,"visual depth is not collision or transfer");
  assert.equal(entranceMeta.radius,52);
  assert.equal(authoring.hasPortalAuthority,false);
  assert.equal(authoring.hasItemAuthority,false);
  assert.equal(authoring.serverStaticCollisionActiveByDefault,false);
  assert.doesNotMatch(actualClient,/\b(?:nearbyAuthoredPortal|previewPortalDestination)\s*\(/,
    "live Greyhaven client must not trigger offline preview portals");
  assert.doesNotMatch(originalServer,/\b(?:previewPortalDestination|nearbyAuthoredPortal|red-lion-enter|red-lion-exit)\b/,
    "original Rust QUIC World has no tavern entrance/transition implementation");
});

test("four original city-wall openings align with authored road corridors, not unauthorized portals",()=>{
  const roads=getAuthoredMap(MAP_IDS.overworld).roads;
  assert.ok(roads.some(r=>r.id==="kings-road-west"));
  assert.ok(roads.some(r=>r.id==="kings-road-east"));
  assert.ok(roads.some(r=>r.id==="northern-road"));
  assert.ok(roads.some(r=>r.id==="southern-road"));
  const crossings=[
    [point(3470,4180),point(3570,4180)],
    [point(4710,4180),point(4810,4180)],
    [point(4130,3410),point(4130,3510)],
    [point(4130,4700),point(4130,4800)]
  ];
  for(const [i,[from,to]] of crossings.entries())
    assert.equal(intersectsKnownStatic(from,to),false,"original gate "+i+" must stay passable");
  assert.equal(intersectsKnownStatic(point(3470,4000),point(3570,4000)),true,
    "cannot cross solid west wall outside the authored gate");
  assert.equal(intersectsKnownStatic(point(4710,4000),point(4810,4000)),true,
    "cannot cross solid east wall outside the authored gate");
  for(let i=1;i<authoring.route.length;i++)
    assert.equal(intersectsKnownStatic(authoring.route[i-1],authoring.route[i]),false,
      "authored promenade leg "+i+" crosses a known solid");
});

test("native wall acceptance uses the canonical facade bounds and genuine two-step keyboard motion",()=>{
  const harness=read("tools/world9/greyhaven_alpha_two_native.mjs");
  assert.match(harness,/getAuthoredMap\(MAP_IDS\.overworld\)/);
  assert.match(harness,/a\.x>redLion\.x\+faceMargin/);
  assert.match(harness,/a\.x<redLion\.x\+redLion\.w-faceMargin/);
  assert.match(harness,/redLion\.y\+redLion\.h\+18-1/);
  assert.match(harness,/duration:120/);
  assert.match(harness,/physicalBuildingCollisionProven=true/);
  assert.match(harness,/W3C A key gesture/);
});

test("no client-selected server map revision, portal activation or public server bind",()=>{
  assert.match(originalServer,/MYASO_WORLD9_GREYHAVEN_ALPHA/);
  assert.match(originalServer,/bind\.ip\(\)\.is_loopback\(\)/);
  assert.match(originalServer,/enable_greyhaven_static_collisions\(\)/);
  assert.match(originalServer,/state\.world\.add_player\(player_id\)/);
  assert.match(actualClient,/params\.get\("world"\) === "1"/);
  assert.match(actualClient,/params\.get\("greyhaven"\) === "1"/);
  assert.match(actualClient,/!params\.has\("scenario"\)/);
  assert.equal(authoring.mapId,MAP_IDS.overworld);
  assert.equal(fixture.geometry_kind,"fixed-buildings-and-city-walls");
  assert.equal(fixture.requires_core_fence,true);
  assert.equal(fixture.includes_river_or_dynamic_solids,false);
  assert.ok(!("complete" in fixture),"known 23-solid set cannot claim complete world geometry");
  assert.ok(!("workerEpoch" in fixture),"authored map is not server-authorized worker state");
});
