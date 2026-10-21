import test from "node:test";
import assert from "node:assert/strict";
import { pickRenderedSword, createSwordPointerGate } from "../src/browser/world-sword-pointer.mjs";
const sword = (id, x, y, overrides = {}) => ({
  kind: "sword", itemId: id, rendered: true,
  bounds: { x, y, width: 12, height: 38 }, ...overrides,
});
test("only visible sword itself can be targeted, never rack or occluded sword", () => {
  const sprites = [sword("41", 50, 30), sword("42", 70, 30, { rendered: false }),
    sword("43", 90, 30, { occluded: true }),
    {kind:"rack",itemId:"44",rendered:true,bounds:{x:50,y:30,width:200,height:200}}];
  assert.equal(pickRenderedSword({x:55,y:40}, sprites), "41");
  assert.equal(pickRenderedSword({x:82,y:40}, sprites), null);
  assert.equal(pickRenderedSword({x:101,y:40}, sprites), null);
  assert.equal(pickRenderedSword({x:63,y:40}, sprites), null);
});
test("top rendered sword wins overlapping target by painting order", () => {
  assert.equal(pickRenderedSword({x:5,y:5}, [sword("1",0,0,{paintOrder:9}),sword("2",0,0,{paintOrder:4})]), "1");
  assert.equal(pickRenderedSword({x:5,y:5}, [sword("1",0,0),sword("2",0,0)]), "2");
});
test("malformed IDs or bounds, invalid pointer and excessive list fail closed", () => {
  assert.equal(pickRenderedSword({x:1,y:2}, [sword("",0,0)]), null);
  assert.equal(pickRenderedSword({x:1,y:2}, [sword("a/b",0,0)]), null);
  assert.equal(pickRenderedSword({x:1,y:2}, [sword("3",0,0,{bounds:{x:0,y:0,width:Infinity,height:20}})]), null);
  assert.equal(pickRenderedSword({x:NaN,y:0}, [sword("3",0,0)]), null);
  assert.equal(pickRenderedSword({x:1,y:2}, Array(257).fill(sword("3",0,0))), null);
});
test("native sword LMB reserves on down, yields one item intent on release only", () => {
  const g = createSwordPointerGate(), s = [sword("493",50,30)];
  assert.deepEqual(g.down({button:0,pointerId:7,x:55,y:35},s), {handled:true,itemId:null});
  assert.deepEqual(g.up({button:0,pointerId:7,x:55,y:36},s), {handled:true,itemId:"493"});
  assert.deepEqual(g.up({button:0,pointerId:7,x:55,y:36},s), {handled:false,itemId:null});
});
test("ordinary Combat left click and RMB/middle are never consumed", () => {
  const g=createSwordPointerGate(),s=[sword("493",50,30)];
  assert.equal(g.down({button:0,pointerId:2,x:12,y:12},s).handled,false);
  assert.equal(g.down({button:2,pointerId:2,x:55,y:35},s).handled,false);
  assert.equal(g.down({button:1,pointerId:2,x:55,y:35},s).handled,false);
  assert.equal(g.up({button:0,pointerId:2,x:55,y:35},s).handled,false);
});
test("drag, changed sprite, cancel, blur/reset never turn pickup into attack", () => {
  const g=createSwordPointerGate(),a=sword("1",50,30),b=sword("2",70,30);
  g.down({button:0,pointerId:2,x:55,y:35},[a,b]);
  assert.deepEqual(g.up({button:0,pointerId:2,x:75,y:35},[a,b]),{handled:true,itemId:null});
  g.down({button:0,pointerId:2,x:55,y:35},[a,b]);
  assert.deepEqual(g.up({button:0,pointerId:2,x:55,y:35},[]),{handled:true,itemId:null});
  g.down({button:0,pointerId:2,x:55,y:35},[a,b]);
  assert.equal(g.cancel(2),true);
  assert.equal(g.up({button:0,pointerId:2,x:55,y:35},[a,b]).handled,false);
  g.down({button:0,pointerId:-1,x:55,y:35},[a,b]); g.reset();
  assert.equal(g.up({button:0,pointerId:-1,x:55,y:35},[a,b]).handled,false);
});
