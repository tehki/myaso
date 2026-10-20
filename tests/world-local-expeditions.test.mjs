import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { MAP_IDS } from "../src/world/authored-maps.mjs";
import { isAuthoredPreviewWalkable } from "../src/world/authored-preview-collision.mjs";
import { MOONVALE_LANDMARKS } from "../src/world/landmark-discovery.mjs";
import { MOONVALE_FIELD_SITES } from "../src/world/field-survey.mjs";
import {
  LOCAL_EXPEDITION_VERSION, MOONVALE_EXPEDITIONS,
  createLocalExpeditionState, chooseLocalExpedition,
  localExpeditionProgress, advanceLocalExpedition,
} from "../src/world/local-expeditions.mjs";

test("D7 routes have immutable unique IDs and referenced, walkable authored stages", () => {
  assert.equal(LOCAL_EXPEDITION_VERSION, 1);
  assert.equal(MOONVALE_EXPEDITIONS.length, 3);
  assert.ok(Object.isFrozen(MOONVALE_EXPEDITIONS));
  assert.equal(new Set(MOONVALE_EXPEDITIONS.map(x => x.id)).size, 3);
  for (const route of MOONVALE_EXPEDITIONS) {
    assert.ok(Object.isFrozen(route) && Object.isFrozen(route.steps));
    assert.match(route.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(route.name.length > 5 && route.story.length > 25);
    assert.ok(route.steps.length >= 3 && route.steps.length <= 4);
    assert.equal(new Set(route.steps.map(x => x.site.id)).size, route.steps.length);
    for (const step of route.steps) {
      assert.ok(Object.isFrozen(step) && Object.isFrozen(step.site));
      assert.equal(step.site.mapId, MAP_IDS.overworld);
      assert.ok(isAuthoredPreviewWalkable(step.site.mapId,step.site.x,step.site.y));
      assert.ok(step.action === "visit" || step.action === "inspect");
      assert.ok((step.action === "visit" ? MOONVALE_LANDMARKS : MOONVALE_FIELD_SITES)
        .includes(step.site));
    }
  }
});

test("D7 Greyhaven Circuit requires ordered landmark, F observation and market visit", () => {
  const state = createLocalExpeditionState();
  assert.deepEqual(localExpeditionProgress(state), {
    route:null,stepsCompleted:0,total:0,nextStep:null,finished:false,
  });
  assert.equal(chooseLocalExpedition(state,"greyhaven-circuit"),true);
  const at = (x,y,action) => advanceLocalExpedition(state,MAP_IDS.overworld,x,y,action);
  assert.equal(at(4610,4260,"inspect"),null,"cannot inspect stage two before Red Lion visit");
  assert.equal(at(4365,4150,"inspect"),null,"visits must not be satisfied by F");
  assert.equal(localExpeditionProgress(state).stepsCompleted,0);
  assert.equal(at(4365,4150,"visit")?.completedStep.site.id,"greyhaven-red-lion");
  assert.equal(at(4365,4150,"visit"),null);
  assert.equal(at(4610,4260,"visit"),null,"walking over herbs is not explicit inspection");
  assert.equal(at(4610,4260,"inspect")?.completedStep.site.id,"greyhaven-road-herbs");
  assert.equal(at(4610,4260,"inspect"),null);
  assert.equal(at(4450,4250,"inspect"),null,"market is visit, not inspect");
  const final = at(4450,4250,"visit");
  assert.equal(final?.finished,true);
  assert.deepEqual(
    {step:localExpeditionProgress(state).stepsCompleted,total:localExpeditionProgress(state).total},
    {step:3,total:3}
  );
  assert.equal(localExpeditionProgress(state).nextStep,null);
  assert.equal(localExpeditionProgress(state).finished,true);
  assert.equal(at(4450,4250,"visit"),null,"cannot claim completion repeatedly");
});

test("D7 independent visitors, route switches and restarting the current journey", () => {
  const first = createLocalExpeditionState(), second=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(first,"fallen-watch"),true);
  assert.equal(advanceLocalExpedition(first,MAP_IDS.overworld,4365,4150)?.completedStep.site.id,
    "greyhaven-red-lion");
  assert.equal(localExpeditionProgress(second).total,0);
  assert.equal(chooseLocalExpedition(second,"western-survey"),true);
  assert.equal(localExpeditionProgress(second).total,4);
  assert.equal(advanceLocalExpedition(second,MAP_IDS.overworld,4450,4250)?.completedStep.site.id,
    "greyhaven-market");
  assert.equal(chooseLocalExpedition(first,"western-survey"),true);
  assert.equal(localExpeditionProgress(first).stepsCompleted,0);
  assert.equal(localExpeditionProgress(second).stepsCompleted,1);
  assert.equal(chooseLocalExpedition(second,"western-survey"),true);
  assert.equal(localExpeditionProgress(second).stepsCompleted,0);
});

