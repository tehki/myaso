import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { chooseArenaFloorLayer } from "../src/browser/prealpha-arena-lite-selection.mjs";

test("default original Pre-Alpha grid is retained without rendering optional terrain",()=>{
 const calls=[];
 const original={width:960,height:540,id:"grid"};
 const selected=chooseArenaFloorLayer({
   enabled:false,
   createOriginal:()=>{calls.push("original");return original;},
   createOptional:()=>{calls.push("optional");throw Error("must never run");},
 });
 assert.equal(selected,original);
 assert.deepEqual(calls,["original"]);
});
test("optional terrain selects one valid full-size layer and never paints original",()=>{
 const calls=[];
 const optional={width:960,height:540,id:"lite"};
 const selected=chooseArenaFloorLayer({
   enabled:true,
   createOriginal:()=>{calls.push("original");throw Error("unexpected default");},
   createOptional:()=>{calls.push("optional");return optional;},
 });
 assert.equal(selected,optional);
 assert.deepEqual(calls,["optional"]);
});
test("optional floor failure or unusable canvas falls back to original arena exactly once",()=>{
 for(const makeOptional of [()=>{throw Error("art unavailable");},()=>null,()=>({width:NaN,height:540}),()=>({width:0,height:540})]){
   let originalCalls=0;
   const grid={width:960,height:540,id:"original"};
   assert.equal(chooseArenaFloorLayer({enabled:true,
     createOriginal:()=>{originalCalls++;return grid;},createOptional:makeOptional}),grid);
   assert.equal(originalCalls,1);
 }
});
test("only a literal opt-in flag enables terrain; original renderer/Combat loop is still intact",()=>{
 const client=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(client,/enabled: params\.get\("arenaLite"\) === "1"/);
 assert.match(client,/import \{ chooseArenaFloorLayer \}/);
 assert.match(client,/import \{ createArenaLiteLayer \}/);
 assert.match(client,/const arenaLayer = chooseArenaFloorLayer\(/);
 assert.match(client,/ctx\.drawImage\(arenaLayer, 0, 0\)/);
 assert.match(client,/function createArenaLayer\(\)/);
 assert.match(client,/layerContext\.fillStyle = "#1c1913"/);
 assert.match(client,/for \(let x = 0; x <= layer\.width; x \+= 48\)/);
 assert.match(client,/for \(let y = 0; y <= layer\.height; y \+= 48\)/);
});
test("reject invalid factories and never conceal failure of original mandatory grid",()=>{
 assert.throws(()=>chooseArenaFloorLayer({enabled:true,createOriginal:null,createOptional:()=>({width:960,height:540})}),TypeError);
 assert.throws(()=>chooseArenaFloorLayer({enabled:true,createOriginal:()=>null,createOptional:null}),TypeError);
 assert.throws(()=>chooseArenaFloorLayer({enabled:true,createOriginal:()=>{throw Error("original broken");},
   createOptional:()=>{throw Error("optional broken");}}),/original broken/);
});
