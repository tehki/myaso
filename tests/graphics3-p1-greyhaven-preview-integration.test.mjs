import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve, dirname} from "node:path";
import {AUTHORED_MAPS, MAP_IDS, getAuthoredMap} from "../src/world/authored-maps.mjs";
import {normalizeWorldBuildingReplacementIds, worldBuildingPresentation} from "../src/world/building-presentation.mjs";
import {visibleWorldTiles, WORLD_CACHE_CAP} from "../src/browser/authored-world-renderer.mjs";
import {createGreyhavenTerrainPlan} from "../src/browser/greyhaven-terrain-materials.mjs";
import {createGreyhavenLightingPlan} from "../src/browser/greyhaven-atmosphere.mjs";

const here=dirname(fileURLToPath(import.meta.url));
const client=readFileSync(resolve(here,"../web/online-game.mjs"),"utf8");

test("Graphics 3 P1 is deliberately double opt-in and excluded from QA scenarios",()=>{
  assert.match(client,/params\.get\("world"\) === "1"/);
  assert.match(client,/params\.get\("greyhaven"\) === "1"/);
  assert.match(client,/!params\.has\("scenario"\)/);
  assert.match(client,/if \(greyhavenPreviewRequested\) \{\s*void Promise\.all\(\[/);
  assert.match(client,/import\("\.\.\/src\/browser\/authored-world-renderer\.mjs"\)/);
  assert.match(client,/if \(greyhavenPreview && local\.initialized\)/);
  assert.match(client,/greyhavenPreview\.renderer\.draw\(ctx, greyhavenPreview\.mapId,\s*visualCameraPosition/);
  assert.match(client,/greyhavenPreview = null;/);
  assert.doesNotMatch(client,/^import .*authored-world-renderer/m);
  const graphicsDrawSection=client.split("// Decorative authored roads, terrain, trees and World-owned building outlines")[1]?.split("for (const entity of networkClient.state.values())")[0];
  assert.ok(graphicsDrawSection,"new P1 render section must exist");
  assert.doesNotMatch(graphicsDrawSection,/networkClient\.(sendInput|state\.set)|local\.[xy]\s*=/);
});

test("the canonical World9 Greyhaven building footprints are unchanged, no invented portals",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  assert.equal(map,AUTHORED_MAPS[MAP_IDS.overworld]);
  assert.deepEqual(map.spawn,{x:4110,y:4160});
  assert.equal(map.city.id,"greyhaven");
  assert.deepEqual(
    map.buildings.filter(b=>["red-lion","smith"].includes(b.id))
      .map(b=>({id:b.id,x:b.x,y:b.y,w:b.w,h:b.h})),
    [{id:"red-lion",x:4240,y:3880,w:250,h:170},
      {id:"smith",x:3710,y:3850,w:182,h:162}]
  );
  assert.deepEqual(normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["red-lion"]),["red-lion"]);
  assert.throws(()=>normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["smith"]),RangeError);
  assert.equal(map.buildings.find(b=>b.id==="smith").entrance,undefined);
  const tavern=worldBuildingPresentation(MAP_IDS.overworld,"red-lion",[]);
  assert.equal(tavern.visualDepthY,4075);
  assert.deepEqual(tavern.gameplayEntrance,{x:4365,y:4060});
  assert.equal(tavern.interactionPortal.y,4075);
  assert.equal(worldBuildingPresentation(MAP_IDS.overworld,"smith",[]),null);
});

test("existing authored terrain and lights are bounded visual data only",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  const cityTile={x:4096,y:4096,width:512,height:512};
  const plan=createGreyhavenTerrainPlan(map,cityTile);
  assert.ok(plan.pavers.length<=900);
  assert.ok(plan.soil.length<=80);
  assert.ok(plan.grass.length<=130);
  const lights=createGreyhavenLightingPlan(map,{x:4096,y:3584,width:512,height:512});
  assert.ok(lights.length<=5);
  assert.ok(lights.every(x=>["red-lion","smith","market","chapel","townhouse-b"].includes(x.id)));
  const visible=visibleWorldTiles({x:4110,y:4160},960,540,0.84);
  assert.ok(visible.length>0 && visible.length<=64);
  assert.equal(WORLD_CACHE_CAP,24);
});

test("the World9 renderer never authorizes gameplay and leaves Combat/Chat as current",()=>{
  const renderer=readFileSync(resolve(here,"../src/browser/authored-world-renderer.mjs"),"utf8");
  const authored=readFileSync(resolve(here,"../src/world/authored-maps.mjs"),"utf8");
  assert.match(renderer,/Visual-only renderer/);
  assert.match(authored,/does NOT/);
  assert.match(renderer,/normalizeWorldBuildingReplacementIds/);
  assert.match(client,/chatBubbleController\?\.frame\(/);
  assert.match(client,/connectAuthoritativeClient/);
});
