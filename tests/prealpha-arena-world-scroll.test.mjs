import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {paintArenaLiteFloor} from "../src/browser/prealpha-arena-lite-floor.mjs";
import {createWorldAnchoredArenaFloor} from "../src/browser/arena-world-floor.mjs";
import {ARENA_VIEW_ZOOM} from "../src/browser/arena-viewport.mjs";

function fakeContext(){
 const ops=[], pattern={texture:true}, tile={width:960,height:540};
 const ctx={
  ops,pattern,
  createPattern(input,repeat){ops.push(["createPattern",input,repeat]);return pattern;},
  save(){ops.push(["save"]);},restore(){ops.push(["restore"]);},
  translate(...x){ops.push(["translate",...x]);},scale(...x){ops.push(["scale",...x]);},
  fillRect(...x){ops.push(["fillRect",...x]);},
  fillStyle:null,
 };
 return {ctx,tile,ops};
}
test("world-anchored floor caches one pattern and translates opposite to camera",()=>{
 const {ctx,tile,ops}=fakeContext();
 const floor=createWorldAnchoredArenaFloor(ctx,tile);
 assert.equal(ops.length,1);
 floor.draw({x:0,y:0},960,540);
 floor.draw({x:80,y:-35},960,540);
 const transforms=ops.filter(a=>a[0]==="translate");
 assert.deepEqual(transforms[0],["translate",480,270]);
 assert.deepEqual(transforms[1],["translate",-480,-270]);
 assert.deepEqual(transforms[2],["translate",480,270]);
 assert.deepEqual(transforms[3],["translate",-560,-235]);
 // After the 0.84 render zoom, camera +80 causes -67.2 px texture
 // translation and camera Y=-35 causes +29.4px vertical movement.
 assert.equal((transforms[3][1]-transforms[1][1])*ARENA_VIEW_ZOOM,-67.2);
 assert.equal((transforms[3][2]-transforms[1][2])*ARENA_VIEW_ZOOM,29.4);
 assert.equal(ops.filter(a=>a[0]==="createPattern").length,1);
 assert.equal(ops.filter(a=>a[0]==="fillRect").length,2);
 assert.deepEqual(floor.metrics(),{draws:2,patternCreates:1});
});
test("floor fails closed on invalid camera, tile, zoom or viewport",()=>{
 const {ctx,tile}=fakeContext();
 assert.throws(()=>createWorldAnchoredArenaFloor(ctx,{width:959,height:540}),TypeError);
 assert.throws(()=>createWorldAnchoredArenaFloor(ctx,tile,{zoom:0}),TypeError);
 assert.throws(()=>createWorldAnchoredArenaFloor(ctx,tile,{zoom:2}),TypeError);
 const floor=createWorldAnchoredArenaFloor(ctx,tile);
 assert.throws(()=>floor.draw({x:NaN,y:0},960,540),RangeError);
 assert.throws(()=>floor.draw({x:0,y:0},959,540),RangeError);
});
function floorContext(){
 const ops=[];
 const ctx={
  ops,save(){ops.push(["save"]);},restore(){ops.push(["restore"]);},
  fillRect(...a){ops.push(["fillRect",...a]);},strokeRect(...a){ops.push(["strokeRect",...a]);},
  createLinearGradient(){return{addColorStop(){}};},
  beginPath(){ops.push(["beginPath"]);},
  ellipse(...a){ops.push(["ellipse",...a]);},
  fill(){ops.push(["fill"]);},
  stroke(){ops.push(["stroke"]);},
 };
 return ctx;
}
test("tileable Arena Lite is repeatable, borderless and retains packed-earth texture",()=>{
 const a=floorContext(),b=floorContext();
 paintArenaLiteFloor(a,{tileable:true});
 paintArenaLiteFloor(b,{tileable:true});
 assert.deepEqual(a.ops,b.ops);
 assert.equal(a.ops.filter(x=>x[0]==="fillRect").length,1);
 assert.equal(a.ops.filter(x=>x[0]==="strokeRect").length,0,"no phantom perimeter fences in repeated floor");
 assert.ok(a.ops.filter(x=>x[0]==="ellipse").length>=620);
 assert.deepEqual(a.ops[0],["save"]);
 assert.deepEqual(a.ops.at(-1),["restore"]);
 const c=floorContext();
 assert.throws(()=>paintArenaLiteFloor(c,{tileable:"yes"}),TypeError);
});
test("online game draws world texture AFTER actual reconciled camera sampling",()=>{
 const s=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 const render=s.substring(s.indexOf("function render("),s.indexOf("function drawImpactBurst("));
 assert.ok(render.includes("if (!networkClient) {\n    drawArenaGround({x: 0, y: 0});"));
 const camera=render.indexOf("visualCamera.sample(local, nowMs, visualCameraPosition)");
 const ground=render.indexOf("drawArenaGround(visualCameraPosition)");
 const actors=render.indexOf("for (const entity of networkClient.state.values())");
 assert.ok(camera>0&&camera<ground&&ground<actors,"world floor follows exactly the player camera before actors");
 assert.match(s,/paintArenaLiteFloor\(layerContext, \{tileable: true\}\)/);
 assert.match(s,/createWorldAnchoredArenaFloor\(ctx, arenaLayer\)/);
 assert.match(s,/params\.get\("arenaGrid"\) !== "1"/);
 assert.match(s,/ctx\.drawImage\(arenaLayer, 0, 0\)/,"original static debug grid remains reversible");
});
