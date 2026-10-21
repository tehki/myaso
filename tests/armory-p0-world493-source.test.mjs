import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WORLD493_RACK_BRIDGE,createWorld493RackArtPlan} from "../src/browser/armory-world493-visual-bridge.mjs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
import {projectArenaPoint,ARENA_VIEW_ZOOM} from "../src/browser/arena-viewport.mjs";
const root=new URL("../",import.meta.url),asset="assets/environment/greyhaven/armory-p0/world493-review/";
const load=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(load(p).toString("utf8"));
const report=json(asset+"armory_p0_world493_native_report.json");
// Fixture below echoes actual pinned World #493 shape; native browser harness
// separately imports the real unmodified module and validates exact Git SHA.
const map={id:"moonvale-overworld",buildings:[
  {id:"smith",kind:"smith",x:3710,y:3850,w:182,h:162}]};
const sockets=[3740,3780,3820,3860].map((x,i)=>({
  socketId:"greyhaven-rack-"+(i+1),displayCategory:"sword",
  mapId:map.id,x,y:4038,approach:{x,y:4088}}));
const armory={id:"greyhaven-smith-open-front",buildingId:"smith",mapId:map.id,
 layout:"outdoor-open-front",requiresZoneTransfer:false,
 hasImplicitInventory:false,rackSockets:sockets};
const items=sockets.map((s,i)=>({itemId:"ART-ONLY-NO-SERVER-"+i,
 socketId:s.socketId,zoneId:map.id,visualKind:"sword",location:"rack",revision:i}));
const create=(extra={})=>createWorld493RackArtPlan({
  authoredMap:map,worldArmory:armory,layoutVersion:1,
  committedWorldItems:items,camera:{x:3800,y:4038},...extra});

test("P0 World #493 approved authored layout translates exactly once into separate rack/sword drawing without inventing items",()=>{
 assert.equal(WORLD493_RACK_BRIDGE.sourceHead,"07060f981b8a1dac89184b621b6893dd970a08ae");
 assert.equal(WORLD493_RACK_BRIDGE.sourcePr,493);
 assert.equal(WORLD493_RACK_BRIDGE.productionApproved,false);
 const original=structuredClone(items),worldCopy=structuredClone(armory);
 const p=create();
 assert.equal(p.count,4);
 assert.equal(p.worldSourceContractMatched,true);
 assert.equal(p.serverSocketAuthorityVerified,false);
 assert.equal(p.authoritativePickupEnabled,false);
 assert.equal(p.actualGameSceneIntegrated,false);
 assert.equal(p.productionApproved,false);
 assert.equal(p.zoneId,map.id);
 assert.equal(p.rackVersion,"greyhaven-smith-open-front/v1");
 assert.deepEqual(p.rack.worldXY,{x:3800,y:4038});
 assert.equal(p.rack.x,200);
 assert.equal(p.rack.y,154);
 assert.equal(p.swords.length,4);
 for(let i=0;i<4;i++){
  const s=p.swords[i],pt=projectArenaPoint(sockets[i].x,4038,3800,4038,640,640);
  assert.deepEqual([s.x,s.y],[pt.x-21,pt.y-115]);
  assert.equal(s.socketId,sockets[i].socketId);
  assert.equal(s.id,items[i].itemId);
  assert.equal(s.revision,i);
  assert.equal(s.asset,ARMORY_RACK_ART.swordSource);
 }
 assert.deepEqual(items,original);
 assert.deepEqual(armory,worldCopy);
 assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.swords));
 assert.equal(ARENA_VIEW_ZOOM,.84);
 const empty=create({committedWorldItems:[]});
 assert.equal(empty.count,0);
 assert.deepEqual(empty.swords,[]);
});

