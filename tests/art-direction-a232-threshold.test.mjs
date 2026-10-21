import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const base="assets/environment/greyhaven/";
const root=new URL("../",import.meta.url);
const data=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(data(p).toString("utf8"));
const sha=p=>createHash("sha256").update(data(p)).digest("hex");
const a232=json(base+"a232-review/greyhaven_a232_threshold_actor_alpha_report.json");
const browser=json(base+"a232-review/greyhaven_a232_native_alpha_overlap_browser_report.json");
const handoff=json(base+"a231-review/greyhaven_a231_lighting_handoff.json");
const derived=json(base+"a230-review/greyhaven_a230_material_validation.json");
const perf=json(base+"a232-review/greyhaven_a232_rejected_canvas_hint.json");

test("A2.32 source A2.30 facade threshold alpha risk is exact and roof frozen",()=>{
 const delta=a232.sourceFacadeAlphaHazard;
 assert.deepEqual(delta,{count:69,newlyVisible:51,partiallyChanged:18,bboxInclusive:[289,321,350,331]});
 assert.equal(handoff.a230AlphaRisk.changedPixels,delta.count);
 assert.equal(a232.sameRoofBytesAsA230,true);
 assert.equal(a232.unchangedRoofSha256,derived.roofWebp.sha256);
 assert.deepEqual(data(base+"a231-review/red_lion_a231_roof_unchanged.webp"),
  data(base+"a230-review/red_lion_a230_roof_unchanged.webp"));
 assert.equal(ARENA_VIEW_ZOOM,a232.projection.cameraZoom);
 assert.deepEqual(a232.projection.visualDoorWorldXY,[4365,4075]);
 assert.deepEqual(a232.projection.gameDoorCanvasPx,[320,320]);
 assert.equal(a232.projection.metersPerWorldUnit,0.025);
 assert.equal(a232.projection.actorDrawAnchorYSubtract,62.4);
 assert.equal(a232.originalSourceArtworkChanged,false);
 assert.equal(a232.runtimeOcclusionValidated,false);
 assert.equal(a232.serverCollisionApproved,false);
 assert.equal(a232.productionApproved,false);
 const png=data(base+"a232-review/"+a232.comparison);
 assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(png.readUInt32BE(16),1300);
 assert.equal(png.readUInt32BE(20),690);
 assert.ok(png.length>40000);
});

test("A2.32 genuine Knight and both draft adult idle source silhouettes overlap threshold alpha only at near-edge positions",()=>{
 assert.equal(a232.cases.length,18);
 assert.deepEqual(a232.spriteSources.map(x=>x.name),
  ["silver-knight","adult-masculine","adult-feminine"]);
 assert.equal(a232.spriteSources[0].sha256,
  "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
 assert.equal(a232.spriteSources[1].sha256,
  "ba1918e5dd3fb4d00738d18ab4f708b6c54789ac09893bd06aed9eac2a65aa8b");
 assert.equal(a232.spriteSources[2].sha256,
  "d0112058a5a1a85b688854f1c1bf6e6f4f37edca682971c4f353e6067dcf8e15");
 const expected={
  "silver-knight":[0,0,0,32,37,0],
  "adult-masculine":[0,0,10,32,37,0],
  "adult-feminine":[0,0,10,32,37,0]
 };
 for(const [sprite,scores] of Object.entries(expected)){
  const cases=a232.cases.filter(x=>x.sprite===sprite);
  assert.deepEqual(cases.map(x=>x.changedAlphaPixelsUnderActor),scores);
  assert.deepEqual(cases.map(x=>x.scenario),
   ["at-art-door","north-threshold","south-threshold","west-threshold","east-threshold","oblique-street"]);
  for(const c of cases){
   assert.equal(c.affectedXY.length,c.changedAlphaPixelsUnderActor);
   assert.ok(c.newlyVisibleFacadePixelsUnderActor<=c.changedAlphaPixelsUnderActor);
   assert.ok(c.compositedAlphaDifferenceUpperBoundEquivalentPixels>=0);
   const [dx,dy]=c.offsetWorldXY, p=projectArenaPoint(4365+dx,4075+dy,4365,4075,640,640);
   assert.deepEqual(c.actorCanvasRectPx.slice(2),[96,96]);
   assert.ok(Math.abs(c.actorCanvasRectPx[0]-(p.x-48))<=.5);
   assert.ok(Math.abs(c.actorCanvasRectPx[1]-(p.y-62.4))<=.5);
  }
 }
});

test("A2.32 native Chrome and Firefox show authentic Red Lion front/behind near-threshold art review",()=>{
 assert.equal(browser.screenshots,8);
 assert.equal(browser.originalKnightAuthentic,true);
 assert.equal(browser.adultPreviewStillDraft,true);
 assert.deepEqual(browser.sources,{c3:"8e85584b6007b38e1a00155b77473e92b0afec6a",
  knights:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
  adults:"91f1c2c4737b8f0275bb22bfbca4acc1501daa00"});
 assert.equal(browser.predictedThresholdSourceAlpha.count,69);
 assert.equal(browser.rendererAndServerDepthNotValidated,true);
 for(const engine of ["chrome","firefox"]){
  const b=browser.reviews.find(x=>x.engine===engine);
  assert.ok(b);
  assert.match(b.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(b.errors,[]);
  assert.equal(b.scenarioCount,4);
  assert.equal(b.sourceAlphaThresholdOnly,true);
  assert.deepEqual(b.captures.map(x=>x.expectedSourceOverlapPixels),[32,32,37,37]);
  assert.deepEqual(b.captures.map(x=>x.state.depth),["front","behind","front","behind"]);
  assert.deepEqual(b.captures.map(x=>x.state.dx),[-25,-25,25,25]);
  for(const c of b.captures){
   assert.equal(c.state.ready,true);
   assert.equal(c.state.redLion3CLightCount,1);
   assert.equal(c.state.facade3BApertureNoRadialGlow,true);
   assert.ok(c.state.playerXYErrorPx<.001);
   assert.equal(c.state.realGameDrawOrderValidated,false);
   assert.equal(c.state.productionApproved,false);
   const im=data(base+"a232-review/"+c.name);
   assert.equal(im.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(im.readUInt32BE(16),1420);
   assert.ok(im.length>50000);
  }
 }
 assert.equal(browser.worldChunkRendererIntegrated,false);
 assert.equal(browser.liveCombatOcclusionValidated,false);
 assert.equal(browser.productionApproved,false);
});

test("A2.32 does not ship speculative Firefox Canvas readback hint tuning",()=>{
 assert.equal(perf.trialCountPerMode,1);
 assert.equal(perf.rejected,true);
 assert.equal(perf.productionOrRuntimeOptimizationClaimed,false);
 assert.equal(perf.baselineFireFoxDuskP95Ms,22);
 assert.equal(perf.candidateFireFoxDuskP95Ms,28);
 assert.equal(perf.candidateVariantPersisted,false);
 const viewer=data("web/greyhaven-a231-composite-browser.mjs").toString("utf8");
 assert.match(viewer,/getContext\("2d",\{willReadFrequently:true\}\)/);
 const html=data("web/greyhaven-a231-composite-browser.html").toString("utf8");
 assert.match(html,/id="dx" min="-120" max="140" step="5"/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
});
