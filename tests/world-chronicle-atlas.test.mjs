import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { MAP_IDS,getAuthoredMap } from "../src/world/authored-maps.mjs";
import { MOONVALE_ROADSIDE_LORE,createLocalLoreJournal,readLocalLore } from "../src/world/roadside-lore.mjs";
import { MOONVALE_CHRONICLE_THREADS,localChronicleThreadSummaries } from "../src/world/chronicle-threads.mjs";
import { CHRONICLE_ATLAS_VERSION,CHRONICLE_ATLAS_COLOR,CHRONICLE_ATLAS_MARKER_SIZE,
 localChronicleAtlasMarkers,drawLocalChronicleAtlas } from "../src/world/chronicle-atlas.mjs";

const sites=new Map(MOONVALE_ROADSIDE_LORE.map(site=>[site.id,site]));
const read=(journal,id)=>{
  const s=sites.get(id);assert.ok(s,id);
  assert.equal(readLocalLore(journal,s.mapId,s.x,s.y)?.id,id);
};
function fakeCanvas(){
  const ops=[];const ctx={};
  for(const method of ["save","restore","beginPath","moveTo","lineTo","closePath","fill"])
    ctx[method]=(...args)=>{
      for(const arg of args)if(typeof arg==="number")assert.ok(Number.isFinite(arg),method+" nonfinite");
      ops.push({method,args});
    };
  return {ctx,ops};
}
test("D15 atlas manifest is bounded to two existing unfinished D14 thread clues",()=>{
  assert.equal(CHRONICLE_ATLAS_VERSION,1);
  assert.equal(CHRONICLE_ATLAS_COLOR,"#d4a4f6");
  assert.equal(CHRONICLE_ATLAS_MARKER_SIZE,4);
  const markers=localChronicleAtlasMarkers(createLocalLoreJournal());
  assert.equal(markers.length,MOONVALE_CHRONICLE_THREADS.length);
  assert.equal(markers.length,2);
  assert.ok(Object.isFrozen(markers));
  assert.deepEqual(markers.map(m=>m.siteId),["red-lion-charter","millwright-inscription"]);
  for(let i=0;i<markers.length;i++){
    const m=markers[i];
    assert.ok(Object.isFrozen(m));
    assert.equal(m.threadId,MOONVALE_CHRONICLE_THREADS[i].id);
    assert.equal(m.siteId,MOONVALE_CHRONICLE_THREADS[i].siteIds[0]);
    assert.deepEqual([m.x,m.y],[sites.get(m.siteId).x,sites.get(m.siteId).y]);
    assert.equal(m.mapId,MAP_IDS.overworld);
    assert.equal(Object.hasOwn(m,"resolution"),false);
    assert.equal(Object.hasOwn(m,"passage"),false);
    assert.equal(Object.hasOwn(m,"reward"),false);
  }
});
test("D15 F-reading advances only its thread clue marker, leaving other story unchanged",()=>{
  const journal=createLocalLoreJournal();
  read(journal,"red-lion-charter");
  assert.deepEqual(localChronicleAtlasMarkers(journal).map(m=>m.siteId),
    ["greyhaven-bell","millwright-inscription"]);
  assert.equal(localChronicleThreadSummaries(journal)[0].read,1);
  read(journal,"millwright-inscription");
  assert.deepEqual(localChronicleAtlasMarkers(journal).map(m=>m.siteId),
    ["greyhaven-bell","bridge-wardens-mark"]);
  assert.equal(localChronicleThreadSummaries(journal)[1].read,1);
});
test("D15 out-of-order story reading skips completed clues, with no additional rewards",()=>{
  const journal=createLocalLoreJournal();
  read(journal,"stonebrook-mason");
  read(journal,"greyhaven-bell");
  assert.deepEqual(localChronicleAtlasMarkers(journal).map(m=>m.siteId),
    ["red-lion-charter","millwright-inscription"]);
  read(journal,"red-lion-charter");
  assert.deepEqual(localChronicleAtlasMarkers(journal).map(m=>m.siteId),
    ["millwright-inscription"]);
  assert.equal(localChronicleThreadSummaries(journal)[0].done,true);
  for(const id of MOONVALE_CHRONICLE_THREADS[1].siteIds)read(journal,id);
  assert.deepEqual(localChronicleAtlasMarkers(journal),[]);
  assert.equal(localChronicleThreadSummaries(journal)[1].done,true);
});
test("D15 forged/invalid journals fail closed and unknown entries grant no map pins",()=>{
  for(const journal of [null,undefined,{},[],new Map(),5,"site"]){
    const markers=localChronicleAtlasMarkers(journal);
    assert.deepEqual(markers,[]);
    assert.ok(Object.isFrozen(markers));
  }
  const fake=new Set(["made-up","reward","unknown-id"]);
  assert.deepEqual(localChronicleAtlasMarkers(fake).map(m=>m.siteId),
    ["red-lion-charter","millwright-inscription"]);
});
test("D15 sketch paints no hidden clue on top of local player marker",()=>{
  const world=getAuthoredMap(MAP_IDS.overworld);
  const j=createLocalLoreJournal();
  const {ctx,ops}=fakeCanvas();
  assert.equal(drawLocalChronicleAtlas(ctx,MAP_IDS.overworld,4365,4150,j),1,
    "near Red Lion player dot suppresses that same-location clue marker");
  assert.equal(ops.filter(x=>x.method==="fill").length,1);
  assert.equal(ops[0].method,"save");
  assert.equal(ops.at(-1).method,"restore");
  const marker=sites.get("millwright-inscription"),scale=(248-24)/Math.max(world.width,world.height);
  const p=ops.find(x=>x.method==="moveTo").args;
  assert.ok(Math.abs(p[0]-(12+marker.x*scale))<1e-8);
  assert.ok(Math.abs(p[1]-(12+marker.y*scale-4))<1e-8);
  assert.equal(ops.filter(x=>x.method==="lineTo").length,3);
  read(j,"red-lion-charter");
  const second=fakeCanvas();
  assert.equal(drawLocalChronicleAtlas(second.ctx,MAP_IDS.overworld,4365,4150,j),2);
  assert.equal(second.ops.filter(x=>x.method==="fill").length,2);
});
test("D15 overworld-only drawing rejects invalid canvas, map, positions and marker size",()=>{
  const journal=createLocalLoreJournal();
  const invalid=[
    [MAP_IDS.tavern,390,480,journal,248],
    ["fake-map",4365,4150,journal,248],
    [MAP_IDS.overworld,NaN,4150,journal,248],
    [MAP_IDS.overworld,4365,Infinity,journal,248],
    [MAP_IDS.overworld,9000,4150,journal,248],
    [MAP_IDS.overworld,4365,-1,journal,248],
    [MAP_IDS.overworld,4365,4150,journal,127],
    [MAP_IDS.overworld,4365,4150,journal,513],
    [MAP_IDS.overworld,4365,4150,journal,NaN],
  ];
  for(const args of invalid){
    const {ctx,ops}=fakeCanvas();
    assert.equal(drawLocalChronicleAtlas(ctx,...args),0);
    assert.equal(ops.length,0);
  }
  assert.equal(drawLocalChronicleAtlas(null,MAP_IDS.overworld,4365,4150,journal),0);
  const {ctx,ops}=fakeCanvas();
  assert.equal(drawLocalChronicleAtlas(ctx,MAP_IDS.overworld,4365,4150,null),0);
  assert.equal(ops.length,0);
  for(const size of [128,248,512]){
    const x=fakeCanvas();
    assert.equal(drawLocalChronicleAtlas(x.ctx,MAP_IDS.overworld,4365,4150,journal,size),1);
  }
});
test("D15 browser paints only in opened M sketch, reuses local F journal, no online APIs",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],
    {input:script[1],encoding:"utf8",timeout:10000});
  assert.equal(syntax.status,0,syntax.stderr);
  assert.match(html,/id="chronicle-atlas-key"/);
  assert.match(html,/Violet diamonds: next unread chronicle clues/);
  assert.match(script[1],/drawLocalChronicleAtlas\(wayfindingContext,mapId,player.x,player.y,loreJournal\)/);
  assert.match(script[1],/if\(!wayfindingMap.hidden\)/);
  assert.match(script[1],/chronicleAtlasKey.hidden=cluePins===0/);
  assert.match(script[1],/nextWayfindingAt=now\+250/);
  const module=readFileSync(new URL("../src/world/chronicle-atlas.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(module,/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|setTimeout|requestAnimationFrame|moveAuthoredPreview|advanceLocalExpedition/);
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
  for(const name of ["../web/online-game.mjs","../server/src/main.rs","../server/src/simulation.rs"])
    assert.doesNotMatch(readFileSync(new URL(name,import.meta.url),"utf8"),
      /chronicle-atlas|localChronicleAtlasMarkers|drawLocalChronicleAtlas/);
});