test("P0 World #493 layout/interface must fail closed on mismatched IDs, sockets, zone, geometry or incomplete identity",()=>{
 const examples=[
  {layoutVersion:2},
  {worldArmory:{...armory,layout:"indoor-fake-portal"}},
  {worldArmory:{...armory,requiresZoneTransfer:true}},
  {worldArmory:{...armory,hasImplicitInventory:true}},
  {worldArmory:{...armory,mapId:"other"}},
  {worldArmory:{...armory,rackSockets:sockets.slice(0,3)}},
  {worldArmory:{...armory,rackSockets:[...sockets.slice(0,3),sockets[0]]}},
  {worldArmory:{...armory,rackSockets:[...sockets.slice(0,3),{...sockets[3],x:3780}]}},
  {worldArmory:{...armory,rackSockets:[...sockets.slice(0,3),{...sockets[3],y:4050}]}},
  {worldArmory:{...armory,rackSockets:[...sockets.slice(0,3),{...sockets[3],approach:{x:3860,y:4089}}]}},
  {worldArmory:{...armory,rackSockets:[...sockets.slice(0,3),{...sockets[3],socketId:"greyhaven-rack-5"}]}},
  {authoredMap:{...map,buildings:[{...map.buildings[0],x:3711}]}},
  {committedWorldItems:[{...items[0],itemId:""}]},
  {committedWorldItems:[{...items[0],zoneId:"another-zone"}]}
 ];
 for(const e of examples)assert.throws(()=>create(e),JSON.stringify(e).slice(0,50));
 // Exact World source still requires server-authenticated item snapshots.
 assert.equal(create().authoritativePickupEnabled,false);
});

test("P0 browser captured real World #493 source module/terrain and original Blender alpha pixel response in Chrome+Firefox",()=>{
 assert.equal(report.pinnedWorldHead,WORLD493_RACK_BRIDGE.sourceHead);
 assert.equal(report.socketsFromOriginalWorldModule,true);
 assert.equal(report.originalWorldSourcesUnmodified,true);
 assert.equal(report.canonicalItemIdsPresent,false);
 assert.equal(report.serverCollisionAttested,false);
 assert.equal(report.onlineGameIntegration,false);
 assert.equal(report.realFourPlayers,false);
 assert.equal(report.productionApproved,false);
 const expected={
  "/__world493__/src/world/alpha-armory.mjs":"305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf",
  "/__world493__/src/world/authored-maps.mjs":"21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144",
  "/__world493__/src/browser/authored-world-renderer.mjs":"db5274b9ad3ea8e28f4a2ef44358cfed247d0625785dc353577a3ee6d136f9e9",
 };
 assert.deepEqual(report.sourceFileHashes,expected);
 assert.equal(report.browsers.length,2);
 for(const name of ["chrome","firefox"]){
  const b=report.browsers.find(x=>x.engine===name);
  assert.ok(b);
  assert.match(b.version,name==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(b.errors,[]);
  assert.deepEqual(b.initial.officialSwordAnchors,[[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
  assert.equal(b.initial.renderedSwords,4);
  assert.equal(b.initial.cachedTiles,6);
  assert.equal(b.initial.realWorldTerrainRenderer,true);
  assert.equal(b.initial.authenticatedServerItems,false);
  assert.equal(b.initial.pickupCommitted,false);
  assert.equal(b.initial.productionApproved,false);
  assert.equal(b.opaqueClick,"ART-ONLY-NO-SERVER-0");
  assert.equal(b.afterTransparent,null);
  assert.equal(b.claimedServerItemPickups,0);
  assert.equal(b.claimedCombatSuppression,0);
  assert.equal(b.realGameRendered,false);
  for(const name of b.screenshots){
   const png=load(asset+name);
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(png.readUInt32BE(16),1100);
   assert.ok(png.length>50000);
  }
 }
});

test("P0 World #493 browser is read-only; no live World/Main/Combat/Net hooking",()=>{
 const ui=load("web/armory-p0-world493-review.mjs").toString("utf8");
 const harness=load("tools/art/verify_armory_world493_browser.mjs").toString("utf8");
 assert.match(ui,/createAuthoredWorldRenderer/);
 assert.match(ui,/WORLD_ALPHA_ARMORY/);
 assert.match(ui,/createWorld493RackArtPlan/);
 assert.match(ui,/hitTestVisibleSwordAlpha/);
 assert.match(ui,/ART-ONLY-NO-SERVER/);
 assert.doesNotMatch(ui,/WebSocket|TryPickup|localStorage|XMLHttpRequest/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/webDriverBiDi/);
 assert.doesNotMatch(load("web/online-game.mjs").toString("utf8"),/createWorld493RackArtPlan/);
});
