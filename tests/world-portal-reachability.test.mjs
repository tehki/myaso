import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {MAP_IDS,AUTHORED_MAPS,previewPortalDestination} from "../src/world/authored-maps.mjs";
import {isAuthoredPreviewWalkable} from "../src/world/authored-preview-collision.mjs";
import {WORLD_PORTAL_AUDIT_VERSION,PREVIEW_PORTAL_ORIGINS,
 PREVIEW_PORTAL_GRID_STEPS,auditPreviewPortals} from "../scripts/audit-world-portals.mjs";

const names=[MAP_IDS.overworld,MAP_IDS.tavern];
const model=()=>({
  [MAP_IDS.overworld]:{
    id:MAP_IDS.overworld,kind:"outdoor",width:256,height:256,
    portals:[{id:"enter",x:192,y:96,radius:35,targetMap:MAP_IDS.tavern,targetPortal:"exit"}],
  },
  [MAP_IDS.tavern]:{
    id:MAP_IDS.tavern,kind:"interior",width:256,height:256,
    portals:[{id:"exit",x:192,y:128,radius:30,targetMap:MAP_IDS.overworld,targetPortal:"enter"}],
  },
});
const origins={
  [MAP_IDS.overworld]:{x:64,y:128},
  [MAP_IDS.tavern]:{x:64,y:128},
};
const gridSteps={[MAP_IDS.overworld]:16,[MAP_IDS.tavern]:16};
const free=(mapId,x,y)=>names.includes(mapId)&&x>=18&&y>=18&&x<=238&&y<=238;
const synthetic=patch=>({maps:model(),origins,gridSteps,walkable:free,...patch});
const has=(report,code)=>assert.ok(report.errors.some(e=>e.code===code),
  code+" missing: "+JSON.stringify(report.errors));

test("D18 Red Lion reciprocal portal endpoints and landing offsets are reachable",()=>{
  assert.equal(WORLD_PORTAL_AUDIT_VERSION,1);
  assert.equal(PREVIEW_PORTAL_ORIGINS[MAP_IDS.overworld].x,4365);
  assert.equal(PREVIEW_PORTAL_GRID_STEPS[MAP_IDS.tavern],20);
  const canonical=auditPreviewPortals();
  assert.ok(canonical.ok,JSON.stringify(canonical.errors));
  assert.ok(Object.isFrozen(canonical)&&Object.isFrozen(canonical.errors)&&Object.isFrozen(canonical.checks));
  assert.equal(canonical.checks.length,2);
  assert.ok(canonical.checks.every(c=>c.points===2&&c.reachable===2&&Object.isFrozen(c)));
  assert.deepEqual(auditPreviewPortals(),canonical);
  const entrance=AUTHORED_MAPS[MAP_IDS.overworld].portals[0];
  const exit=AUTHORED_MAPS[MAP_IDS.tavern].portals[0];
  assert.deepEqual(previewPortalDestination(MAP_IDS.overworld,entrance.id),
    {mapId:MAP_IDS.tavern,x:exit.x,y:exit.y-70});
  assert.deepEqual(previewPortalDestination(MAP_IDS.tavern,exit.id),
    {mapId:MAP_IDS.overworld,x:entrance.x,y:entrance.y+68});
  for(const [map,x,y] of [
    [MAP_IDS.overworld,entrance.x,entrance.y],
    [MAP_IDS.tavern,exit.x,exit.y],
    [MAP_IDS.tavern,exit.x,exit.y-70],
    [MAP_IDS.overworld,entrance.x,entrance.y+68],
  ])assert.ok(isAuthoredPreviewWalkable(map,x,y));
});

test("D18 synthetic two-zone reciprocal links work when both zones are open",()=>{
  const r=auditPreviewPortals(synthetic());
  assert.ok(r.ok,JSON.stringify(r.errors));
  assert.deepEqual(r.checks.map(c=>[c.mapId,c.points,c.reachable]),
    [[MAP_IDS.overworld,2,2],[MAP_IDS.tavern,2,2]].sort((a,b)=>a[0].localeCompare(b[0])));
});

