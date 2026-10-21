// Graphics 3C P0: integration seam to a caller-provided World #521 canonical
// facade validator. This never copies the World-owned Red Lion allowlist or
// approves actor/door/collision gameplay. All replacements default to none.
import assert from "node:assert/strict";
import test from "node:test";
import {MAP_IDS,getAuthoredMap} from "../src/world/authored-maps.mjs";
import {createAuthoredWorldRenderer} from "../src/browser/authored-world-renderer.mjs";

const map=getAuthoredMap(MAP_IDS.overworld);
const redLion=map.buildings.find(b=>b.id==="red-lion");
const smith=map.buildings.find(b=>b.id==="smith");
assert.ok(redLion&&smith);

// The injected callback is a TEST stand-in for World #521's pure canonical
// function; the optional external-source verifier tests the actual World
// function with a pinned independent source worktree.
const worldLikeValidator=(id,ids)=>{
  if(id!==MAP_IDS.overworld||!Array.isArray(ids)||ids.some(x=>x!=="red-lion")||
     new Set(ids).size!==ids.length)throw new RangeError("World disallows replacement");
  return Object.freeze([...ids]);
};
function scene(replacement,validator){
 const records={labels:[],rects:[],portalArcs:[],canvases:0};
 const tileCtx={
   save(){},restore(){},translate(){},fill(){},stroke(){},beginPath(){},
   moveTo(){},lineTo(){},arc(x,y,r){if(r===17)records.portalArcs.push([x,y,r])},ellipse(){},
   fillRect(x,y,w,h){records.rects.push([x,y,w,h])},strokeRect(){},
   fillText(s){records.labels.push(s)}
 };
 const painter=createAuthoredWorldRenderer({
   buildLimit:8,cacheCap:24,replacedBuildingIds:replacement,
   ...(validator?{worldReplacementValidator:validator}:{}),
   makeCanvas(){records.canvases++;return {width:0,height:0,getContext(){return tileCtx}}}
 });
 const screen={fillRect(){},drawImage(){}};
 const cx=redLion.x+redLion.w/2,cy=redLion.y+redLion.h/2;
 painter.draw(screen,MAP_IDS.overworld,{x:cx,y:cy},640,640,1);
 return {records,painter};
}
test("P0 default 3C remains original Red Lion placeholder by default",()=>{
 const {records,painter}=scene([]);
 assert.deepEqual(painter.replacedBuildingIds,[]);
 assert.ok(Object.isFrozen(painter.replacedBuildingIds));
 assert.ok(records.labels.includes("RED LION"));
 assert.ok(records.canvases>0);
});
test("P0 canonical World-approved Red Lion facade suppresses only the cached placeholder",()=>{
 const before=scene([]);
 const selected=["red-lion"];
 const after=scene(selected,worldLikeValidator);
 assert.deepEqual(after.painter.replacedBuildingIds,["red-lion"]);
 selected.push("smith"); // mutable caller reference must never alter cached paint
 assert.deepEqual(after.painter.replacedBuildingIds,["red-lion"]);
 assert.ok(!after.records.labels.includes("RED LION"));
 assert.ok(after.records.canvases>0);
 assert.ok(before.records.labels.includes("RED LION"));
 assert.deepEqual(after.records.portalArcs,before.records.portalArcs,"portal rings must stay painted");
 assert.ok(after.records.rects.length<before.records.rects.length,
   "only the original placeholder draw and its decorative rectangles are excluded");
});
test("P0 never accepts optional replacement without original World validation",()=>{
 assert.throws(()=>createAuthoredWorldRenderer({replacedBuildingIds:["red-lion"]}),
  /validator required/);
 for(const forbidden of [["smith"],["red-lion","red-lion"],["unapproved"],[1]]){
  assert.throws(()=>createAuthoredWorldRenderer({
   replacedBuildingIds:forbidden,worldReplacementValidator:worldLikeValidator}),RangeError);
 }
 for(const bad of [null,{}, "red-lion"]){
  assert.throws(()=>createAuthoredWorldRenderer({replacedBuildingIds:bad}),RangeError);
 }
});
test("P0 invalid World callbacks fail closed and cannot create a poisoned tile cache",()=>{
 const input=["red-lion"];
 const mutators=[
   ()=>["red-lion","smith"],()=>["smith"],()=>["red-lion","red-lion"],
   ()=>"red-lion",()=>[],()=>null
 ];
 for(const validator of mutators)assert.throws(()=>createAuthoredWorldRenderer({
   replacedBuildingIds:input,worldReplacementValidator:validator}),RangeError);
 assert.throws(()=>createAuthoredWorldRenderer({
   replacedBuildingIds:input,worldReplacementValidator:123
 }),RangeError);
 assert.ok(map.buildings.find(x=>x.id===smith.id));
});
