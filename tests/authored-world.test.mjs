import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {MAP_IDS,AUTHORED_MAPS,getAuthoredMap,nearbyAuthoredPortal,previewPortalDestination}
  from "../src/world/authored-maps.mjs";
import {WORLD_TILE_SIZE,WORLD_CACHE_CAP,visibleWorldTiles,createAuthoredWorldRenderer}
  from "../src/browser/authored-world-renderer.mjs";

test("Moonvale geography is fixed, named, 8192 world units, and includes roads/cities",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  assert.equal(map.width,8192);assert.equal(map.height,8192);
  assert.equal(map.city.name,"GREYHAVEN");
  assert.ok(map.roads.length>=5);
  assert.ok(map.buildings.length>=12);
  assert.ok(map.groves.every(g=>g.trees.every(t=>t.length===2)));
  assert.ok(map.buildings.some(b=>b.name==="The Red Lion Inn"));
  assert.deepEqual(map,AUTHORED_MAPS[MAP_IDS.overworld]);
  assert.equal(getAuthoredMap("missing"),null);
});

test("Tavern interior is intentionally larger than exterior and links are reciprocal",()=>{
  const outdoor=getAuthoredMap(MAP_IDS.overworld);
  const tavern=getAuthoredMap(MAP_IDS.tavern);
  const footprint=outdoor.buildings.find(b=>b.id==="red-lion");
  assert.ok(tavern.width>footprint.w && tavern.height>footprint.h);
  const enter=outdoor.portals[0],exit=tavern.portals[0];
  assert.equal(enter.targetMap,tavern.id);assert.equal(enter.targetPortal,exit.id);
  assert.equal(exit.targetMap,outdoor.id);assert.equal(exit.targetPortal,enter.id);
  const inside=previewPortalDestination(outdoor.id,enter.id);
  assert.deepEqual(inside,{mapId:tavern.id,x:390,y:480});
  const outside=previewPortalDestination(tavern.id,exit.id);
  assert.deepEqual(outside,{mapId:outdoor.id,x:4365,y:4143});
});

test("Portals require authored proximity, finite input and known reciprocal links",()=>{
  assert.equal(nearbyAuthoredPortal(MAP_IDS.overworld,4365,4075)?.id,"red-lion-enter");
  assert.equal(nearbyAuthoredPortal(MAP_IDS.overworld,4365,4500),null);
  assert.equal(nearbyAuthoredPortal(MAP_IDS.tavern,390,550)?.id,"red-lion-exit");
  assert.equal(nearbyAuthoredPortal(MAP_IDS.overworld,NaN,4075),null);
  assert.equal(nearbyAuthoredPortal(MAP_IDS.overworld,4365,4075,300),null);
  assert.equal(previewPortalDestination(MAP_IDS.overworld,"crafted-id"),null);
});

test("World tile list is deterministic and bounded across zoom/camera",()=>{
  const a=visibleWorldTiles({x:4100,y:4100},1100,688,.86);
  const b=visibleWorldTiles({x:4100+WORLD_TILE_SIZE,y:4100},1100,688,.86);
  assert.ok(a.length>1&&a.length<25);
  assert.deepEqual(a.map(x=>[x.x+1,x.y]),b.map(x=>[x.x,x.y]));
  assert.equal(visibleWorldTiles({x:100,y:100},20000,20000,.4).length,64);
  assert.throws(()=>visibleWorldTiles({x:0,y:0},1100,688,0),/invalid/);
});

test("World draws at most bounded new static chunks each frame and caps cache",()=>{
  let contextsCreated=0;
  const fakeTileCtx={
    save(){},restore(){},translate(){},fillRect(){},strokeRect(){},
    beginPath(){},moveTo(){},lineTo(){},arc(){},ellipse(){},fill(){},stroke(){},fillText(){},
  };
  const makeCanvas=()=>{contextsCreated++;return {width:0,height:0,getContext:()=>fakeTileCtx};};
  const events=[];
  const fakeCtx={save(){},restore(){},translate(){},
    fillRect:(...p)=>events.push(["fill",...p]),
    drawImage:(...p)=>events.push(["tile",...p])};
  const world=createAuthoredWorldRenderer({makeCanvas,cacheCap:6,buildLimit:2});
  world.draw(fakeCtx,MAP_IDS.overworld,{x:4100,y:4100},1100,688,.86);
  assert.equal(world.stats.created,2);
  assert.ok(events.some(e=>e[0]==="tile"));
  for(let i=0;i<20;i++)world.draw(fakeCtx,MAP_IDS.overworld,
    {x:4100+i*540,y:4100},1100,688,.86);
  assert.ok(world.stats.cached<=6&&contextsCreated>=2);
  world.clear();
  assert.equal(world.stats.cached,0);
  assert.equal(WORLD_CACHE_CAP,24);
  assert.throws(()=>world.draw(fakeCtx,"invalid-map",{x:0,y:0},300,300,.8),/unknown/);
});

test("Authoritative multiplayer uses the fixed visual map only and no local zone teleport",()=>{
  const source=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(source,/params\.get\("world"\) === "1"/);
  assert.match(source,/&& !params\.has\("scenario"\)/);
  const zoom=source.indexOf("ctx.scale(ARENA_VIEW_ZOOM, ARENA_VIEW_ZOOM)");
  const world=source.indexOf("authoredWorld.draw(ctx, MAP_IDS.overworld");
  const fighter=source.indexOf("for (const entity of networkClient.state.values())",world);
  assert.ok(zoom>0&&zoom<world&&world<fighter);
  assert.doesNotMatch(source,/previewPortalDestination|nearbyAuthoredPortal/);
  const preview=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  assert.match(preview,/LOCAL DESIGN PREVIEW/);
  assert.match(preview,/KeyE/);
});
