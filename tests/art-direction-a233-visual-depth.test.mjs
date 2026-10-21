import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRedLionVisualDepthPlan,RED_LION_DEPTH_REVIEW} from "../src/browser/red-lion-visual-depth-review.mjs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const root=new URL("../",import.meta.url),assets="assets/environment/greyhaven/";
const buffer=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(buffer(p).toString("utf8"));
const report=json(assets+"a233-review/greyhaven_a233_native_depth_report.json");
const hazard=json(assets+"a232-review/greyhaven_a232_threshold_actor_alpha_report.json");

test("A2.33 visual-only Red Lion stage ordering never authorizes server portal/collision",()=>{
 assert.equal(RED_LION_DEPTH_REVIEW.visualDoorWorldX,4365);
 assert.equal(RED_LION_DEPTH_REVIEW.visualDoorWorldY,4075);
 assert.equal(RED_LION_DEPTH_REVIEW.authoritativeWorldEntranceY,4060);
 assert.equal(RED_LION_DEPTH_REVIEW.productionApproved,false);
 const original=[
  {id:"north",x:4357,y:4055},
  {id:"west",x:4340,y:4075},
  {id:"south",x:4390,y:4091},
 ];
 const p=createRedLionVisualDepthPlan({actors:original});
 assert.deepEqual(p.behindFacade.map(x=>x.id),["north"]);
 assert.deepEqual(p.inFrontOfFacade.map(x=>x.id),["west","south"]);
 assert.deepEqual(p.stageNames,["background","behind-facade-actors",
  "facade","in-front-of-facade-actors","roof-review"]);
 assert.equal(p.visualPlaneY,4075);
 assert.equal(p.thresholdTiePolicy,"front");
 assert.equal(p.actualWorldRendererIntegrated,false);
 assert.equal(p.serverPortalOrCollisionChanged,false);
 assert.equal(p.productionApproved,false);
 assert.ok(Object.isFrozen(p));
 assert.ok(Object.isFrozen(p.behindFacade));
 assert.ok(Object.isFrozen(p.behindFacade[0]));
 assert.deepEqual(original[0],{id:"north",x:4357,y:4055});
});

test("A2.33 threshold tie and multi-client actor ordering deterministic regardless of input order",()=>{
 const original=[{id:"west",x:4340,y:4075},{id:"south",x:4390,y:4091},
  {id:"north",x:4357,y:4075},{id:2,x:4345,y:4075}];
 for(const input of [original,[...original].reverse()]){
  const p=createRedLionVisualDepthPlan({actors:input});
  assert.deepEqual(p.behindFacade,[]);
  assert.deepEqual(p.inFrontOfFacade.map(x=>x.id),["2","north","west","south"]);
 }
 for(const y of [4074.999,4075,4075.001]){
  const p=createRedLionVisualDepthPlan({actors:[{id:"test",x:4365,y}]});
  assert.deepEqual(p.behindFacade.map(x=>x.id),y<4075?["test"]:[]);
  assert.deepEqual(p.inFrontOfFacade.map(x=>x.id),y>=4075?["test"]:[]);
 }
 const none=createRedLionVisualDepthPlan({actors:[]});
 assert.equal(none.behindFacade.length,0);
 assert.equal(none.inFrontOfFacade.length,0);
});

test("A2.33 reject malformed entity coordinates and IDs instead of mutating game state",()=>{
 assert.throws(()=>createRedLionVisualDepthPlan({}),/actors must be an array/);
 assert.throws(()=>createRedLionVisualDepthPlan({actors:[],visualPlaneY:NaN}),/finite/);
 for(const bad of [
  [{id:"a",x:Infinity,y:0}],
  [{id:"a",x:0,y:NaN}],
  [{id:"a",x:0,y:0},{id:"a",x:1,y:1}],
  [{id:"",x:1,y:1}],
  [{x:1,y:1}],
 ])assert.throws(()=>createRedLionVisualDepthPlan({actors:bad}));
 assert.equal(ARENA_VIEW_ZOOM,0.84);
 assert.deepEqual([projectArenaPoint(4365,4055,4365,4075,640,640).x,
  projectArenaPoint(4365,4055,4365,4075,640,640).y],[320,303.2]);
});

test("A2.33 authentic Chrome and Firefox source review tests plan transitioning only above visual plane",()=>{
 assert.equal(report.results.length,2);
 assert.equal(report.screenshots,6);
 assert.deepEqual(report.pins,{
  c3:"8e85584b6007b38e1a00155b77473e92b0afec6a",
  knight:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
  adult:"91f1c2c4737b8f0275bb22bfbca4acc1501daa00"});
 for(const name of ["chrome","firefox"]){
  const b=report.results.find(x=>x.engine===name);
  assert.ok(b);
  assert.match(b.version,name==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(b.errors,[]);
  assert.equal(b.originalWorldRendererUsed,false);
  assert.deepEqual(b.cases.map(x=>x.northY),[-20,0,20]);
  assert.equal(b.cases.length,3);
  assert.ok(b.cases[0].changedViewportPixels>900);
  assert.equal(b.cases[1].changedViewportPixels,0);
  assert.equal(b.cases[2].changedViewportPixels,0);
  for(const item of b.cases){
   const s=item.state;
   assert.equal(s.ready,true);
   assert.equal(s.northY,item.northY);
   assert.deepEqual(s.originalWorldEntrance,[4365,4060]);
   assert.deepEqual(s.visualDoor,[4365,4075]);
   assert.deepEqual(s.lanternXY,[4365,4045]);
   assert.equal(s.thresholdAlphaHazardCount,69);
   assert.equal(s.realOcclusionValidated,false);
   assert.equal(s.actualGameRendererIntegrated,false);
   assert.equal(s.productionApproved,false);
   assert.equal(s.roofLogicEnabled,false);
   const png=buffer(assets+"a233-review/"+item.filename);
   assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(png.readUInt32BE(16),1410);
   assert.ok(png.length>45000);
  }
 }
 assert.equal(report.actualOnlineGameRendererIntegrated,false);
 assert.equal(report.authoritativeDoorCollisionChanged,false);
 assert.equal(report.automaticRoofFadeEnabled,false);
 assert.equal(report.productionApproved,false);
 assert.equal(hazard.sourceFacadeAlphaHazard.count,69);
});

test("A2.33 core online-game remains unchanged; no automatic building renderer yet",()=>{
 const current=buffer("web/online-game.mjs").toString("utf8");
 const localGame=buffer("web/game.mjs").toString("utf8");
 assert.match(current,/ctx\.drawImage\(arenaLayer, 0, 0\)/);
 assert.doesNotMatch(current,/createRedLionVisualDepthPlan|red-lion-visual-depth-review/);
 assert.doesNotMatch(localGame,/red-lion-visual-depth-review/);
 const viewer=buffer("web/greyhaven-a233-depth-browser.mjs").toString("utf8");
 const harness=buffer("tools/art/verify_greyhaven_a233_depth_browser.mjs").toString("utf8");
 assert.match(viewer,/createRedLionVisualDepthPlan/);
 assert.match(viewer,/projectArenaPoint/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/webDriverBiDi/);
 assert.doesNotMatch(viewer,/WebSocket|XMLHttpRequest|localStorage/);
});
