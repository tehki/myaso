import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { MAP_IDS, getAuthoredMap } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";
import { MOONVALE_EXPEDITIONS, createLocalExpeditionState,
  chooseLocalExpedition, advanceLocalExpedition } from "../src/world/local-expeditions.mjs";
import { drawLocalWayfindingSketch } from "../src/world/local-wayfinding.mjs";
import { CERTIFIED_TRAILS_VERSION,CERTIFIED_TRAIL_SAMPLE_UNITS,CERTIFIED_TRAILS } from "../src/world/certified-trails.mjs";
import { certifiedTrailForNext,localTrailDescription } from "../src/world/local-trails.mjs";

const walk=(x,y)=>isAuthoredPreviewWalkable(MAP_IDS.overworld,x,y);
const choose=id=>{const s=createLocalExpeditionState();assert.ok(chooseLocalExpedition(s,id));return s;};
function canvas(){
  const ops=[];
  const c={};
  for(const m of ["clearRect","fillRect","strokeRect","beginPath","moveTo","lineTo","stroke","fill","arc"])
    c[m]=(...args)=>{ops.push([m,...args]);};
  return {c,ops};
}

test("D9 exactly seven fixed route legs cover all authored expedition transitions",()=>{
  assert.equal(CERTIFIED_TRAILS_VERSION,1);
  assert.equal(CERTIFIED_TRAIL_SAMPLE_UNITS,4);
  assert.ok(Object.isFrozen(CERTIFIED_TRAILS));
  const pairs=new Set();
  for(const route of MOONVALE_EXPEDITIONS){
    for(let i=1;i<route.steps.length;i++)
      pairs.add(route.steps[i-1].site.id+"->"+route.steps[i].site.id);
  }
  assert.equal(pairs.size,7);
  assert.equal(CERTIFIED_TRAILS.length,pairs.size);
  for(const trail of CERTIFIED_TRAILS){
    assert.ok(pairs.has(trail.from+"->"+trail.to));
    assert.ok(Object.isFrozen(trail));
    assert.ok(Object.isFrozen(trail.points));
    assert.ok(trail.points.length>=2 && trail.points.length<=64);
    for(const point of trail.points)assert.ok(Object.isFrozen(point));
  }
});

test("D9 every generated trail segment is swept walkable at four-unit intervals",()=>{
  const endpoints=new Map();
  for(const route of MOONVALE_EXPEDITIONS)
    for(const step of route.steps)endpoints.set(step.site.id,step.site);
  let sampled=0;
  for(const trail of CERTIFIED_TRAILS){
    const from=endpoints.get(trail.from),to=endpoints.get(trail.to);
    assert.deepEqual(trail.points[0],[from.x,from.y]);
    assert.deepEqual(trail.points.at(-1),[to.x,to.y]);
    for(let i=1;i<trail.points.length;i++){
      const [ax,ay]=trail.points[i-1],[bx,by]=trail.points[i];
      const length=Math.hypot(bx-ax,by-ay);
      assert.ok(length>0);
      const n=Math.max(1,Math.ceil(length/CERTIFIED_TRAIL_SAMPLE_UNITS));
      for(let j=0;j<=n;j++){
        const t=j/n;
        assert.ok(walk(ax+(bx-ax)*t,ay+(by-ay)*t),trail.from+" -> "+trail.to+" failed at "+i+" "+j+"/"+n);
        sampled++;
      }
    }
  }
  assert.ok(sampled>1000,"test must exercise long road and bridge crossings");
});

test("D9 generator reproducibility gates stale trail fixtures",()=>{
  const script=fileURLToPath(new URL("../scripts/generate-world-trails.mjs",import.meta.url));
  const r=spawnSync(process.execPath,[script,"--check"],{encoding:"utf8",timeout:30000});
  assert.equal(r.error,undefined,r.error?.message);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.match(r.stdout,/7 ordered legs, 17 points/);
});

test("D9 active trail is anchored between completed and next stage, never player position",()=>{
  const state=choose("fallen-watch");
  assert.equal(certifiedTrailForNext(state,MAP_IDS.overworld),null);
  const result=advanceLocalExpedition(state,MAP_IDS.overworld,4365,4150,"visit");
  assert.ok(result);
  const trail=certifiedTrailForNext(state,MAP_IDS.overworld);
  assert.equal(trail?.from,"greyhaven-red-lion");
  assert.equal(trail?.to,"north-road-watch-ruin");
  assert.equal(trail.points.length,5);
  assert.deepEqual(trail.points[0],[4365,4075]);
  const desc=localTrailDescription(state,MAP_IDS.overworld);
  assert.equal(desc.waypoints,5);
  assert.match(desc.caution,/rejoin it on foot/);
  assert.ok(Object.isFrozen(desc));
  assert.equal(certifiedTrailForNext(state,MAP_IDS.tavern),null);
  assert.equal(certifiedTrailForNext({},MAP_IDS.overworld),null);
  advanceLocalExpedition(state,MAP_IDS.overworld,3210,2070,"visit");
  assert.equal(certifiedTrailForNext(state,MAP_IDS.overworld)?.to,"fallen-watch-iron");
  advanceLocalExpedition(state,MAP_IDS.overworld,3220,2110,"inspect");
  assert.equal(certifiedTrailForNext(state,MAP_IDS.overworld),null);
});

test("D9 rendered sketch follows certified curved north corridor rather than unsafe line",()=>{
  const state=choose("fallen-watch");
  const world=getAuthoredMap(MAP_IDS.overworld);
  assert.ok(advanceLocalExpedition(state,MAP_IDS.overworld,4365,4150,"visit"));
  const {c,ops}=canvas();
  assert.equal(drawLocalWayfindingSketch(c,MAP_IDS.overworld,4365,4150,state),true);
  const base=(world.river.points.length-1)+world.roads.reduce((n,r)=>n+r.points.length-1,0);
  const trail=certifiedTrailForNext(state,MAP_IDS.overworld);
  assert.equal(ops.filter(x=>x[0]==="lineTo").length,base+trail.points.length-1);
  assert.ok(ops.length<240);
});

test("D9 no runtime A-star, networked movement or hidden costly pathfinding",()=>{
  const source=readFileSync(new URL("../src/world/local-trails.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/while\s*\(|setInterval|fetch\(|WebSocket|WebTransport/);
  for(const f of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    const live=readFileSync(new URL(f,import.meta.url),"utf8");
    assert.doesNotMatch(live,/certifiedTrailForNext|local-trails|certified-trails/);
  }
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:script[1],encoding:"utf8",timeout:10000});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(html,/surveyed trail/);
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
});
