import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {isAuthoredPreviewWalkable,moveAuthoredPreview} from "../src/world/authored-preview-collision.mjs";
import {nearbyLocalFieldSite,createLocalFieldNotebook} from "../src/world/field-survey.mjs";
import {createLocalExpeditionState,chooseLocalExpedition,localExpeditionProgress} from "../src/world/local-expeditions.mjs";
import {ROADSIDE_LORE_VERSION,ROADSIDE_LORE_REACH,MOONVALE_ROADSIDE_LORE,
  createLocalLoreJournal,nearbyLocalLoreSite,readLocalLore,localLoreProgress} from "../src/world/roadside-lore.mjs";

test("D13 six authored records are immutable, individually walkable and uniquely addressed",()=>{
  assert.equal(ROADSIDE_LORE_VERSION,1);
  assert.equal(ROADSIDE_LORE_REACH,68);
  assert.ok(Object.isFrozen(MOONVALE_ROADSIDE_LORE));
  assert.equal(MOONVALE_ROADSIDE_LORE.length,6);
  assert.equal(new Set(MOONVALE_ROADSIDE_LORE.map(s=>s.id)).size,6);
  const map=getAuthoredMap(MAP_IDS.overworld);
  for(const site of MOONVALE_ROADSIDE_LORE){
    assert.ok(Object.isFrozen(site));
    assert.match(site.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(site.mapId,map.id);
    assert.ok(site.region.length>=8);
    assert.ok(site.clue.length>=35);
    assert.ok(site.passage.length>=80);
    assert.ok(isAuthoredPreviewWalkable(site.mapId,site.x,site.y),site.id);
    assert.equal(nearbyLocalLoreSite(site.mapId,site.x,site.y)?.id,site.id);
  }
});

test("D13 F-only read records one account per site and never persists across visitors",()=>{
  const first=createLocalLoreJournal(),second=createLocalLoreJournal();
  assert.deepEqual(localLoreProgress(first),{documented:0,total:6});
  assert.equal(first.size,0);
  for(const s of MOONVALE_ROADSIDE_LORE){
    assert.strictEqual(readLocalLore(first,s.mapId,s.x,s.y),s);
    assert.equal(readLocalLore(first,s.mapId,s.x,s.y),null,"repeat F does not duplicate lore");
  }
  assert.deepEqual(localLoreProgress(first),{documented:6,total:6});
  assert.deepEqual(localLoreProgress(second),{documented:0,total:6});
  const firstSite=MOONVALE_ROADSIDE_LORE[0];
  assert.ok(readLocalLore(second,firstSite.mapId,firstSite.x,firstSite.y));
  assert.equal(first.size,6);
  assert.equal(second.size,1);
  assert.ok(Object.isFrozen(localLoreProgress(first)));
});

test("D13 proximity must reject wrong zone, fake journal, blocked and nonfinite world coordinates",()=>{
  const s=MOONVALE_ROADSIDE_LORE[0],journal=createLocalLoreJournal();
  const invalid=[
    [MAP_IDS.tavern,s.x,s.y],["fake-zone",s.x,s.y],
    [MAP_IDS.overworld,NaN,s.y],[MAP_IDS.overworld,Infinity,s.y],
    [MAP_IDS.overworld,s.x,-1],[MAP_IDS.overworld,8192,s.y],
    [MAP_IDS.overworld,4365,4000],[MAP_IDS.overworld,1940,3840],
    [MAP_IDS.overworld,250,250]
  ];
  for(const [map,x,y] of invalid){
    assert.equal(nearbyLocalLoreSite(map,x,y),null);
    assert.equal(readLocalLore(journal,map,x,y),null);
  }
  assert.equal(readLocalLore({},s.mapId,s.x,s.y),null);
  assert.equal(readLocalLore(null,s.mapId,s.x,s.y),null);
  assert.deepEqual(localLoreProgress(null),{documented:0,total:6});
  assert.equal(journal.size,0);
});

test("D13 lore is purely narrative and never issues economy, combat or quest entitlements",()=>{
  const s=MOONVALE_ROADSIDE_LORE[0],journal=createLocalLoreJournal();
  const read=readLocalLore(journal,s.mapId,s.x,s.y);
  assert.deepEqual(Object.keys(read),["id","mapId","name","x","y","region","clue","passage"]);
  for(const key of ["reward","item","weapon","equipment","loot","XP","gold","coin","wallet",
    "harvest","stock","property","experience","questCredit"])
    assert.ok(!Object.hasOwn(read,key),key);
  const route=createLocalExpeditionState();
  assert.equal(chooseLocalExpedition(route,"greyhaven-circuit"),true);
  assert.equal(localExpeditionProgress(route).stepsCompleted,0);
  const resources=createLocalFieldNotebook();
  assert.equal(resources.size,0);
  assert.equal(localLoreProgress(journal).documented,1);
  assert.equal(route.stepIndex,0);
});

test("D13 crossing a site without F does not grant lore",()=>{
  const site=MOONVALE_ROADSIDE_LORE[0],journal=createLocalLoreJournal();
  const walker=moveAuthoredPreview(MAP_IDS.overworld,{x:site.x,y:site.y},8,0);
  assert.ok(walker);
  assert.ok(nearbyLocalLoreSite(MAP_IDS.overworld,walker.x,walker.y));
  assert.equal(journal.size,0);
});

test("D13 nearest field/lore priority keeps Fallen Watch ore and inscription independently usable",()=>{
  const s=MOONVALE_ROADSIDE_LORE.find(s=>s.id==="fallen-watch-signal");
  const ore=nearbyLocalFieldSite(s.mapId,s.x,s.y);
  assert.equal(ore?.id,"fallen-watch-iron");
  assert.ok(Math.hypot(s.x-ore.x,s.y-ore.y)>0);
  const fieldAtLore=nearbyLocalFieldSite(s.mapId,s.x,s.y);
  assert.ok(Math.hypot(s.x-s.x,s.y-s.y)<
    Math.hypot(fieldAtLore.x-s.x,fieldAtLore.y-s.y),"lore wins at plaque");
  const loreAtOre=nearbyLocalLoreSite(s.mapId,ore.x,ore.y);
  assert.equal(loreAtOre?.id,s.id);
  assert.ok(Math.hypot(ore.x-ore.x,ore.y-ore.y)<
    Math.hypot(loreAtOre.x-ore.x,loreAtOre.y-ore.y),"field wins at ore");
  const west=MOONVALE_ROADSIDE_LORE.find(s=>s.id==="bridge-wardens-mark");
  assert.equal(nearbyLocalFieldSite(west.mapId,west.x,west.y),null);
});

test("D13 browser exposes accessible journal, visible markers, F arbitration and no live code wiring",()=>{
  const html=readFileSync(new URL("../web/world-preview.html",import.meta.url),"utf8");
  const script=html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script);
  const syntax=spawnSync(process.execPath,["--check","--input-type=module"],{
    input:script[1],encoding:"utf8",timeout:10000
  });
  assert.equal(syntax.status,0,syntax.stderr);
  for(const token of ['id="lore-progress"','id="lore-journal"','id="lore-notice"',
    'id="lore-hud"','class="lore-panel"','aria-label="Roadside lore"'])
    assert.ok(html.includes(token),token);
  assert.match(script[1],/if\(e.code==="KeyF"&&!e.repeat\)/);
  assert.match(script[1],/if\(loreSite && loreDistance<fieldDistance\)/);
  assert.match(script[1],/readLocalLore\(loreJournal,mapId,player.x,player.y\)/);
  assert.match(script[1],/observeLocalFieldSite\(fieldNotebook,mapId,player.x,player.y\)/);
  assert.match(script[1],/advanceLocalExpedition\(expeditionState,mapId,player.x,player.y,"inspect"\)/);
  assert.match(script[1],/for\(const site of MOONVALE_ROADSIDE_LORE\)/);
  assert.doesNotMatch(script[1],/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage/);
  for(const p of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    assert.doesNotMatch(readFileSync(new URL(p,import.meta.url),"utf8"),
      /roadside-lore|readLocalLore|localLoreProgress/);
  }
});
