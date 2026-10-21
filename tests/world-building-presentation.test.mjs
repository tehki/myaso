import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MAP_IDS,AUTHORED_MAPS,previewPortalDestination} from "../src/world/authored-maps.mjs";
import {createAuthoredWorldRenderer,WORLD_TILE_SIZE,WORLD_CACHE_CAP} from "../src/browser/authored-world-renderer.mjs";
import {WORLD_BUILDING_PRESENTATION_VERSION,WORLD_ALPHA_REPLACEABLE_BUILDING_IDS,
  normalizeWorldBuildingReplacementIds,worldBuildingPresentation} from "../src/world/building-presentation.mjs";

function canvasProbe() {
  const events=[];
  const ctx={events};
  for(const op of ["beginPath","moveTo","lineTo","fill","stroke","save","restore",
    "translate","fillRect","strokeRect","fillText","arc","ellipse","drawImage"]){
    ctx[op]=(...args)=>{events.push({op,args});};
  }
  return ctx;
}
function drawRenderer(options={}) {
  const tiles=[];
  const makeCanvas=()=>{
    const context=canvasProbe();
    tiles.push(context);
    return {getContext:()=>context};
  };
  const renderer=createAuthoredWorldRenderer({...options,makeCanvas,buildLimit:3});
  const canvas=canvasProbe();
  renderer.draw(canvas,MAP_IDS.overworld,{x:4365,y:4075},640,640,.84);
  return {renderer,tiles,canvas};
}
const count=(tiles,op,pred)=>tiles.reduce((n,c)=>n+c.events.filter(e=>e.op===op&&pred(e.args)).length,0);
test("Alpha World contract identifies one Red Lion by stable ID, not raw rectangle",()=>{
  assert.equal(WORLD_BUILDING_PRESENTATION_VERSION,1);
  assert.deepEqual(WORLD_ALPHA_REPLACEABLE_BUILDING_IDS,["red-lion"]);
  assert.ok(Object.isFrozen(WORLD_ALPHA_REPLACEABLE_BUILDING_IDS));
  const data=worldBuildingPresentation(MAP_IDS.overworld,"red-lion");
  assert.ok(data&&Object.isFrozen(data));
  assert.deepEqual(data.footprint,{x:4240,y:3880,w:250,h:170});
  assert.deepEqual(data.gameplayEntrance,{x:4365,y:4060});
  assert.deepEqual(data.interactionPortal,{id:"red-lion-enter",x:4365,y:4075,radius:52});
  assert.equal(data.visualDepthY,4075);
  assert.ok(Object.isFrozen(data.footprint)&&Object.isFrozen(data.gameplayEntrance));
  assert.ok(Object.isFrozen(data.interactionPortal));
  assert.deepEqual(previewPortalDestination(MAP_IDS.overworld,"red-lion-enter"),
    {mapId:MAP_IDS.tavern,x:390,y:480});
});
test("Alpha unchanged default renderer still draws original World placeholder",()=>{
  const {renderer,tiles}=drawRenderer();
  assert.equal(WORLD_TILE_SIZE,512);
  assert.equal(WORLD_CACHE_CAP,24);
  assert.deepEqual(renderer.replacedBuildingIds,[]);
  assert.ok(Object.isFrozen(renderer.replacedBuildingIds));
  assert.equal(tiles.length,3);
  assert.equal(count(tiles,"fillText",a=>a[0]==="RED LION"),3);
  assert.equal(count(tiles,"fillRect",a=>a[0]===4240&&a[1]===3880&&a[2]===250&&a[3]===170),3);
});
test("Alpha opt-in replacement removes only Red Lion placeholder from CACHED tiles",()=>{
  const original=drawRenderer();
  const switched=drawRenderer({replacedBuildingIds:["red-lion"]});
  assert.equal(switched.tiles.length,3);
  assert.deepEqual(switched.renderer.replacedBuildingIds,["red-lion"]);
  assert.equal(count(switched.tiles,"fillText",a=>a[0]==="RED LION"),0);
  assert.equal(count(switched.tiles,"fillRect",a=>a[0]===4240&&a[1]===3880&&a[2]===250&&a[3]===170),0);
  // All other World-owned 14 buildings are unchanged, including Blacksmith.
  const smith=a=>a[0]===3710&&a[1]===3850&&a[2]===182&&a[3]===162;
  assert.equal(count(switched.tiles,"fillRect",smith),count(original.tiles,"fillRect",smith));
  assert.equal(count(switched.tiles,"fillRect",smith),3);
  // All authored outdoor portal indicators survive despite the building art swap.
  const entrance=a=>a[0]===4365&&a[1]===4075&&a[2]===17;
  assert.equal(count(switched.tiles,"arc",entrance),count(original.tiles,"arc",entrance));
  assert.equal(count(switched.tiles,"arc",entrance),3);
  assert.ok(switched.renderer.stats.created<=3&&switched.renderer.stats.cached<=24);
});
test("Alpha renderer cached replacement remains stable and all geometry is immutable",()=>{
  const map=AUTHORED_MAPS[MAP_IDS.overworld],snapshot=JSON.stringify(map);
  const {renderer,tiles,canvas}=drawRenderer({replacedBuildingIds:["red-lion"]});
  renderer.draw(canvas,MAP_IDS.overworld,{x:4365,y:4075},640,640,.84);
  assert.equal(renderer.stats.created,3);
  assert.ok(renderer.stats.cached<=24);
  assert.equal(count(tiles,"fillText",a=>a[0]==="RED LION"),0);
  assert.equal(JSON.stringify(map),snapshot);
  assert.ok(map.buildings.find(b=>b.id==="red-lion"));
  assert.equal(map.portals[0].id,"red-lion-enter");
});
test("Alpha replacement is strictly opt-in, named, unique and fail-closed",()=>{
  assert.deepEqual(normalizeWorldBuildingReplacementIds(MAP_IDS.overworld),[]);
  assert.deepEqual(normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["red-lion"]),["red-lion"]);
  for(const invalid of [["red-lion","red-lion"],["smith"],["RED LION"],[null],"red-lion",{},null]){
    assert.throws(()=>createAuthoredWorldRenderer({replacedBuildingIds:invalid}),RangeError);
  }
  assert.throws(()=>normalizeWorldBuildingReplacementIds(MAP_IDS.tavern,[]),RangeError);
  assert.equal(worldBuildingPresentation(MAP_IDS.tavern,"red-lion"),null);
  assert.equal(worldBuildingPresentation(MAP_IDS.overworld,"smith"),null);
});
test("Alpha visual depth split preserves actor order and is not collision authority",()=>{
  const actors=[{id:"north",x:4365,y:4050},{id:"threshold",x:4365,y:4075},
    {id:"south",x:4365,y:4095},{id:"far",x:5000,y:4100}];
  const original=JSON.stringify(actors);
  const p=worldBuildingPresentation(MAP_IDS.overworld,"red-lion",actors);
  assert.deepEqual(p.actorsBehind.map(a=>a.id),["north"]);
  assert.deepEqual(p.actorsInFront.map(a=>a.id),["threshold","south","far"]);
  assert.ok(Object.isFrozen(p.actorsBehind)&&Object.isFrozen(p.actorsInFront));
  assert.equal(JSON.stringify(actors),original);
  assert.equal(worldBuildingPresentation(MAP_IDS.overworld,"red-lion",[{x:NaN,y:4075}]),null);
  assert.equal(worldBuildingPresentation(MAP_IDS.overworld,"red-lion",new Array(257).fill({x:0,y:0})),null);
  assert.equal(p.placeholderSuppressedByDefault,false);
});
test("Alpha shared interface is presentation only and preserves core online default",()=>{
  const source=readFileSync(new URL("../src/world/building-presentation.mjs",import.meta.url),"utf8");
  const renderer=readFileSync(new URL("../src/browser/authored-world-renderer.mjs",import.meta.url),"utf8");
  const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
  assert.match(renderer,/if\(!replacedBuildings\.has\(b\.id\)\)paintBuilding\(ctx,b\)/);
  assert.match(renderer,/replacedBuildingIds=\[\]/);
  assert.doesNotMatch(source,/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|window\.|document\./);
  assert.doesNotMatch(source,/import.*server|import.*combat|import.*network/);
  assert.doesNotMatch(online,/replacedBuildingIds\s*:/,
    "Alpha opt-in must not turn on facade suppression until Graphics has replacement ready");
});
