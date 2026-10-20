import assert from "node:assert/strict";
import test from "node:test";
import {MAP_IDS,AUTHORED_MAPS} from "../src/world/authored-maps.mjs";
import {createGreyhavenLightingPlan,paintGreyhavenLightingPools,
  paintGreyhavenLightingFixtures,GREYHAVEN_LIGHTING_VERSION}
  from "../src/browser/greyhaven-atmosphere.mjs";

const map=AUTHORED_MAPS[MAP_IDS.overworld];
const tile={x:4096,y:4096,width:512,height:512};

test("P2.4 source-owned static lighting is deterministic and map-pure",()=>{
  assert.equal(GREYHAVEN_LIGHTING_VERSION,"3c-p24-1");
  const original=JSON.stringify(map);
  const first=createGreyhavenLightingPlan(map,tile);
  assert.deepEqual(first,createGreyhavenLightingPlan(map,tile));
  assert.equal(JSON.stringify(map),original);
  assert.ok(first.some(l=>l.id==="red-lion"));
  assert.ok(first.some(l=>l.id==="market"));
  assert.ok(first.length<=5);
  for(const light of first){
    const building=map.buildings.find(b=>b.id===light.id);
    assert.ok(building);
    assert.equal(light.fixtureY,building.y+building.h-5);
    assert.equal(light.poolY,building.y+building.h+19);
  }
});

test("P2.4 culls invalid and distant world tiles",()=>{
  assert.deepEqual(createGreyhavenLightingPlan(map,{x:7000,y:7000,width:512,height:512}),[]);
  assert.deepEqual(createGreyhavenLightingPlan(AUTHORED_MAPS[MAP_IDS.tavern],tile),[]);
  assert.deepEqual(createGreyhavenLightingPlan(map,{...tile,width:Infinity}),[]);
  assert.deepEqual(createGreyhavenLightingPlan(map,{...tile,height:513}),[]);
  assert.deepEqual(createGreyhavenLightingPlan(null,tile),[]);
});

test("P2.4 radial lighting crosses tile seams at fixed world coordinates",()=>{
  const north=createGreyhavenLightingPlan(map,{x:4096,y:4096,width:512,height:512});
  const south=createGreyhavenLightingPlan(map,{x:4096,y:4608,width:512,height:512});
  const marketNorth=north.find(l=>l.id==="market");
  const marketSouth=south.find(l=>l.id==="market");
  assert.ok(marketNorth && marketSouth);
  assert.deepEqual(marketNorth,marketSouth);
});

test("P2.4 lights are cosmetic Canvas-only and use bounded gradient stops",()=>{
  const events={gradients:0,stops:0,glows:0,fixtures:0};
  const ctx={
    createRadialGradient(){events.gradients++;return {addColorStop(){events.stops++;}};},
    fillRect(){events.fixtures++;},beginPath(){},arc(){},fill(){events.glows++;},
    moveTo(){},lineTo(){},stroke(){}
  };
  const plan=createGreyhavenLightingPlan(map,tile);
  paintGreyhavenLightingPools(ctx,map,tile);
  paintGreyhavenLightingFixtures(ctx,map,tile);
  assert.equal(events.gradients,plan.length);
  assert.equal(events.stops,plan.length*3);
  assert.ok(events.fixtures>0);
  assert.ok(events.glows>=plan.length);
  assert.ok(events.gradients<=5);
  // Mock contexts lacking CanvasGradient do not throw or create hidden effects.
  assert.equal(paintGreyhavenLightingPools({},map,tile),0);
});
