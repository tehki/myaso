import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {paintArenaLiteFloor,createArenaLiteLayer,ARENA_LITE_WIDTH,ARENA_LITE_HEIGHT,ARENA_LITE_SEED} from "../src/browser/prealpha-arena-lite-floor.mjs";

function recordingContext(){
  const ops=[];
  const ctx={
    ops,
    save(){ops.push(["save"]);},restore(){ops.push(["restore"]);},
    createLinearGradient(x,y,a,b){
      ops.push(["gradient",x,y,a,b]);
      return {addColorStop(t,color){ops.push(["color-stop",t,color]);}};
    },
    fillRect(...values){ops.push(["fillRect",...values]);},
    strokeRect(...values){ops.push(["strokeRect",...values]);},
    beginPath(){ops.push(["beginPath"]);},
    moveTo(...values){ops.push(["moveTo",...values]);},
    lineTo(...values){ops.push(["lineTo",...values]);},
    closePath(){ops.push(["closePath"]);},
    ellipse(...values){ops.push(["ellipse",...values]);},
    fill(){ops.push(["fill"]);},stroke(){ops.push(["stroke"]);},
  };
  return ctx;
}
test("arena candidate keeps canonical 960x540 and deterministic fixed seeding",()=>{
 assert.equal(ARENA_LITE_WIDTH,960);
 assert.equal(ARENA_LITE_HEIGHT,540);
 assert.equal(ARENA_LITE_SEED,0x3c202610);
 const a=recordingContext(),b=recordingContext();
 paintArenaLiteFloor(a);paintArenaLiteFloor(b);
 assert.deepEqual(a.ops,b.ops);
 assert.equal(a.ops[0][0],"save");
 assert.equal(a.ops.at(-1)[0],"restore");
 assert.equal(a.ops.filter(x=>x[0]==="fillRect").length,1);
 assert.ok(a.ops.length>1000&&a.ops.length<18000,"bounded single-paint operations");
 assert.equal(a.ops.some(x=>x[0]==="drawImage"),false);
});
test("original opaque 2D Canvas single-layer contract, no secondary renderer",()=>{
 let calls=0;const ctx=recordingContext(),canvas={width:960,height:540,getContext(type,opts){
  assert.equal(type,"2d");assert.deepEqual(opts,{alpha:false});calls++;return ctx;
 }};
 assert.equal(createArenaLiteLayer(()=>canvas),canvas);
 assert.equal(calls,1);
 assert.equal(ctx.ops.filter(x=>x[0]==="fillRect").length,1);
});
test("invalid sizes, factory, context and seed fail closed",()=>{
 for(const opts of [{width:959},{height:541},{seed:-1},{seed:2**32},{seed:NaN},{width:999999}])
  assert.throws(()=>paintArenaLiteFloor(recordingContext(),opts),TypeError);
 assert.throws(()=>paintArenaLiteFloor(null),TypeError);
 assert.throws(()=>createArenaLiteLayer(null),TypeError);
 assert.throws(()=>createArenaLiteLayer(()=>({width:1,height:540,getContext(){}})),TypeError);
 assert.throws(()=>createArenaLiteLayer(()=>({width:960,height:540,getContext:()=>null})));
});
test("original grid remains unchanged and Arena Lite requires explicit in-game opt-in",()=>{
 const live=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(live,/function createArenaLayer\(\)/);
 assert.match(live,/layerContext\.strokeRect\(12, 12, layer\.width - 24, layer\.height - 24\)/);
 assert.match(live,/enabled: params\.get\("arenaLite"\) === "1"/);
 assert.match(live,/createOriginal: createArenaLayer/);
 assert.match(live,/createOptional: \(\) => createArenaLiteLayer/);
 assert.match(live,/ctx\.drawImage\(arenaLayer, 0, 0\)/);
 const preview=readFileSync(new URL("../web/prealpha-arena-lite-review.html",import.meta.url),"utf8");
 assert.match(preview,/PREVIEW ONLY/);
 assert.match(preview,/prealpha-arena-lite-floor\.mjs/);
});
