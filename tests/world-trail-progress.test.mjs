import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";
import { createLocalExpeditionState, chooseLocalExpedition,
  advanceLocalExpedition } from "../src/world/local-expeditions.mjs";
import { certifiedTrailForNext } from "../src/world/local-trails.mjs";
import { LOCAL_TRAIL_PROGRESS_VERSION, LOCAL_TRAIL_NEAR_RADIUS,
  localTrailPosition } from "../src/world/local-trail-progress.mjs";

function active(route="fallen-watch") {
  const state=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(state,route),true);
  const site=route==="fallen-watch"?{x:4365,y:4150}:{x:4450,y:4250};
  assert.ok(advanceLocalExpedition(state,MAP_IDS.overworld,site.x,site.y,"visit"));
  return state;
}
const approx=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);

test("D10 cursor projection follows the actual certified north corridor, not straight-line distance",()=>{
  assert.equal(LOCAL_TRAIL_PROGRESS_VERSION,1);
  assert.equal(LOCAL_TRAIL_NEAR_RADIUS,96);
  const state=active(),trail=certifiedTrailForNext(state,MAP_IDS.overworld);
  assert.equal(trail.points.length,5);
  const start=trail.points[0],end=trail.points.at(-1);
  const p0=localTrailPosition(state,MAP_IDS.overworld,...start);
  const p1=localTrailPosition(state,MAP_IDS.overworld,...end);
  assert.ok(p0 && p1 && Object.isFrozen(p0));
  approx(p0.offTrailDistance,0);
  approx(p0.alongDistance,0);
  approx(p0.completionFraction,0);
  approx(p1.offTrailDistance,0);
  approx(p1.remainingDistance,0);
  approx(p1.completionFraction,1);
  assert.ok(p0.totalDistance>Math.hypot(end[0]-start[0],end[1]-start[1]));
  approx(p0.totalDistance,p1.totalDistance);
  assert.equal(p0.from,"greyhaven-red-lion");
  assert.equal(p0.to,"north-road-watch-ruin");
});

test("D10 halfway along a certified segment is near and reports correct remaining distance",()=>{
  const state=active();
  const trail=certifiedTrailForNext(state,MAP_IDS.overworld);
  const start=trail.points[1],end=trail.points[2];
  const halfway={x:(start[0]+end[0])/2,y:(start[1]+end[1])/2};
  assert.ok(isAuthoredPreviewWalkable(MAP_IDS.overworld,halfway.x,halfway.y));
  const result=localTrailPosition(state,MAP_IDS.overworld,halfway.x,halfway.y);
  assert.ok(result);
  assert.equal(result.nearTrail,true);
  approx(result.offTrailDistance,0);
  assert.ok(result.completionFraction>0 && result.completionFraction<1);
  assert.ok(result.remainingDistance>0 && result.remainingDistance<result.totalDistance);
  assert.ok(Number.isFinite(result.nextWaypointBearingDeg));
  assert.ok(result.nextWaypointIndex>=1 && result.nextWaypointIndex<trail.points.length);
});

test("D10 off-corridor feedback never promises a safe direct return",()=>{
  const state=active("western-survey");
  const remote={x:6000,y:6000};
  assert.ok(isAuthoredPreviewWalkable(MAP_IDS.overworld,remote.x,remote.y));
  const result=localTrailPosition(state,MAP_IDS.overworld,remote.x,remote.y);
  assert.ok(result && !result.nearTrail);
  assert.ok(result.offTrailDistance>LOCAL_TRAIL_NEAR_RADIUS);
  assert.ok(result.completionFraction>=0 && result.completionFraction<=1);
  assert.match(result.caution,/never a safe rejoin/);
  assert.ok(Number.isFinite(result.nearestX)&&Number.isFinite(result.nearestY));
  assert.equal(state.stepIndex,1,"projection must not award an expedition stage");
});

test("D10 rejects invalid map, blocked actor, nonfinite and unselected/finished routes",()=>{
  const state=active();
  for(const [map,x,y] of [
    [MAP_IDS.tavern,390,480],["forged-map",4365,4150],
    [MAP_IDS.overworld,NaN,4150],[MAP_IDS.overworld,4365,Infinity],
    [MAP_IDS.overworld,4365,4000],[MAP_IDS.overworld,1940,3840],
    [MAP_IDS.overworld,-100,4150],
  ])assert.equal(localTrailPosition(state,map,x,y),null);
  assert.equal(localTrailPosition({},MAP_IDS.overworld,4365,4150),null);
  assert.equal(localTrailPosition(createLocalExpeditionState(),MAP_IDS.overworld,4365,4150),null);
  const finished=active();
  assert.ok(advanceLocalExpedition(finished,MAP_IDS.overworld,3210,2070,"visit"));
  assert.ok(advanceLocalExpedition(finished,MAP_IDS.overworld,3220,2110,"inspect"));
  assert.equal(localTrailPosition(finished,MAP_IDS.overworld,3220,2110),null);
});

test("D10 local progress is independent, deterministic and cannot change travel state",()=>{
  const a=active(),b=active();
  const first=localTrailPosition(a,MAP_IDS.overworld,4365,4150);
  const second=localTrailPosition(a,MAP_IDS.overworld,4365,4150);
  assert.deepEqual(first,second);
  assert.equal(a.stepIndex,1);
  assert.equal(b.stepIndex,1);
  assert.deepEqual(localTrailPosition(b,MAP_IDS.overworld,4365,4150),first);
  const keys=Object.keys(first);
  for(const forbidden of ["reward","item","xp","gold","wallet","coins","serverTick","questCredit","loot"])
    assert.ok(!keys.includes(forbidden));
});

test("D10 browser guidance is throttled, optional and disconnected from live authority",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:script[1],encoding:"utf8",timeout:10000,
  });
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(html,/id="trail-progress"/);
  assert.match(html,/id="trail-progress-bar"/);
  assert.match(script[1],/localTrailPosition\(expeditionState,mapId,player.x,player.y\)/);
  assert.match(script[1],/nextWayfindingAt=now\+250/);
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
  for(const name of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    const live=readFileSync(new URL(name,import.meta.url),"utf8");
    assert.doesNotMatch(live,/local-trail-progress|localTrailPosition|trail-progress-bar/);
  }
});
