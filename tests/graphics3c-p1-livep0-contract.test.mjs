import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {WORLD_ALPHA_REPLACEABLE_BUILDING_IDS,
  normalizeWorldBuildingReplacementIds} from "../src/world/building-presentation.mjs";
import {createAuthoredWorldRenderer} from "../src/browser/authored-world-renderer.mjs";

const root=new URL("../",import.meta.url);

test("live P0 online client does not import or activate the optional Greyhaven renderer",()=>{
  const online=readFileSync(new URL("web/online-game.mjs",root),"utf8");
  assert.doesNotMatch(online,/authored-world-renderer|greyhavenTimeOfDay|greyhaven-terrain-materials|greyhaven-atmosphere/);
});

test("transplanted World9 map and building contract retain visual-only boundaries",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  assert.equal(MAP_IDS.overworld,"moonvale-overworld");
  assert.ok(map&&map.kind==="outdoor");
  assert.deepEqual(WORLD_ALPHA_REPLACEABLE_BUILDING_IDS,["red-lion"]);
  assert.deepEqual(normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["red-lion"]),["red-lion"]);
  assert.throws(()=>normalizeWorldBuildingReplacementIds(MAP_IDS.overworld,["smith"]),RangeError);
  const renderer=createAuthoredWorldRenderer();
  assert.deepEqual(renderer.replacedBuildingIds,[]);
  assert.equal(renderer.greyhavenTimeOfDay,"legacy");
});
