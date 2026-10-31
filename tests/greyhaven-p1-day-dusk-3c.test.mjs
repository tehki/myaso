import assert from "node:assert/strict";
import test from "node:test";
import {MAP_IDS,AUTHORED_MAPS} from "../src/world/authored-maps.mjs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {createAuthoredWorldRenderer,WORLD_TILE_SIZE}
  from "../src/browser/authored-world-renderer.mjs";
import {createGreyhavenLightingPlan,GREYHAVEN_DAY_DUSK_VERSION,
  paintGreyhavenDuskWash,paintGreyhavenLightingFixtures}
  from "../src/browser/greyhaven-atmosphere.mjs";

const map=AUTHORED_MAPS[MAP_IDS.overworld];
const cityTile={x:4096,y:3584,width:512,height:512};

function fakeCanvas(recs){
  const c={
    save(){},restore(){},translate(){},beginPath(){},arc(){},ellipse(){},
    moveTo(){},lineTo(){},stroke(){},fill(){},
    strokeRect(){},fillText(){},drawImage(){},
    fillRect(x,y,w,h){
      if(this.fillStyle==="rgba(23,26,35,.14)")recs.washes.push({x,y,w,h});
    },
    createRadialGradient(x,y,innerX,xx,yy,radius){
      recs.pools.push({x,y,radius});
      return {addColorStop(){}};
    }
  };
  return {width:0,height:0,getContext:()=>c};
}
function render(mode){
  const recs={washes:[],pools:[]};
  const world=createAuthoredWorldRenderer({
    makeCanvas:()=>fakeCanvas(recs),cacheCap:12,buildLimit:8,
    ...(mode===undefined?{}:{greyhavenTimeOfDay:mode}),
  });
  const target={fillRect(){},drawImage(){}};
  world.draw(target,MAP_IDS.overworld,{x:4350,y:3970},960,540,ARENA_VIEW_ZOOM);
  const initial={wash:recs.washes.length,pools:recs.pools.length,
    cached:world.stats.cached,created:world.stats.created};
  world.draw(target,MAP_IDS.overworld,{x:4350,y:3970},960,540,ARENA_VIEW_ZOOM);
  return {recs,initial,world};
}

test("P1 source contracts: World9 XY, authored buildings, existing camera projection",()=>{
  assert.equal(GREYHAVEN_DAY_DUSK_VERSION,"3c-p1-day-dusk-1");
  assert.equal(ARENA_VIEW_ZOOM,.84);
  const tavern=map.buildings.find(b=>b.id==="red-lion");
  const smith=map.buildings.find(b=>b.id==="smith");
  assert.deepEqual([tavern.x,tavern.y,tavern.w,tavern.h],[4240,3880,250,170]);
  assert.deepEqual([smith.x,smith.y,smith.w,smith.h],[3710,3850,182,162]);
  const p=projectArenaPoint(4240,3880,4365,4075,960,540);
  assert.ok(Math.abs(p.x-(480-125*.84))<1e-8);
  assert.ok(Math.abs(p.y-(270-195*.84))<1e-8);
  assert.equal(WORLD_TILE_SIZE,512);
  assert.ok(createGreyhavenLightingPlan(map,cityTile).some(x=>x.id==="red-lion"));
});

test("P1 default OFF preserves legacy world renderer and isolates cached day/dusk",()=>{
  const legacy=render();
  const explicit=render("legacy");
  const day=render("day");
  const dusk=render("dusk");
  assert.equal(legacy.world.greyhavenTimeOfDay,"legacy");
  assert.deepEqual(legacy.initial,explicit.initial);
  assert.equal(legacy.recs.washes.length,0);
  assert.equal(day.recs.washes.length,0);
  assert.ok(dusk.recs.washes.length>0,"dusk must visibly tint the outdoor world");
  assert.ok(dusk.recs.pools.length>0,"dusk must light original building street anchors");
  assert.equal(day.recs.pools.length,0,"sunlit street cannot show dusk glow");
  for(const x of [legacy,day,dusk]){
    assert.ok(x.initial.created>0&&x.initial.created<=8);
    assert.ok(x.initial.cached<=12);
    assert.equal(x.world.stats.created,0,"second draw must reuse cached tiles");
    assert.equal(x.world.stats.cached,x.initial.cached);
  }
  assert.throws(()=>createAuthoredWorldRenderer({greyhavenTimeOfDay:"night"}),RangeError);
  assert.throws(()=>createAuthoredWorldRenderer({greyhavenTimeOfDay:null}),RangeError);
});

test("P1 dusk ambience is continuous across outdoor tiles and respects world bounds",()=>{
  const calls=[];const ctx={set fillStyle(v){this.tint=v;},fillRect(...a){calls.push({a,tint:this.tint});}};
  assert.equal(paintGreyhavenDuskWash(ctx,map,cityTile),1);
  assert.deepEqual(calls[0],{a:[4096,3584,512,512],tint:"rgba(23,26,35,.14)"});
  // A distant outdoor tile receives the same wash: there is no rectangular
  // edge around Greyhaven's authored city footprint.
  assert.equal(paintGreyhavenDuskWash(ctx,map,{x:6900,y:6400,width:512,height:512}),1);
  assert.deepEqual(calls[1],{a:[6900,6400,512,512],tint:"rgba(23,26,35,.14)"});
  // Tiles extending beyond World9's map edge are clipped to the authored map.
  assert.equal(paintGreyhavenDuskWash(ctx,map,{x:-128,y:-128,width:512,height:512}),1);
  assert.deepEqual(calls[2],{a:[0,0,384,384],tint:"rgba(23,26,35,.14)"});
  assert.equal(paintGreyhavenDuskWash(ctx,AUTHORED_MAPS[MAP_IDS.tavern],cityTile),0);
  assert.equal(paintGreyhavenDuskWash(ctx,map,{...cityTile,width:2048}),0);
  assert.equal(paintGreyhavenDuskWash(ctx,map,{...cityTile,x:Infinity}),0);
  assert.equal(calls.length,3);
});

test("P1 daylight fixture remains physical but emits no glow; dusk fixture bounded",()=>{
  const counts={light:0};
  const ctx={fillRect(){},stroke(){},beginPath(){},moveTo(){},lineTo(){},
    arc(){counts.light++;},fill(){},strokeRect(){}};
  paintGreyhavenLightingFixtures(ctx,map,cityTile,{lit:false});
  assert.equal(counts.light,0);
  paintGreyhavenLightingFixtures(ctx,map,cityTile,{lit:true});
  assert.ok(counts.light>0&&counts.light<=5);
});
