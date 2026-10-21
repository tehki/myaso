// Graphics 3C P0: evidence-only cross-branch armory scene seam with World #493.
// Read the real socket module from an independent EXACT-HEAD World worktree.
// The socket's ID is a fixture ID, NOT a sword/item ID or pickup permission.
// Never changes source map, server, weapons, camera, viewport or runtime client.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";
import {MAP_IDS,getAuthoredMap} from "../../src/world/authored-maps.mjs";
import {createGreyhavenTerrainPlan} from "../../src/browser/greyhaven-terrain-materials.mjs";
import {createGreyhavenLightingPlan} from "../../src/browser/greyhaven-atmosphere.mjs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../../src/browser/arena-viewport.mjs";

const reference=process.argv[2];
const destination=process.argv[3]||"assets/environment/greyhaven/3c-p30-world493-review";
const expected=process.env.WORLD_ALPHA_EXPECTED_HEAD;
if(!reference||!expected||!/^[a-f0-9]{40}$/i.test(expected))
  throw Error("Usage: WORLD_ALPHA_EXPECTED_HEAD=<40-char exact SHA> node script <independent World checkout> [output folder]");
const checkout=resolve(reference);
const actual=spawnSync("git",["-C",checkout,"rev-parse","HEAD"],{encoding:"utf8"});
if(actual.status!==0||actual.stdout.trim()!==expected)
  throw Error("World checkout is not the exact approved PR head; wanted "+expected+", found "+actual.stdout.trim());
const worldModule=await import(pathToFileURL(join(checkout,"src/world/alpha-armory.mjs")).href);
const worldMapModule=await import(pathToFileURL(join(checkout,"src/world/authored-maps.mjs")).href);
const {WORLD_ALPHA_SWORD_RACK_SOCKETS:sockets,WORLD_ALPHA_ARMORY,
  WORLD_ALPHA_SPAWN_COORDINATES:spawns,validateWorldAlphaArmoryLayout}=worldModule;
const map=getAuthoredMap(MAP_IDS.overworld);
const worldMap=worldMapModule.getAuthoredMap(worldMapModule.MAP_IDS.overworld);
assert.equal(JSON.stringify(worldMap),JSON.stringify(map),
  "3C static authored map must match the pinned World #493 staging map before projecting socket points");
assert.equal(validateWorldAlphaArmoryLayout(),true);
assert.equal(WORLD_ALPHA_ARMORY.buildingId,"smith");
assert.equal(WORLD_ALPHA_ARMORY.layout,"outdoor-open-front");
assert.equal(WORLD_ALPHA_ARMORY.requiresZoneTransfer,false);
assert.equal(WORLD_ALPHA_ARMORY.hasImplicitInventory,false);
assert.equal(sockets.length,4);
assert.equal(spawns.length,4);

