import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {MOONVALE_LANDMARKS} from "../src/world/landmark-discovery.mjs";
import {MOONVALE_FIELD_SITES} from "../src/world/field-survey.mjs";
import {MOONVALE_ROADSIDE_LORE} from "../src/world/roadside-lore.mjs";
import {WORLD_CONNECTIVITY_AUDIT_VERSION,WORLD_CONNECTIVITY_STEP,
  WORLD_CONNECTIVITY_SAMPLE_STEP,WORLD_CONNECTIVITY_SNAP_RADIUS,
  auditAuthoredConnectivity} from "../scripts/audit-world-connectivity.mjs";

const synthetic={
  width:256,height:256,step:32,origin:{x:64,y:128},
  targets:[{id:"left-farm",x:64,y:64},{id:"east-outpost",x:192,y:128}],
};
const unobstructed=(x,y)=>x>=18&&y>=18&&x<=238&&y<=238;
const openGate=(x,y)=>unobstructed(x,y)&&!(
  Math.abs(x-128)<10 && Math.abs(y-128)>24
);
const closedGate=(x,y)=>unobstructed(x,y)&&Math.abs(x-128)>=10;
const thinWall=(x,y)=>unobstructed(x,y)&&Math.abs(x-112)>=2;

test("D17 canonical Moonvale flood fill reaches all 18 existing authored sites",()=>{
  assert.equal(WORLD_CONNECTIVITY_AUDIT_VERSION,1);
  assert.equal(WORLD_CONNECTIVITY_STEP,32);
  assert.equal(WORLD_CONNECTIVITY_SAMPLE_STEP,4);
  assert.equal(WORLD_CONNECTIVITY_SNAP_RADIUS,2);
  const r=auditAuthoredConnectivity();
  assert.ok(r.ok,JSON.stringify(r));
  assert.deepEqual(r.unreachable,[]);
  assert.equal(r.examined,18);
  assert.equal(r.totalGridCells,257*257);
  assert.ok(r.visitedGridCells>60000&&r.visitedGridCells<=r.totalGridCells);
  assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.reachable)&&Object.isFrozen(r.unreachable));
  assert.deepEqual(r.reachable.map(x=>x).sort(),
    [...MOONVALE_LANDMARKS,...MOONVALE_FIELD_SITES,...MOONVALE_ROADSIDE_LORE]
      .map(x=>x.id).sort());
});

test("D17 a synthetic open gate connects both sides; closing it isolates east",()=>{
  const open=auditAuthoredConnectivity({...synthetic,walkable:openGate});
  assert.ok(open.ok,JSON.stringify(open));
  assert.deepEqual(open.unreachable,[]);
  assert.deepEqual(open.reachable,["east-outpost","left-farm"]);
  const closed=auditAuthoredConnectivity({...synthetic,walkable:closedGate});
  assert.ok(!closed.ok);
  assert.deepEqual(closed.unreachable,["east-outpost"]);
  assert.deepEqual(closed.reachable,["left-farm"]);
  assert.ok(closed.visitedGridCells<open.visitedGridCells);
  assert.ok(Object.isFrozen(closed)&&Object.isFrozen(closed.unreachable));
});

test("D17 swept 4-unit samples catch a wall that lies BETWEEN open grid vertices",()=>{
  const island=auditAuthoredConnectivity({...synthetic,walkable:thinWall});
  assert.deepEqual(island.unreachable,["east-outpost"]);
  assert.deepEqual(island.reachable,["left-farm"]);
  // Grid cells x=96 and x=128 are both walkable. A naive node-only flood fill
  // would cross their connecting edge, whereas x=112 is blocked by the wall.
  assert.equal(thinWall(96,128),true);
  assert.equal(thinWall(128,128),true);
  assert.equal(thinWall(112,128),false);
});

test("D17 does not mark a geometrically valid but isolated target as reachable",()=>{
  const outside={...synthetic,targets:[
    {id:"inside",x:64,y:128},
    {id:"isolated-but-walkable",x:192,y:128},
    {id:"blocked-site",x:128,y:64},
  ],walkable:closedGate};
  const r=auditAuthoredConnectivity(outside);
  assert.equal(r.ok,false);
  assert.deepEqual(r.unreachable,["blocked-site","isolated-but-walkable"]);
  assert.deepEqual(r.reachable,["inside"]);
});

test("D17 invalid origin and unbounded map/target parameters fail closed",()=>{
  for(const overrides of [
    {width:9000},{height:9000},{step:0},{step:7},{step:65},
    {width:257},{height:1},{targets:Array.from({length:65},(_,i)=>({id:String(i),x:64,y:64}))},
    {walkable:null},{origin:{x:NaN,y:12}},{origin:{x:0,y:0}},
  ]){
    assert.throws(()=>auditAuthoredConnectivity({...synthetic,walkable:openGate,...overrides}),
      /invalid|unbounded|origin/i);
  }
});

test("D17 reports stable sorted IDs and ignores input order",()=>{
  const first=auditAuthoredConnectivity({...synthetic,walkable:closedGate});
  const reversed=auditAuthoredConnectivity({...synthetic,
    targets:[...synthetic.targets].reverse(),walkable:closedGate});
  assert.deepEqual(first,reversed);
  assert.ok(Object.isFrozen(first));
  assert.equal(first.version,1);
  for(const k of ["reward","item","xp","wallet","questCredit","loot","currency","serverTick"])
    assert.equal(Object.hasOwn(first,k),false);
});

test("D17 CLI is deterministic, read-only, Windows-safe and has no runtime wiring",()=>{
  const url=new URL("../scripts/audit-world-connectivity.mjs",import.meta.url);
  const cli=spawnSync(process.execPath,[fileURLToPath(url)],{encoding:"utf8",timeout:20000});
  assert.equal(cli.status,0,cli.stderr);
  assert.match(cli.stdout,/^World connectivity audit PASS: 18 authored sites connected to Greyhaven,/);
  const source=readFileSync(url,"utf8");
  assert.doesNotMatch(source,/writeFile|createWriteStream|fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|setTimeout|requestAnimationFrame/);
  for(const path of ["../server/src/main.rs","../server/src/simulation.rs","../web/online-game.mjs","../web/world-preview.html"]){
    assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),"utf8"),
      /audit-world-connectivity|auditAuthoredConnectivity/);
  }
});