test("D7 west and north routes complete in authored order and cannot skip", () => {
  const west=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(west,"western-survey"),true);
  const steps=[
    ["visit",4450,4250,"greyhaven-market"],
    ["visit",2815,4100,"west-road-old-mill"],
    ["inspect",2540,4120,"west-road-stone"],
    ["inspect",1780,4260,"west-bank-reeds"],
  ];
  assert.equal(advanceLocalExpedition(west,MAP_IDS.overworld,1780,4260,"inspect"),null);
  for(const [action,x,y,id] of steps)
    assert.equal(advanceLocalExpedition(west,MAP_IDS.overworld,x,y,action)?.completedStep.site.id,id);
  assert.equal(localExpeditionProgress(west).finished,true);
  const north=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(north,"fallen-watch"),true);
  for(const [action,x,y,id] of [
    ["visit",4365,4150,"greyhaven-red-lion"],
    ["visit",3210,2070,"north-road-watch-ruin"],
    ["inspect",3220,2110,"fallen-watch-iron"],
  ]) assert.equal(advanceLocalExpedition(north,MAP_IDS.overworld,x,y,action)?.completedStep.site.id,id);
  assert.equal(localExpeditionProgress(north).finished,true);
});

test("D7 rejects remote, cross-map, blocked, nonfinite and fabricated progression", () => {
  const state=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(state,"greyhaven-circuit"),true);
  for (const [map,x,y,action] of [
    [MAP_IDS.tavern,4365,4150,"visit"],
    ["fake",4365,4150,"visit"],
    [MAP_IDS.overworld,0,0,"visit"],
    [MAP_IDS.overworld,NaN,4150,"visit"],
    [MAP_IDS.overworld,Infinity,4150,"visit"],
    [MAP_IDS.overworld,4365,4000,"visit"],
    [MAP_IDS.overworld,1940,3840,"visit"],
    [MAP_IDS.overworld,4365,4150,"inspect"],
    [MAP_IDS.overworld,4365,4150,"fabricated"],
  ]) assert.equal(advanceLocalExpedition(state,map,x,y,action),null);
  assert.equal(localExpeditionProgress(state).stepsCompleted,0);
  assert.equal(chooseLocalExpedition(state,"fake-expedition"),false);
  assert.equal(localExpeditionProgress(state).stepsCompleted,0);
  assert.equal(chooseLocalExpedition({}, "greyhaven-circuit"),false);
  assert.equal(advanceLocalExpedition({},MAP_IDS.overworld,4365,4150),null);
  assert.deepEqual(localExpeditionProgress({routeId:"greyhaven-circuit",stepIndex:NaN}),{
    route:null,stepsCompleted:0,total:0,nextStep:null,finished:false
  });
});

test("D7 progress only narrates visited world places; never grants economic value", () => {
  const state=createLocalExpeditionState();
  chooseLocalExpedition(state,"greyhaven-circuit");
  const result=advanceLocalExpedition(state,MAP_IDS.overworld,4365,4150);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(localExpeditionProgress(state)));
  assert.deepEqual(Object.keys(result),["completedStep","finished"]);
  const forbidden=/^(reward|inventory|xp|experience|gold|coin|wallet|item|harvest|stock|currency|loot|property|ownership|serverTick)$/;
  for(const route of MOONVALE_EXPEDITIONS) {
    for(const [key] of Object.entries(route))assert.doesNotMatch(key,forbidden);
    for(const step of route.steps)
      for(const key of Object.keys(step))assert.doesNotMatch(key,forbidden);
  }
});

test("D7 offline-only preview exposes accessible route selection and explicit F milestone", () => {
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const check=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:script[1],encoding:"utf8",timeout:10000});
  assert.equal(check.status,0,check.stderr);
  for(const needle of [
    'id="expedition-choices"', 'id="expedition-progress"','id="expedition-next"',
    'chooseLocalExpedition(expeditionState,route.id)',
    'advanceLocalExpedition(expeditionState,mapId,player.x,player.y,"inspect")',
    'advanceLocalExpedition(expeditionState,mapId,player.x,player.y,"visit")',
  ]) assert.ok(html.includes(needle),"missing route wiring: "+needle);
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
  for(const p of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    const live=readFileSync(new URL(p,import.meta.url),"utf8");
    assert.doesNotMatch(live,/local-expeditions|advanceLocalExpedition|chooseLocalExpedition/);
  }
});
