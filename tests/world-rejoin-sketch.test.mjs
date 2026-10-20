import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {createLocalExpeditionState,chooseLocalExpedition,advanceLocalExpedition} from "../src/world/local-expeditions.mjs";
import {localSampledTrailRejoin,isSampledPreviewSegmentClear} from "../src/world/local-rejoin.mjs";
import {LOCAL_REJOIN_SKETCH_VERSION,LOCAL_REJOIN_SKETCH_COLOR,LOCAL_REJOIN_SKETCH_DASH,
  drawLocalRejoinSketch} from "../src/world/local-rejoin-sketch.mjs";

function state(){
  const result=createLocalExpeditionState();
  assert.ok(chooseLocalExpedition(result,"fallen-watch"));
  assert.ok(advanceLocalExpedition(result,MAP_IDS.overworld,4365,4150,"visit"));
  return result;
}
function context(){
  const calls=[];
  const ctx={};
  for(const op of ["save","restore","setLineDash","beginPath","moveTo","lineTo","stroke","arc","fill"]){
    ctx[op]=(...args)=>{
      for(const arg of args)if(typeof arg==="number")assert.ok(Number.isFinite(arg),op+" nonfinite");
      calls.push({op,args});
    };
  }
  return {ctx,calls};
}

test("D12 marker draws exact sampled-clear D11 hint on existing 248px map with balanced state",()=>{
  assert.equal(LOCAL_REJOIN_SKETCH_VERSION,1);
  assert.equal(LOCAL_REJOIN_SKETCH_COLOR,"#67e5ee");
  assert.deepEqual(LOCAL_REJOIN_SKETCH_DASH,[3,3]);
  assert.ok(Object.isFrozen(LOCAL_REJOIN_SKETCH_DASH));
  const a=state(),hint=localSampledTrailRejoin(a,MAP_IDS.overworld,4365,4319);
  assert.ok(hint);
  assert.ok(isSampledPreviewSegmentClear(MAP_IDS.overworld,4365,4319,hint.targetX,hint.targetY));
  const {ctx,calls}=context();
  assert.equal(drawLocalRejoinSketch(ctx,MAP_IDS.overworld,4365,4319,hint),true);
  assert.equal(calls[0].op,"save");
  assert.equal(calls.at(-1).op,"restore");
  assert.deepEqual(calls.filter(c=>c.op==="setLineDash").map(c=>c.args[0]),[[3,3],[]]);
  const scale=(248-24)/8192;
  const pixels=(x,y)=>[12+x*scale,12+y*scale];
  const line=calls.find(c=>c.op==="lineTo");
  assert.ok(line);
  for(let i=0;i<2;i++)assert.ok(Math.abs(line.args[i]-pixels(hint.targetX,hint.targetY)[i])<1e-9);
  assert.equal(calls.filter(c=>c.op==="arc").length,1,"one cyan rejoin target circle");
  assert.equal(a.stepIndex,1,"drawing must not grant expedition stages");
});

test("D12 refuses stale positions, impossible coordinates, fake or oversize hints without drawing",()=>{
  const fresh=localSampledTrailRejoin(state(),MAP_IDS.overworld,4365,4319);
  assert.ok(fresh);
  const cases=[
    [MAP_IDS.tavern,390,480,fresh,248],
    ["invalid",4365,4319,fresh,248],
    [MAP_IDS.overworld,4365,4150,fresh,248], // stale player coordinate
    [MAP_IDS.overworld,NaN,4319,fresh,248],
    [MAP_IDS.overworld,4365,Infinity,fresh,248],
    [MAP_IDS.overworld,4365,4319,null,248],
    [MAP_IDS.overworld,4365,4319,{...fresh,targetX:NaN},248],
    [MAP_IDS.overworld,4365,4319,{...fresh,distance:10000},248],
    [MAP_IDS.overworld,4365,4319,{...fresh,targetY:Infinity},248],
    [MAP_IDS.overworld,4365,4319,{...fresh,segmentIndex:99},248],
    [MAP_IDS.overworld,4365,4319,{...fresh,direction:"FAKE"},248],
    [MAP_IDS.overworld,4365,4319,fresh,50],
    [MAP_IDS.overworld,4365,4319,fresh,999],
  ];
  for(const args of cases){
    const {ctx,calls}=context();
    assert.equal(drawLocalRejoinSketch(ctx,...args),false,"should reject "+String(args[0]));
    assert.equal(calls.length,0,"must leave D8/D9 map undisturbed");
  }
  assert.equal(drawLocalRejoinSketch(null,MAP_IDS.overworld,4365,4319,fresh),false);
});

test("D12 no icon while close, distant, blocked, or no expedition stage",()=>{
  const a=state();
  const {ctx,calls}=context();
  for(const [x,y] of [[4365,4150],[4000,4400],[4365,4000]]){
    const noHint=localSampledTrailRejoin(a,MAP_IDS.overworld,x,y);
    assert.equal(noHint,null);
    assert.equal(drawLocalRejoinSketch(ctx,MAP_IDS.overworld,x,y,noHint),false);
    assert.equal(calls.length,0);
  }
  const noRoute=createLocalExpeditionState();
  assert.equal(localSampledTrailRejoin(noRoute,MAP_IDS.overworld,4365,4319),null);
});

test("D12 corrected marker positions honor 128–512px map scaling",()=>{
  const hint=localSampledTrailRejoin(state(),MAP_IDS.overworld,4365,4319);
  const map=getAuthoredMap(MAP_IDS.overworld);
  for(const size of [128,248,512]){
    const {ctx,calls}=context();
    assert.ok(drawLocalRejoinSketch(ctx,MAP_IDS.overworld,4365,4319,hint,size));
    const p=calls.find(c=>c.op==="moveTo").args;
    const scale=(size-24)/Math.max(map.width,map.height);
    assert.ok(Math.abs(p[0]-(12+4365*scale))<1e-9);
    assert.ok(Math.abs(p[1]-(12+4319*scale))<1e-9);
  }
});

test("D12 sketch is pure render-only with no remote movement or path generator",()=>{
  const source=readFileSync(new URL("../src/world/local-rejoin-sketch.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|setInterval|while\s*\(|new Worker|astar|AStar/);
  assert.doesNotMatch(source,/advanceLocalExpedition|chooseLocalExpedition|moveAuthoredPreview/);
  for(const p of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    assert.doesNotMatch(readFileSync(new URL(p,import.meta.url),"utf8"),
      /drawLocalRejoinSketch|local-rejoin-sketch|rejoin-map-key/);
  }
});

test("D12 preview reuses one checked hint for copy and sketch only when M map is visible",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:script[1],encoding:"utf8",timeout:10000});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(html,/id="rejoin-map-key"/);
  assert.match(html,/Cyan marker: sampled-clear return point/);
  assert.match(script[1],/rejoinMapKey.hidden=wayfindingMap.hidden \|\| !rejoin;/);
  assert.match(script[1],/drawLocalRejoinSketch\(wayfindingContext,mapId,player.x,player.y,rejoin\)/);
  assert.match(script[1],/if\(!wayfindingMap.hidden\)/);
  assert.equal((script[1].match(/localSampledTrailRejoin\(expeditionState,mapId,player.x,player.y\)/g)||[]).length,1,
    "share D11 collision samples between UI copy and cyan map marker");
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
});
