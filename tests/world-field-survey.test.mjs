import test from "node:test";
import assert from "node:assert/strict";
import { MAP_IDS, getAuthoredMap } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable, moveAuthoredPreview } from "../src/world/authored-preview-collision.mjs";
import {
  FIELD_SURVEY_MANIFEST_VERSION, FIELD_SURVEY_REACH, MOONVALE_FIELD_SITES,
  createLocalFieldNotebook, nearbyLocalFieldSite, observeLocalFieldSite,
  localFieldSurveyProgress,
} from "../src/world/field-survey.mjs";

test("D6 fixed survey manifest contains eight unique, walkable world positions", () => {
  const map = getAuthoredMap(MAP_IDS.overworld);
  assert.equal(FIELD_SURVEY_MANIFEST_VERSION, 1);
  assert.equal(FIELD_SURVEY_REACH, 68);
  assert.equal(MOONVALE_FIELD_SITES.length, 8);
  assert.equal(new Set(MOONVALE_FIELD_SITES.map(s => s.id)).size, 8);
  assert.ok(Object.isFrozen(MOONVALE_FIELD_SITES));
  for (const site of MOONVALE_FIELD_SITES) {
    assert.ok(Object.isFrozen(site));
    assert.match(site.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(site.mapId, map.id);
    assert.ok(["botany","geology","forestry"].includes(site.category));
    assert.ok(site.clue.length > 20 && site.observation.length > 20);
    assert.ok(isAuthoredPreviewWalkable(site.mapId, site.x, site.y), site.id);
    assert.equal(nearbyLocalFieldSite(site.mapId,site.x,site.y)?.id,site.id);
    assert.ok(site.x >= 18 && site.y >= 18);
    assert.ok(site.x <= map.width-18 && site.y <= map.height-18);
  }
});

test("D6 F-action observation is once-only, ordered and session local", () => {
  const first = createLocalFieldNotebook();
  const second = createLocalFieldNotebook();
  assert.deepEqual(localFieldSurveyProgress(first), { documented: 0, total: 8 });
  for (const site of MOONVALE_FIELD_SITES) {
    assert.equal(observeLocalFieldSite(first,site.mapId,site.x,site.y)?.id,site.id);
    assert.equal(observeLocalFieldSite(first,site.mapId,site.x,site.y),null);
  }
  assert.deepEqual(localFieldSurveyProgress(first), { documented: 8, total: 8 });
  assert.deepEqual(localFieldSurveyProgress(second), { documented: 0, total: 8 });
  const firstSite=MOONVALE_FIELD_SITES[0];
  assert.equal(observeLocalFieldSite(second,firstSite.mapId,firstSite.x,firstSite.y)?.id,firstSite.id);
  assert.equal(createLocalFieldNotebook().size,0);
});

test("D6 surveyed flora and ore give no inventory/currency/skill reward", () => {
  const notebook=createLocalFieldNotebook();
  const site=MOONVALE_FIELD_SITES[0];
  const result=observeLocalFieldSite(notebook,site.mapId,site.x,site.y);
  assert.strictEqual(result,site);
  assert.deepEqual(Object.keys(result),
    ["id","name","category","mapId","x","y","clue","observation"]);
  for(const forbidden of ["reward","item","stock","gold","coin","harvest","xp","wallet","amount"])
    assert.ok(!Object.hasOwn(result,forbidden),forbidden);
  notebook.add("forged-resource");
  assert.deepEqual(localFieldSurveyProgress(notebook), {documented:1,total:8});
});

test("D6 wrong map, nonfinite/unreachable coordinates and forged requests fail closed", () => {
  const site=MOONVALE_FIELD_SITES[0];
  const notebook=createLocalFieldNotebook();
  const invalid=[
    [MAP_IDS.tavern,site.x,site.y],
    ["unknown-world",site.x,site.y],
    [site.mapId,NaN,site.y],
    [site.mapId,Infinity,site.y],
    [site.mapId,site.x,-1],
    [site.mapId,8199,site.y],
    [site.mapId,site.x,Infinity],
    [site.mapId,4365,4000], // inside Red Lion roof
    [site.mapId,1940,3840], // unbridged river
    [site.mapId,250,250], // too far from any site
  ];
  for(const [map,x,y] of invalid) {
    assert.equal(nearbyLocalFieldSite(map,x,y),null, `${map} ${x},${y}`);
    assert.equal(observeLocalFieldSite(notebook,map,x,y),null);
  }
  assert.equal(observeLocalFieldSite({},site.mapId,site.x,site.y),null);
  assert.deepEqual(localFieldSurveyProgress(null),{documented:0,total:8});
  assert.equal(notebook.size,0);
});

test("D6 inspection reach is spatial, inclusive, and does not auto-document travel", () => {
  const site=MOONVALE_FIELD_SITES[0];
  const notebook=createLocalFieldNotebook();
  assert.equal(notebook.size,0);
  const close={x:site.x+FIELD_SURVEY_REACH,y:site.y};
  if(isAuthoredPreviewWalkable(site.mapId,close.x,close.y))
    assert.equal(nearbyLocalFieldSite(site.mapId,close.x,close.y)?.id,site.id);
  const remote={x:site.x+FIELD_SURVEY_REACH+1,y:site.y};
  if(isAuthoredPreviewWalkable(site.mapId,remote.x,remote.y))
    assert.notEqual(nearbyLocalFieldSite(site.mapId,remote.x,remote.y)?.id,site.id);
  // Ordinary walking cannot record resource observation.
  const walked=moveAuthoredPreview(site.mapId,{x:site.x,y:site.y},8,0);
  assert.ok(walked);
  assert.equal(notebook.size,0);
  assert.equal(observeLocalFieldSite(notebook,site.mapId,site.x,site.y)?.id,site.id);
});

test("D6 survey IDs, output and progress never expose mutable world resources", () => {
  const site=MOONVALE_FIELD_SITES[1];
  const notebook=createLocalFieldNotebook();
  const result=observeLocalFieldSite(notebook,site.mapId,site.x,site.y);
  assert.ok(result && Object.isFrozen(result));
  assert.equal(notebook.size,1);
  assert.ok(Object.isFrozen(localFieldSurveyProgress(notebook)));
  assert.equal(nearbyLocalFieldSite(MAP_IDS.tavern,390,480),null);
});
