import assert from "node:assert/strict";
import {test} from "node:test";
import {AUTHORED_MAPS, MAP_IDS} from "../src/world/authored-maps.mjs";
import {GREYHAVEN_MATERIAL_VERSION, createGreyhavenTerrainPlan,
  paintGreyhavenGroundDetails} from "../src/browser/greyhaven-terrain-materials.mjs";
import {createAuthoredWorldRenderer} from "../src/browser/authored-world-renderer.mjs";

const map = AUTHORED_MAPS[MAP_IDS.overworld];
const greyhaven = {x:4096,y:4096,width:512,height:512};

test("3C source-owned Greyhaven materials respect authored map and deterministic inputs", () => {
  assert.equal(GREYHAVEN_MATERIAL_VERSION, "3c-p2-2");
  const before = JSON.stringify(map);
  const a = createGreyhavenTerrainPlan(map, greyhaven);
  const b = createGreyhavenTerrainPlan(map, greyhaven);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(map), before);
  assert.ok(a.pavers.length > 20, "existing King's Road must receive stones");
  assert.ok(a.soil.length > 0, "verges must receive earth");
  assert.ok(a.grass.length > 0, "verges must receive grass");
  assert.ok(a.pavers.length <= 900 && a.grass.length <= 130 && a.soil.length <= 80);
});

test("3C materials are culled outside Greyhaven and ignore invalid tile geometry", () => {
  const none = {pavers:[],soil:[],grass:[]};
  assert.deepEqual(createGreyhavenTerrainPlan(map,{x:0,y:0,width:512,height:512}), none);
  assert.deepEqual(createGreyhavenTerrainPlan(map,{x:4000,y:4000,width:Infinity,height:512}), none);
  assert.deepEqual(createGreyhavenTerrainPlan(map,{x:4000,y:4000,width:2048,height:512}), none);
  assert.deepEqual(createGreyhavenTerrainPlan(AUTHORED_MAPS[MAP_IDS.tavern],greyhaven), none);
  assert.deepEqual(createGreyhavenTerrainPlan({...map,city:{...map.city,id:"other"}},greyhaven), none);
});

test("3C stones do not occupy building footprints and decorative grass avoids portals", () => {
  const plan = createGreyhavenTerrainPlan(map,greyhaven);
  for(const p of plan.pavers)
    assert.ok(!map.buildings.some(b=>p.x>=b.x&&p.x<=b.x+b.w&&
      p.y>=b.y&&p.y<=b.y+b.h),"stone inside authored building");
  for(const g of plan.grass) {
    assert.ok(!map.buildings.some(b=>g.x>=b.x&&g.x<=b.x+b.w&&
      g.y>=b.y&&g.y<=b.y+b.h),"grass inside authored building");
    assert.ok(!map.portals.some(p=>Math.hypot(p.x-g.x,p.y-g.y)<p.radius),"grass at portal");
  }
});

test("3C adjacent tiles have stable coincident world-grid samples across seams", () => {
  const a=createGreyhavenTerrainPlan(map,{x:3584,y:4096,width:512,height:512});
  const b=createGreyhavenTerrainPlan(map,greyhaven);
  const overlapA=a.pavers.filter(p=>p.x>=4076&&p.x<=4116);
  const overlapB=b.pavers.filter(p=>p.x>=4076&&p.x<=4116);
  assert.ok(overlapA.length>0);
  assert.deepEqual(overlapA,overlapB);
});

test("3C draws through existing world tile renderer, without a new cache", () => {
  const calls={fill:0,stroke:0,ellipse:0};
  const c={save(){},restore(){},translate(){},beginPath(){},moveTo(){},lineTo(){},
    arc(){},fillText(){},fillRect(){calls.fill++;},strokeRect(){calls.stroke++;},
    ellipse(){calls.ellipse++;},fill(){calls.fill++;},stroke(){calls.stroke++;}};
  const painted=paintGreyhavenGroundDetails(c,map,greyhaven);
  assert.ok(painted.pavers>0&&calls.fill>0&&calls.stroke>0&&calls.ellipse>0);
  let canvases=0;
  const world=createAuthoredWorldRenderer({
    makeCanvas:()=>{canvases++;return {width:0,height:0,getContext:()=>c};},
    cacheCap:3,buildLimit:2
  });
  const surface={save(){},restore(){},translate(){},fillRect(){},drawImage(){}};
  world.draw(surface,MAP_IDS.overworld,{x:4350,y:4170},700,500,1);
  assert.equal(world.stats.created,2);
  assert.ok(world.stats.cached<=3&&canvases<=2);
  world.draw(surface,MAP_IDS.overworld,{x:4350,y:4170},700,500,1);
  assert.ok(world.stats.cached<=3);
});
