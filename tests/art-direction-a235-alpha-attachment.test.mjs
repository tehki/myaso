import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {RED_LION_ALPHA_ART,createRedLionAlphaArtAttachment} from "../src/browser/red-lion-alpha-art-attachment.mjs";
const root=new URL("../",import.meta.url),base="assets/environment/greyhaven/";
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p).toString("utf8"));
const sha=p=>createHash("sha256").update(read(p)).digest("hex");
const handoff=json(base+"a231-review/greyhaven_a231_lighting_handoff.json");
const original=json(base+"a230-review/greyhaven_a230_material_validation.json");
const building={id:"red-lion",x:4240,y:3880,w:250,h:170,
 entrance:{x:4365,y:4060},kind:"tavern"};

test("A2.35 world-owned attachment is exact source-pinned, not a second facade or roof design",()=>{
 assert.deepEqual(RED_LION_ALPHA_ART.worldFootprint,{x:4240,y:3880,w:250,h:170});
 assert.deepEqual(RED_LION_ALPHA_ART.authoredEntrance,{x:4365,y:4060});
 assert.deepEqual(RED_LION_ALPHA_ART.visualDoor,{x:4365,y:4075});
 assert.deepEqual(RED_LION_ALPHA_ART.threeCFixture,{x:4365,y:4045});
 assert.equal(RED_LION_ALPHA_ART.buildingId,building.id);
 assert.equal(RED_LION_ALPHA_ART.placeholderPolicy,"world-must-suppress-one-red-lion-placeholder");
 assert.equal(RED_LION_ALPHA_ART.runtimeIntegrationApproved,false);
 assert.equal(RED_LION_ALPHA_ART.serverMutation,false);
 assert.deepEqual([RED_LION_ALPHA_ART.day.width,RED_LION_ALPHA_ART.day.height],[228,297]);
 assert.deepEqual([RED_LION_ALPHA_ART.roof.width,RED_LION_ALPHA_ART.roof.height],[238,197]);
 assert.equal(RED_LION_ALPHA_ART.roof.offsetX,-119);
 assert.equal(RED_LION_ALPHA_ART.roof.offsetY,-283);
 for(const variant of ["day","dusk","roof"]){
  const asset=RED_LION_ALPHA_ART[variant];
  const rel=asset.src.replace(/^\.\.\//,"");
  assert.equal(asset.sha256,sha(rel));
  assert.equal(asset.sha256,handoff.material[variant].sha256);
  assert.ok(Object.isFrozen(asset));
 }
 assert.equal(RED_LION_ALPHA_ART.day.sha256,original.baseWebp.sha256);
 assert.deepEqual(read(base+"a231-review/red_lion_a231_roof_unchanged.webp"),
   read(base+"a230-review/red_lion_a230_roof_unchanged.webp"));
});

test("A2.35 deterministic screen-space placement uses true game projectArenaPoint, never moves World entrance",()=>{
 assert.equal(ARENA_VIEW_ZOOM,.84);
 const camera={x:4365,y:4075};
 const p=createRedLionAlphaArtAttachment({building,camera});
 assert.deepEqual(p.visualDoorScreen,{x:320,y:320});
 assert.deepEqual([p.facade.x,p.facade.y,p.facade.width,p.facade.height],[206,51,228,297]);
 assert.deepEqual([p.roof.x,p.roof.y,p.roof.width,p.roof.height],[201,37,238,197]);
 assert.deepEqual(p.authoredEntrance,{x:4365,y:4060});
 assert.deepEqual(p.threeCFixture,{x:4365,y:4045});
 assert.equal(p.sourceMood,"day");
 assert.equal(p.actualWorldRendererIntegrated,false);
 assert.equal(p.productionApproved,false);
 assert.equal(p.portalOrCollisionChanged,false);
 for(const off of [[0,0],[80,-10],[-25,20]]){
  const cam={x:4365+off[0],y:4075+off[1]};
  const q=createRedLionAlphaArtAttachment({building,camera:cam,mood:"dusk"});
  const point=projectArenaPoint(4365,4075,cam.x,cam.y,640,640);
  assert.deepEqual([q.facade.x,q.facade.y],[point.x-114,point.y-269]);
  assert.deepEqual([q.roof.x,q.roof.y],[point.x-119,point.y-283]);
  assert.equal(q.sourceMood,"dusk");
  assert.equal(q.facade.sha256,RED_LION_ALPHA_ART.dusk.sha256);
  assert.equal(q.roof.sha256,RED_LION_ALPHA_ART.roof.sha256);
  assert.equal(q.facade.renderOnly,true);
  assert.ok(Object.isFrozen(q.facade));
  assert.ok(Object.isFrozen(q));
 }
 const wider=createRedLionAlphaArtAttachment({building,camera,width:900,height:700});
 assert.deepEqual(wider.visualDoorScreen,{x:450,y:350});
 assert.deepEqual(building,{id:"red-lion",x:4240,y:3880,w:250,h:170,
  entrance:{x:4365,y:4060},kind:"tavern"});
});

test("A2.35 rejects World contract drift and invalid camera/mood without fallback",()=>{
 const mk=(b,c={x:4365,y:4075},m="day")=>
  createRedLionAlphaArtAttachment({building:b,camera:c,mood:m});
 for(const patch of [
  {id:"stonebrook"}, {x:4241},{y:3881},{w:249},{h:171},
  {entrance:{x:4365,y:4075}}, {entrance:{x:4366,y:4060}}
 ])assert.throws(()=>mk({...building,...patch}),/mismatch/);
 assert.throws(()=>mk(undefined),/mismatch/);
 assert.throws(()=>mk(building,{x:NaN,y:4075}),/invalid visual camera/);
 assert.throws(()=>mk(building,{x:4365,y:Infinity}),/invalid visual camera/);
 assert.throws(()=>mk(building,undefined,"night"),/mood must be day or dusk/);
 assert.throws(()=>createRedLionAlphaArtAttachment({building,camera:{x:4365,y:4075},zoom:1.01}),/invalid visual camera/);
});

test("A2.35 contract remains isolated, explicit World ownership and no gameplay or Combat mutation",()=>{
 const impl=read("src/browser/red-lion-alpha-art-attachment.mjs").toString("utf8");
 const live=read("web/online-game.mjs").toString("utf8");
 assert.match(impl,/world-must-suppress-one-red-lion-placeholder/);
 assert.match(impl,/three-c-owns-one-outdoor-lantern/);
 assert.doesNotMatch(impl,/WebSocket|fetch\(|XMLHttpRequest|localStorage|paintOverworld|paintBuilding|authoredWorld\.draw/);
 assert.doesNotMatch(live,/red-lion-alpha-art-attachment/);
 assert.doesNotMatch(live,/createAuthoredWorldRenderer/);
 assert.equal(RED_LION_ALPHA_ART.alphaGameplayApproved,false);
});
