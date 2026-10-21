import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {MAP_IDS,AUTHORED_MAPS} from "../src/world/authored-maps.mjs";
import {
 WORLD_ALPHA_SOLIDS_SCHEMA_VERSION,WORLD_ALPHA_SOLIDS_LAYOUT_ID,
 WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE,WORLD_ALPHA_CITY_WALL_WIDTH,
 WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS,deriveAlphaGreyhavenStaticSolids,
 worldAlphaGreyhavenSolidById,
} from "../src/world/alpha-solid-geometry.mjs";

const solids=WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS;
const byId=id=>worldAlphaGreyhavenSolidById(id);
const inside=(s,x,y)=>x>=s.min_x&&x<=s.max_x&&y>=s.min_y&&y<=s.max_y;
const circleTouches=(s,x,y,r)=>{
 const a=Math.max(s.min_x,Math.min(x,s.max_x)),b=Math.max(s.min_y,Math.min(y,s.max_y));
 return Math.hypot(x-a,y-b)<=r;
};
const solidAt=(x,y,r=18)=>solids.some(s=>circleTouches(s,x,y,r));
const sampleSegment=(a,b,step=4)=>{
 const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/step));
 for(let i=0;i<=count;i++){const t=i/count;
  if(solidAt(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false;
 }
 return true;
};
const closedSegmentIntersects=(a,b,box)=>{
 let enter=0,exit=1;
 for(const [start,delta,lo,hi] of [[a.x,b.x-a.x,box.min_x,box.max_x],
  [a.y,b.y-a.y,box.min_y,box.max_y]]){
  if(delta===0){if(start<lo||start>hi)return false;}
  else {const loT=(lo-start)/delta,hiT=(hi-start)/delta;
   enter=Math.max(enter,Math.min(loT,hiT));
   exit=Math.min(exit,Math.max(loT,hiT));
   if(enter>exit)return false;
  }
 }
 return exit>=0&&enter<=1;
};
const lineOfSight=(a,b)=>!solids.some(s=>closedSegmentIntersects(a,b,s));

test("World P0 solid witness is exactly 15 fixed buildings + 8 city wall spans",()=>{
 assert.equal(WORLD_ALPHA_SOLIDS_SCHEMA_VERSION,1);
 assert.equal(WORLD_ALPHA_SOLIDS_LAYOUT_ID,"moonvale-greyhaven-v10-solids-v1");
 assert.equal(WORLD_ALPHA_CITY_WALL_WIDTH,37);
 assert.equal(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.mapId,MAP_IDS.overworld);
 assert.equal(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.cityId,"greyhaven");
 assert.equal(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.requiresCoreFence,true);
 assert.equal(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE.includesRiverOrDynamicSolids,false);
 assert.equal(Object.hasOwn(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE,"complete"),false);
 assert.ok(Object.isFrozen(solids)&&Object.isFrozen(WORLD_ALPHA_PICKUP_GEOMETRY_SCOPE));
 assert.equal(solids.length,23);
 assert.equal(new Set(solids.map(s=>s.id)).size,23);
 assert.equal(solids.filter(s=>s.kind==="building").length,15);
 assert.equal(solids.filter(s=>s.kind==="city-wall").length,8);
 for(const solid of solids){
  assert.ok(Object.isFrozen(solid));
  assert.ok(["building","city-wall"].includes(solid.kind));
  assert.ok(["min_x","min_y","max_x","max_y"].every(k=>Number.isFinite(solid[k])));
  assert.ok(solid.min_x<solid.max_x&&solid.min_y<solid.max_y);
  assert.strictEqual(byId(solid.id),solid);
 }
 assert.equal(byId("not-existing"),null);
 assert.equal(byId(17),null);
});
test("World P0 building solids are the WHOLE existing authored collision footprints",()=>{
 const map=AUTHORED_MAPS[MAP_IDS.overworld];
 for(const b of map.buildings){
  const rect=byId("building:"+b.id);
  assert.ok(rect,b.id);
  assert.deepEqual([rect.min_x,rect.min_y,rect.max_x,rect.max_y],
   [b.x,b.y,b.x+b.w,b.y+b.h]);
 }
 assert.deepEqual([byId("building:smith").min_x,byId("building:smith").min_y,
  byId("building:smith").max_x,byId("building:smith").max_y],
  [3710,3850,3892,4012]);
 assert.deepEqual([byId("building:red-lion").min_x,byId("building:red-lion").min_y,
  byId("building:red-lion").max_x,byId("building:red-lion").max_y],
  [4240,3880,4490,4050]);
 assert.deepEqual(deriveAlphaGreyhavenStaticSolids(),solids);
});
test("World P0 gates stay OPEN at exact D2 Greyhaven geometry, walls stay solid",()=>{
 const expected={
  "north-west":[3501.5,3441.5,4057,3478.5],
  "north-east":[4203,3441.5,4778.5,3478.5],
  "south-west":[3501.5,4731.5,4057,4768.5],
  "south-east":[4203,4731.5,4778.5,4768.5],
  "west-north":[3501.5,3441.5,3538.5,4112],
  "west-south":[3501.5,4248,3538.5,4768.5],
  "east-north":[4741.5,3441.5,4778.5,4112],
  "east-south":[4741.5,4248,4778.5,4768.5],
 };
 for(const [id,coords] of Object.entries(expected)){
  const rect=byId("wall:"+id);
  assert.ok(rect,id);
  assert.deepEqual([rect.min_x,rect.min_y,rect.max_x,rect.max_y],coords,id);
 }
 for(const [x,y] of [[4130,3460],[4130,4750],[3520,4180],[4760,4180]]){
  assert.equal(solidAt(x,y,18),false,"gate blocked "+x+","+y);
 }
 for(const [x,y] of [[4000,3460],[4000,4750],[3520,4300],[4760,4300]]){
  assert.equal(solidAt(x,y,18),true,"wall vanished "+x+","+y);
 }
});
test("World P0 armory rack supports 4 simultaneous 18-radius approaches and LOS",()=>{
 const xs=[3740,3780,3820,3860];
 for(const x of xs){
  const sword={x,y:4038},player={x,y:4088};
  assert.equal(solidAt(x,4038,18),false);
  assert.equal(solidAt(x,4088,18),false);
  assert.equal(sampleSegment(sword,player),true);
  assert.equal(lineOfSight(sword,player),true);
  assert.equal(Math.hypot(sword.x-player.x,sword.y-player.y),50);
 }
 const blockedFrom={x:3800,y:3830},blockedTo={x:3780,y:4038};
 assert.equal(lineOfSight(blockedFrom,blockedTo),false,
   "cannot see a sword through the Blacksmith's solid interior");
});
test("World P0 four Core staging positions are clear and within city wall",()=>{
 const starts=[[4110,4160],[4206,4160],[4110,4256],[4206,4256]];
 for(const [x,y] of starts)assert.equal(solidAt(x,y,18),false);
 for(const start of starts){
  const a={x:start[0],y:start[1]},intermediate={x:3990,y:4180},b={x:3980,y:4090};
  assert.ok(sampleSegment(a,intermediate));
  assert.ok(sampleSegment(intermediate,b));
  for(const x of [3740,3780,3820,3860])
   assert.ok(sampleSegment(b,{x,y:4088}));
 }
});
test("World P0 altered/removal/invalid solids fail closed instead of silent drift",()=>{
 const map=AUTHORED_MAPS[MAP_IDS.overworld];
 assert.equal(deriveAlphaGreyhavenStaticSolids({...map,buildings:map.buildings.slice(1)}),null);
 assert.equal(deriveAlphaGreyhavenStaticSolids({...map,buildings:[...map.buildings.slice(0,-1),map.buildings[0]]}),null);
 assert.equal(deriveAlphaGreyhavenStaticSolids({...map,city:{...map.city,w:100}}),null);
 assert.equal(deriveAlphaGreyhavenStaticSolids({...map,buildings:[
  {...map.buildings[0],x:NaN},...map.buildings.slice(1)]}),null);
 assert.equal(deriveAlphaGreyhavenStaticSolids({...map,id:"another-world"}),null);
});
test("World P0 static geometry is read-only, not a client or server authority",()=>{
 const src=readFileSync(new URL("../src/world/alpha-solid-geometry.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(src,/fetch\(|WebSocket|WebTransport|localStorage|sessionStorage|document\.|window\./);
 assert.doesNotMatch(src,/^\s*complete:\s*true|worker_epoch\s*:|map_revision\s*:|TryPickup/m);
 for(const p of ["../web/online-game.mjs","../server/src/main.rs","../server/src/simulation.rs"]){
  assert.doesNotMatch(readFileSync(new URL(p,import.meta.url),"utf8"),
    /alpha-solid-geometry|WORLD_ALPHA_GREYHAVEN_STATIC_SOLIDS/);
 }
 assert.equal(solids.every(x=>Object.isFrozen(x)),true);
 const sha=createHash("sha256").update(JSON.stringify(solids)).digest("hex");
 assert.match(sha,/^[a-f0-9]{64}$/);
 console.log("WORLD_ALPHA_SOLIDS_SHA256 "+sha);
});
