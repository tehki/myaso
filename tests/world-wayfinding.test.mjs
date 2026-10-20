import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { MAP_IDS, getAuthoredMap } from "../src/world/authored-maps.mjs";
import { createLocalExpeditionState, chooseLocalExpedition, advanceLocalExpedition } from "../src/world/local-expeditions.mjs";
import { WAYFINDING_VERSION, WAYFINDING_DIRECTIONS, WAYFINDING_SKETCH_SIZE,
  localWayfindingHint, drawLocalWayfindingSketch } from "../src/world/local-wayfinding.mjs";

const choose = id => {
  const state=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(state,id),true);
  return state;
};
function fakeCanvas(){
  const ops=[];
  const ctx={};
  for(const name of ["clearRect","fillRect","strokeRect","beginPath","moveTo","lineTo",
    "stroke","fill","arc"]){
    ctx[name]=(...args)=>{assert.ok(args.every(Number.isFinite),name+" nonfinite");ops.push([name,...args]);};
  }
  return {ctx,ops};
}
test("D8 direction classifier uses map-up north and geographic distance",()=>{
  assert.equal(WAYFINDING_VERSION,1);
  assert.deepEqual(WAYFINDING_DIRECTIONS,["N","NE","E","SE","S","SW","W","NW"]);
  assert.equal(WAYFINDING_SKETCH_SIZE,248);
  const state=choose("greyhaven-circuit");
  // First visit Red Lion then track eastern herb approach.
  assert.ok(advanceLocalExpedition(state,MAP_IDS.overworld,4365,4150));
  const hint=localWayfindingHint(state,MAP_IDS.overworld,4365,4260);
  assert.ok(hint);
  assert.equal(hint.targetId,"greyhaven-road-herbs");
  assert.equal(hint.direction,"E");
  assert.equal(hint.distance,245);
  assert.equal(hint.bearingDeg,90);
  assert.equal(hint.action,"inspect");
  assert.ok(Object.isFrozen(hint));
  assert.match(hint.caution,/follow roads and bridges/);
});
test("D8 route state switching changes destination, never grants any stage",()=>{
  const state=choose("western-survey");
  const before=localWayfindingHint(state,MAP_IDS.overworld,4365,4150);
  assert.equal(before.targetName,"Greyhaven Market");
  chooseLocalExpedition(state,"fallen-watch");
  const after=localWayfindingHint(state,MAP_IDS.overworld,4365,4150);
  assert.equal(after.targetName,"The Red Lion");
  assert.equal(state.stepIndex,0);
  assert.ok(!Object.keys(after).some(k=>/reward|xp|coin|wallet|loot|credit/i.test(k)));
});
test("D8 compass rejects invalid, cross-zone, unwalkable and completed routes",()=>{
  const state=choose("fallen-watch");
  for(const [map,x,y] of [
    [MAP_IDS.tavern,390,480],["fake",4365,4150],
    [MAP_IDS.overworld,NaN,4150],[MAP_IDS.overworld,Infinity,4150],
    [MAP_IDS.overworld,4365,4000],[MAP_IDS.overworld,1940,3840],
    [MAP_IDS.overworld,0,0]
  ])assert.equal(localWayfindingHint(state,map,x,y),null);
  for(const [action,x,y] of [
    ["visit",4365,4150],["visit",3210,2070],["inspect",3220,2110]
  ])assert.ok(advanceLocalExpedition(state,MAP_IDS.overworld,x,y,action));
  assert.equal(localWayfindingHint(state,MAP_IDS.overworld,3220,2110),null);
  assert.equal(localWayfindingHint({},MAP_IDS.overworld,4365,4150),null);
});
test("D8 map paints only the fixed authored content and current target",()=>{
  const map=getAuthoredMap(MAP_IDS.overworld);
  const state=choose("western-survey");
  const {ctx,ops}=fakeCanvas();
  assert.equal(drawLocalWayfindingSketch(ctx,MAP_IDS.overworld,4365,4150,state),true);
  assert.ok(ops.length<240,"map rendering must remain bounded");
  assert.equal(ops.filter(x=>x[0]==="lineTo").length,
    map.river.points.length-1+map.roads.reduce((n,r)=>n+r.points.length-1,0)+1);
  assert.equal(ops.filter(x=>x[0]==="arc").length,2,"player and target only");
  assert.ok(ops.every(x=>x.slice(1).every(Number.isFinite)));
  const noRoute=createLocalExpeditionState();
  const noTarget=fakeCanvas();
  assert.equal(drawLocalWayfindingSketch(noTarget.ctx,MAP_IDS.overworld,4365,4150,noRoute),true);
  assert.equal(noTarget.ops.filter(x=>x[0]==="arc").length,1);
});
test("D8 sketch map fails closed on invalid positions, map, canvas and sizes",()=>{
  const state=choose("greyhaven-circuit");
  for(const [map,x,y,size] of [
    [MAP_IDS.tavern,390,480,248],
    [MAP_IDS.overworld,NaN,4150,248],
    [MAP_IDS.overworld,4365,4000,248],
    [MAP_IDS.overworld,4365,4150,Infinity],
    [MAP_IDS.overworld,4365,4150,64],
    [MAP_IDS.overworld,4365,4150,600],
  ]){
    const canvas=fakeCanvas();
    assert.equal(drawLocalWayfindingSketch(canvas.ctx,map,x,y,state,size),false);
    assert.equal(canvas.ops.length,0);
  }
  assert.equal(drawLocalWayfindingSketch(null,MAP_IDS.overworld,4365,4150,state),false);
});
test("D8 browser module has a true opt-in M toggle and no network/online wiring",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const source=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(source);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:source[1],encoding:"utf8",timeout:10000
  });
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(html,/id="wayfinding-map"/);
  assert.match(html,/id="wayfinding-compass"/);
  assert.match(source[1],/e.code==="KeyM"&&!e.repeat/);
  assert.match(source[1],/drawLocalWayfindingSketch\(wayfindingContext,mapId,player.x,player.y,expeditionState/);
  assert.doesNotMatch(source[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
  for(const file of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    const content=readFileSync(new URL(file,import.meta.url),"utf8");
    assert.doesNotMatch(content,/local-wayfinding|drawLocalWayfindingSketch|localWayfindingHint/);
  }
});