test("D18 missing return portal, wrong backlink and duplicate IDs fail closed",()=>{
  const absent=model();
  absent[MAP_IDS.tavern].portals=[];
  has(auditPreviewPortals(synthetic({maps:absent})),"INVALID_MAP");
  has(auditPreviewPortals(synthetic({maps:absent})),"MISSING_RECIPROCAL_PORTAL");

  const changed=model();
  changed[MAP_IDS.tavern].portals[0].targetPortal="some-other";
  has(auditPreviewPortals(synthetic({maps:changed})),"NONRECIPROCAL_PORTAL");

  const duplicated=model();
  duplicated[MAP_IDS.tavern].portals[0].id="enter";
  has(auditPreviewPortals(synthetic({maps:duplicated})),"DUPLICATE_PORTAL");
});

test("D18 malformed portal or physically blocked portal cannot pass",()=>{
  const badRadius=model();
  badRadius[MAP_IDS.overworld].portals[0].radius=0;
  has(auditPreviewPortals(synthetic({maps:badRadius})),"INVALID_PORTAL_GEOMETRY");

  const wrongZone=model();
  wrongZone[MAP_IDS.overworld].portals[0].targetMap="invented-zone";
  has(auditPreviewPortals(synthetic({maps:wrongZone})),"UNKNOWN_PORTAL_DESTINATION");

  const blocked=auditPreviewPortals(synthetic({walkable:(id,x,y)=>
    free(id,x,y)&&!(id===MAP_IDS.overworld&&x===192&&y===96)}));
  has(blocked,"BLOCKED_PORTAL");
});

test("D18 blocked transfer landing is rejected independently from valid trigger",()=>{
  const result=auditPreviewPortals(synthetic({walkable:(id,x,y)=>
    free(id,x,y)&&!(id===MAP_IDS.tavern&&x===192&&y===26)}));
  has(result,"BLOCKED_PORTAL_LANDING");
});

test("D18 walkable but isolated entrance and landing fail zone traversal",()=>{
  const barrier=(id,x,y)=>free(id,x,y)&&
    (id!==MAP_IDS.overworld||Math.abs(x-128)>=4);
  const result=auditPreviewPortals(synthetic({walkable:barrier}));
  has(result,"UNREACHABLE_PORTAL_POINT");
  assert.ok(result.errors.some(e=>e.detail.includes("trigger:enter")));
  assert.ok(result.errors.some(e=>e.detail.includes("landing:exit")));
  assert.ok(result.checks.find(c=>c.mapId===MAP_IDS.overworld).reachable===0);
});

test("D18 invalid map size and impossible origin fail with diagnostics",()=>{
  const badDimensions=model();
  badDimensions[MAP_IDS.tavern].width=255;
  has(auditPreviewPortals(synthetic({maps:badDimensions})),"INVALID_CONNECTIVITY_CONFIG");
  const wrongOrigin={
    ...origins,[MAP_IDS.overworld]:{x:NaN,y:128},
  };
  has(auditPreviewPortals(synthetic({origins:wrongOrigin})),"INVALID_CONNECTIVITY_CONFIG");
  assert.throws(()=>auditPreviewPortals({maps:null}),/invalid/i);
});

test("D18 CLI is cross-platform, read-only and does not wire live authority",()=>{
  const url=new URL("../scripts/audit-world-portals.mjs",import.meta.url);
  const cli=spawnSync(process.execPath,[fileURLToPath(url)],{encoding:"utf8",timeout:30000});
  assert.equal(cli.status,0,cli.stderr);
  assert.match(cli.stdout,/^World portal audit PASS: 2 reciprocal zones; 4 spawn-reachable trigger\/landing points\./);
  const source=readFileSync(url,"utf8");
  assert.doesNotMatch(source,/writeFile|createWriteStream|fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|setTimeout|requestAnimationFrame/);
  for(const path of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs"]){
    assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),"utf8"),
      /audit-world-portals|auditPreviewPortals/);
  }
});
