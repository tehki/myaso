import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
import {projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {createOriginalRedLionLiveArt,ORIGINAL_RED_LION_WORLD_ANCHOR as A,
 ORIGINAL_RED_LION_ART} from "../src/browser/red-lion-live-art.mjs";

const root=new URL("../assets/environment/greyhaven/a232-review/",import.meta.url);
function context(){
 const calls=[];
 return {calls,
  save(){calls.push(["save"])},restore(){calls.push(["restore"])},
  translate(x,y){calls.push(["translate",x,y])},
  scale(x,y){calls.push(["scale",x,y])},
  drawImage(...a){calls.push(["drawImage",...a])},
  clearRect(...a){calls.push(["clearRect",...a])}};
}
function fakeCanvas(){
 const ctx=context();
 return {width:0,height:0,ctx,getContext:()=>ctx};
}
async function realSourceHarness(){
 const surfaces=[];
 const painter=createOriginalRedLionLiveArt({
  fetchBytes:async url=>{
   const file=new URL(url).pathname.split("/").pop();
   const buf=readFileSync(new URL(file,root));
   return buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength);
  },
  decode:async (_bytes,key)=>({
   width:ORIGINAL_RED_LION_ART[key].width,
   height:ORIGINAL_RED_LION_ART[key].height
  }),
  makeCanvas:()=>{const c=fakeCanvas();surfaces.push(c);return c},
  makeWorld:({replacedBuildingIds,worldReplacementValidator})=>{
   assert.deepEqual([...replacedBuildingIds],["red-lion"]);
   assert.deepEqual([...worldReplacementValidator(MAP_IDS.overworld,["red-lion"])],["red-lion"]);
   return {replacedBuildingIds:["red-lion"],draw(){}};
  }
 });
 assert.equal(await painter.load(),true);
 return {painter,surfaces};
}
function latestPositions(ctx){
 const list=ctx.calls.filter(x=>x[0]==="drawImage");
 assert.ok(list.length>=2);
 return list.slice(-2).map(a=>({x:a[2],y:a[3]}));
}
function checkArtAgainstSingleWorldCamera(camera,w,h,z,coords){
 const inputs=[
  {x:A.x+A.facadeDx,y:A.y+A.facadeDy},
  {x:A.x+A.roofDx,y:A.y+A.roofDy}
 ];
 for(let i=0;i<2;i++){
  // Art is submitted in the SAME unzoomed world draw space as World9
  // and actual fighter sprites. The live Canvas applies zoom ONCE.
  const got={
   x:w/2+(coords[i].x-w/2)*z,
   y:h/2+(coords[i].y-h/2)*z
  };
  const expected=projectArenaPoint(inputs[i].x,inputs[i].y,camera.x,camera.y,w,h,z);
  assert.ok(Math.abs(got.x-expected.x)<1e-8,"facade/roof horizontal camera pan must be zoomed exactly once");
  assert.ok(Math.abs(got.y-expected.y)<1e-8,"facade/roof vertical camera pan must be zoomed exactly once");
 }
}
test("real corrected source day WebPs are anchored with EXACTLY one live World/actor zoom as camera pans",async()=>{
 const {painter,surfaces}=await realSourceHarness();
 const facade=surfaces[1].ctx;
 for(const camera of [{x:A.x,y:A.y},{x:A.x+100,y:A.y+45},{x:A.x-200,y:A.y-120}]){
  assert.ok(painter.prepare(camera,960,540,.84));
  checkArtAgainstSingleWorldCamera(camera,960,540,.84,latestPositions(facade));
 }
});
test("real corrected source facade/dusk+roof stay anchored at different Canvas sizes and native zoom",async()=>{
 const {painter,surfaces}=await realSourceHarness();
 const facade=surfaces[1].ctx;
 const camera={x:A.x+125,y:A.y-52};
 for(const {w,h,z} of [{w:1280,h:720,z:.84},{w:960,h:540,z:1},{w:720,h:405,z:.67}]){
  assert.ok(painter.prepare(camera,w,h,z,"dusk"));
  checkArtAgainstSingleWorldCamera(camera,w,h,z,latestPositions(facade));
 }
});
