// First Playable P0 — WORLD-OWNED positional compatibility ONLY.
//
// This check freezes the authored Blacksmith rack layout against the
// independently reviewed Items 2B prototype PICKUP_REACH=56.0
// (tehki/myaso Items #530, server/src/loot.rs, head 6cbad2f7361755d878b3c405b832815ee384467d).
// It is NOT a server reach setting, item ledger, click action, target selector
// or proof of authenticated same-tick Physics LOS.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 WORLD_ALPHA_ARMORY,
 WORLD_ALPHA_SWORD_RACK_SOCKETS,
 WORLD_ALPHA_SPAWN_COORDINATES,
 getWorldAlphaSwordSocket,
} from "../src/world/alpha-armory.mjs";
import {MAP_IDS} from "../src/world/authored-maps.mjs";

const REVIEWED_ITEMS_PROTOTYPE_REACH = 56;
const AUTHORING_ACTOR_RADIUS = 18;
const squareDistance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const inReach=(actor,sword)=>squareDistance(actor,sword)<=REVIEWED_ITEMS_PROTOTYPE_REACH**2;
const eligibleSockets=(actor)=>WORLD_ALPHA_SWORD_RACK_SOCKETS.filter(s=>inReach(actor,s));

test("P0 reviewed four static sword sockets remain unique in the shared outdoor city",()=>{
 assert.equal(WORLD_ALPHA_ARMORY.layout,"outdoor-open-front");
 assert.equal(WORLD_ALPHA_ARMORY.mapId,MAP_IDS.overworld);
 assert.equal(WORLD_ALPHA_ARMORY.requiresZoneTransfer,false);
 assert.equal(WORLD_ALPHA_ARMORY.hasImplicitInventory,false);
 assert.equal(WORLD_ALPHA_SWORD_RACK_SOCKETS.length,4);
 assert.equal(WORLD_ALPHA_SPAWN_COORDINATES.length,4);
 assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>s.socketId),
  ["greyhaven-rack-1","greyhaven-rack-2","greyhaven-rack-3","greyhaven-rack-4"]);
 assert.deepEqual(WORLD_ALPHA_SWORD_RACK_SOCKETS.map(s=>[s.x,s.y,s.approach.x,s.approach.y]),[
  [3740,4038,3740,4088],
  [3780,4038,3780,4088],
  [3820,4038,3820,4088],
  [3860,4038,3860,4088],
 ]);
});

test("P0 each exact standing point is reachable to ONLY its own sword at reviewed Items reach",()=>{
 assert.equal(REVIEWED_ITEMS_PROTOTYPE_REACH,56);
 for(const socket of WORLD_ALPHA_SWORD_RACK_SOCKETS){
  const actual=eligibleSockets(socket.approach);
  assert.deepEqual(actual.map(s=>s.socketId),[socket.socketId]);
  assert.equal(squareDistance(socket.approach,socket),2500,"50-unit own-sword separation");
  const others=WORLD_ALPHA_SWORD_RACK_SOCKETS.filter(s=>s!==socket);
  assert.ok(others.every(s=>squareDistance(socket.approach,s)>56**2));
  assert.equal(getWorldAlphaSwordSocket(socket.socketId),socket);
 }
});

test("P0 rack geometry allows four distinct radius-18 player standings",()=>{
 for(let i=0;i<WORLD_ALPHA_SWORD_RACK_SOCKETS.length;i++){
  const player=WORLD_ALPHA_SWORD_RACK_SOCKETS[i].approach;
  for(let j=i+1;j<WORLD_ALPHA_SWORD_RACK_SOCKETS.length;j++){
   const other=WORLD_ALPHA_SWORD_RACK_SOCKETS[j].approach;
   assert.ok(squareDistance(player,other)>=(2*AUTHORING_ACTOR_RADIUS)**2,
    "players must not overlap at nominal rack stands");
  }
 }
});

test("P0 midpoint is within TWO sword reaches: never substitute nearest-sword auto-pick",()=>{
 // Both slots are eligible by *distance* at the midpoint even with reach=56.
 // UI must retain exact visible sprite selection; server must independently
 // validate selected ground-entity + canonical item ID in one fenced commit.
 for(let i=0;i<3;i++){
  const left=WORLD_ALPHA_SWORD_RACK_SOCKETS[i];
  const right=WORLD_ALPHA_SWORD_RACK_SOCKETS[i+1];
  const midpoint={x:(left.approach.x+right.approach.x)/2,y:left.approach.y};
  assert.equal(squareDistance(midpoint,left),2900);
  assert.equal(squareDistance(midpoint,right),2900);
  assert.deepEqual(eligibleSockets(midpoint).map(s=>s.socketId),
   [left.socketId,right.socketId]);
 }
 // The World socket-ID resolver is exact-only. It never resolves a coordinate
 // into an item ID, player inventory, entity ID or trusted pickup claim.
 assert.equal(getWorldAlphaSwordSocket("greyhaven-rack-1 " ),null);
 assert.equal(getWorldAlphaSwordSocket({x:3740,y:4038}),null);
});

test("P0 56-unit pickup envelope has only 6 units of nominal outbound tolerance",()=>{
 for(const socket of WORLD_ALPHA_SWORD_RACK_SOCKETS){
  const a=socket.approach;
  assert.equal(inReach({...a,y:a.y+6},socket),true,"56-unit edge inclusive");
  assert.equal(inReach({...a,y:a.y+7},socket),false,"57 units rejects");
  assert.equal(inReach({...a,x:a.x+20},socket),true,
   "horizontal movement toward adjacent sword can make more than one eligible");
 }
});

test("P0 preview test cannot grant items or weaken protected Physics/Core authority",()=>{
 const world=readFileSync(new URL("../src/world/alpha-armory.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(world,/fetch\(|WebSocket|WebTransport|TryPickup|commit_verified|equippedSwordId|worldItemId\s*:/);
 const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(online,/world-alpha-rack-selection-range\.test\.mjs/);
});
