import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import { createLocalExpeditionState, chooseLocalExpedition, advanceLocalExpedition } from "../src/world/local-expeditions.mjs";
import { localTrailPosition } from "../src/world/local-trail-progress.mjs";
import { LOCAL_REJOIN_VERSION, LOCAL_REJOIN_MAX_DISTANCE,
  LOCAL_REJOIN_SAMPLE_STEP, LOCAL_REJOIN_CANDIDATES,
  isSampledPreviewSegmentClear, localSampledTrailRejoin } from "../src/world/local-rejoin.mjs";

function active(id="western-survey") {
  const state=createLocalExpeditionState();
  assert.ok(chooseLocalExpedition(state,id));
  const start=id==="fallen-watch"?[4365,4150]:[4450,4250];
  assert.ok(advanceLocalExpedition(state,MAP_IDS.overworld,...start,"visit"));
  return state;
}

test("D11 requires bounded, conservative 18-radius occupancy along each sampled connection",()=>{
  assert.equal(LOCAL_REJOIN_VERSION,1);
  assert.equal(LOCAL_REJOIN_MAX_DISTANCE,256);
  assert.equal(LOCAL_REJOIN_SAMPLE_STEP,4);
  assert.equal(LOCAL_REJOIN_CANDIDATES,12);
  assert.equal(isSampledPreviewSegmentClear(MAP_IDS.overworld,3440,4180,3600,4180),true,
    "Greyhaven west gate is traversable");
  assert.equal(isSampledPreviewSegmentClear(MAP_IDS.overworld,3450,4000,3600,4000),false,
    "Greyhaven wall must block direct shortcuts");
  for(const args of [
    [MAP_IDS.tavern,390,480,390,550],
    ["unknown",3440,4180,3600,4180],
    [MAP_IDS.overworld,NaN,4180,3600,4180],
    [MAP_IDS.overworld,3440,4180,Infinity,4180],
    [MAP_IDS.overworld,3450,4000,3600,4000],
    [MAP_IDS.overworld,4100,4400,4100,4000],
  ])assert.equal(isSampledPreviewSegmentClear(...args),false);
});

test("D11 western trail supplies a rejoin direction only across swept-clear road space",()=>{
  const state=active();
  const player={x:4100,y:4400};
  const progress=localTrailPosition(state,MAP_IDS.overworld,player.x,player.y);
  assert.ok(progress && !progress.nearTrail);
  const hint=localSampledTrailRejoin(state,MAP_IDS.overworld,player.x,player.y);
  assert.ok(hint);
  assert.ok(Object.isFrozen(hint));
  assert.equal(hint.to,"west-road-old-mill");
  assert.equal(hint.direction,"N");
  assert.ok(hint.distance>=96 && hint.distance<=256);
  assert.ok(hint.segmentIndex>=0);
  assert.equal(isSampledPreviewSegmentClear(MAP_IDS.overworld,player.x,player.y,
    hint.targetX,hint.targetY),true);
  assert.match(hint.caution,/sampled static preview geometry only/i);
  assert.equal(state.stepIndex,1,"guidance must never award stages");
});

test("D11 northern route rejoin can be sampled without modifying the certified corridor",()=>{
  const state=active("fallen-watch");
  const a=localSampledTrailRejoin(state,MAP_IDS.overworld,4365,4319);
  const b=localSampledTrailRejoin(state,MAP_IDS.overworld,4365,4319);
  assert.ok(a && Object.isFrozen(a));
  assert.deepEqual(a,b);
  assert.equal(a.direction,"N");
  assert.equal(isSampledPreviewSegmentClear(MAP_IDS.overworld,4365,4319,a.targetX,a.targetY),true);
  assert.equal(state.stepIndex,1);
});

test("D11 no recommendation for already-near players or distant off-corridor positions",()=>{
  const north=active("fallen-watch");
  assert.equal(localSampledTrailRejoin(north,MAP_IDS.overworld,4365,4150),null);
  assert.equal(localSampledTrailRejoin(north,MAP_IDS.overworld,4000,4400),null);
  assert.equal(localSampledTrailRejoin(north,MAP_IDS.overworld,4300,4360),null);
  assert.equal(north.stepIndex,1);
});

test("D11 wrong map, blocked positions, unselected/complete route fail closed",()=>{
  const west=active();
  for(const [map,x,y] of [
    [MAP_IDS.tavern,390,480],["fake-map",4100,4400],
    [MAP_IDS.overworld,NaN,4400],[MAP_IDS.overworld,4100,Infinity],
    [MAP_IDS.overworld,4365,4000],[MAP_IDS.overworld,1940,3840]
  ])assert.equal(localSampledTrailRejoin(west,map,x,y),null);
  assert.equal(localSampledTrailRejoin(null,MAP_IDS.overworld,4100,4400),null);
  assert.equal(localSampledTrailRejoin(createLocalExpeditionState(),MAP_IDS.overworld,4100,4400),null);
  const north=active("fallen-watch");
  assert.ok(advanceLocalExpedition(north,MAP_IDS.overworld,3210,2070,"visit"));
  assert.ok(advanceLocalExpedition(north,MAP_IDS.overworld,3220,2110,"inspect"));
  assert.equal(localSampledTrailRejoin(north,MAP_IDS.overworld,3220,2110),null);
});

test("D11 no network/persistence/inventory side effects and bounded candidate loop",()=>{
  const src=readFileSync(new URL("../src/world/local-rejoin.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(src,/WebSocket|fetch\(|localStorage|sessionStorage|setInterval|setTimeout|new Worker|astar|AStar/);
  assert.match(src,/LOCAL_REJOIN_CANDIDATES/);
  const keys=Object.keys(localSampledTrailRejoin(active(),MAP_IDS.overworld,4100,4400));
  for(const key of ["reward","item","xp","gold","wallet","money","loot","stock","questCredit"])
    assert.ok(!keys.includes(key));
  for(const file of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),"utf8"),
      /local-rejoin|localSampledTrailRejoin|trail-rejoin/);
  }
});

test("D11 offline preview actually wires the rejoin guard at existing 250ms refresh",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const check=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:script[1],encoding:"utf8",timeout:10000,
  });
  assert.equal(check.status,0,check.stderr);
  assert.match(html,/id="trail-rejoin"/);
  assert.match(script[1],/localSampledTrailRejoin\(expeditionState,mapId,player.x,player.y\)/);
  assert.match(script[1],/nextWayfindingAt=now\+250/);
  assert.match(html,/Static preview geometry only/);
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
});