const b=map.buildings.find(x=>x.id==="smith");
assert.ok(b);
const cam={x:3800,y:4050},screen={width:1100,height:688,zoom:ARENA_VIEW_ZOOM};
const getProjection=p=>projectArenaPoint(p.x,p.y,cam.x,cam.y,screen.width,screen.height,screen.zoom);
const uniqueIds=new Set();
const lightsByAnchor=[];
const results=[];
for(const socket of sockets){
  assert.ok(Object.isFrozen(socket));
  assert.equal(socket.mapId,MAP_IDS.overworld);
  assert.equal(socket.displayCategory,"sword");
  assert.ok(!("worldItemId" in socket) && !("itemId" in socket));
  assert.ok(!("clickShape" in socket) && !("owner" in socket),
    "World fixture alone cannot mint a clickable authoritative sword");
  assert.ok(!uniqueIds.has(socket.socketId));uniqueIds.add(socket.socketId);
  assert.equal(worldModule.getWorldAlphaSwordSocket(socket.socketId),socket);
  assert.ok(socket.x>=b.x&&socket.x<=b.x+b.w&&socket.y>b.y+b.h,
    "sockets are outside southern facade");
  assert.ok(socket.approach.y>socket.y && socket.approach.x===socket.x);
  const rect={x:Math.floor(socket.x/512)*512,
    y:Math.floor(socket.y/512)*512,width:512,height:512};
  const ground=createGreyhavenTerrainPlan(map,rect);
  const lights=createGreyhavenLightingPlan(map,rect);
  const smithLight=lights.find(x=>x.id==="smith");
  assert.ok(smithLight,"3C Blacksmith practical light should remain present");
  const distance=Math.hypot(socket.x-smithLight.x,socket.y-smithLight.fixtureY);
  assert.ok(distance>22,
    "current small 3C facade lamp fixture center must remain outside immediate 22-world-unit sword anchor neighborhood");
  const anchorScreen=getProjection(socket),approachScreen=getProjection(socket.approach);
  assert.ok(anchorScreen.x>0&&anchorScreen.x<screen.width&&
    anchorScreen.y>0&&anchorScreen.y<screen.height,"candidate rack must project into game viewport");
  assert.equal(Number((approachScreen.y-anchorScreen.y).toFixed(4)),
    Number((50*ARENA_VIEW_ZOOM).toFixed(4)),"player approach and sword visual use identical camera transform");
  // The painter is a background: record ground and lamp overlap for the art
  // team, never call these static dots a sword, hit mask or authoritative item.
  const neighboring=(points,r)=>points.filter(p=>Math.hypot(p.x-socket.x,p.y-socket.y)<r).length;
  results.push({socketId:socket.socketId,anchor:{x:socket.x,y:socket.y},
    approach:socket.approach,screenAnchor:anchorScreen,screenApproach:approachScreen,
    nearestSmithLampWorldUnits:+distance.toFixed(2),
    staticGroundWithin16:{pavers:neighboring(ground.pavers,16),
      soil:neighboring(ground.soil,16),grass:neighboring(ground.grass,16)},
    providesWorldItemId:false,liveRenderedSword:false,actualPickGeometry:false});
  lightsByAnchor.push({x:smithLight.x,y:smithLight.fixtureY});
}
for(let i=0;i<results.length;i++)for(let j=i+1;j<results.length;j++){
  const a=results[i].screenAnchor,b=results[j].screenAnchor;
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=30,
    "separate rack world anchors must remain spaced by at least 30 screen pixels at online game zoom 0.84");
}
assert.deepEqual(results.map(r=>r.socketId),[
  "greyhaven-rack-1","greyhaven-rack-2",
  "greyhaven-rack-3","greyhaven-rack-4"]);
const candidateRenderer=await readFile(new URL("../../src/browser/authored-world-renderer.mjs",import.meta.url),"utf8");
assert.doesNotMatch(candidateRenderer,/WORLD_ALPHA_SWORD_RACK_SOCKETS|TryPickup|committedItemId/,
  "3C static canvas cache must not stamp permanent swords or invent pickup authority");
const report={
  status:"source_contract_pass_only",
  graphicsSource:"Graphics 3C cached static authored environment",
  worldHead:expected,
  worldArmoryId:WORLD_ALPHA_ARMORY.id,
  camera:cam,viewport:screen,sockets:results,
  tests:{
    pinnedWorldHead:true,mapCompatibility:true,immutableUniqueFixtures:true,
    correctlyProjectedDistinctPixels:true,staticLampClearance:true,
    noItemAuthorityOrSpriteClaim:true,
    actualRenderedSwordPickTest:false,realMultiplayerPickupTest:false
  },
  releaseGate:"BLOCKED: World, Core/Items, UI, Graphics 3B and Combat must integrate real server-owned rack sword art and pickup"
};
const output=resolve(destination);
await mkdir(output,{recursive:true});
await writeFile(join(output,"world493_graphics3c_socket_contract.json"),
  JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
