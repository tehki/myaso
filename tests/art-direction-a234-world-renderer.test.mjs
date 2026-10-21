import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {createRedLionVisualDepthPlan} from "../src/browser/red-lion-visual-depth-review.mjs";
const root=new URL("../",import.meta.url),pref="assets/environment/greyhaven/";
const read=p=>readFileSync(new URL(p,root));
const json=p=>JSON.parse(read(p).toString("utf8"));
const report=json(pref+"a234-review/greyhaven_a234_world_renderer_review_report.json");
const handoff=json(pref+"a231-review/greyhaven_a231_lighting_handoff.json");
const audit=json(pref+"a232-review/greyhaven_a232_threshold_actor_alpha_report.json");

test("A2.34 real first-party World #336 exact-head sourced renderer, not a recreated map",()=>{
 assert.deepEqual(report.pinnedHeads,{
  world:"260a7b85a33b7a51663a70af8d410e0d33e0e236",
  c3:"8e85584b6007b38e1a00155b77473e92b0afec6a",
  knight:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef"
 });
 assert.ok(report.sourceHashes["/src/browser/authored-world-renderer.mjs"]);
 assert.ok(report.sourceHashes["/src/world/authored-maps.mjs"]);
 assert.ok(report.sourceHashes["/__a234_3c__/greyhaven-atmosphere.mjs"]);
 assert.ok(report.sourceHashes["/__a234_knights__/silver_idle.webp"]);
 assert.match(report.sourceHashes["/src/browser/authored-world-renderer.mjs"],/^[a-f0-9]{64}$/);
 assert.equal(report.originalWorldRendererModuleLoaded,true);
 assert.equal(report.originalWorldUnmodified,true);
 assert.equal(report.unmergedWorldBranchUsed,true);
 assert.equal(report.redLionWorldPlaceholderStillDrawn,true);
 assert.equal(report.realOnlineClientExecuted,false);
 assert.equal(report.actualMultiplayerNetworkConnected,false);
 assert.equal(report.productionApproved,false);
});

test("A2.34 3B artist door vs World entrance and 3C lantern all remain separate",()=>{
 assert.equal(ARENA_VIEW_ZOOM,0.84);
 assert.deepEqual(handoff.building.visualArtDoor,[4365,4075]);
 assert.deepEqual(handoff.building.authoredWorldEntrance,[4365,4060]);
 assert.deepEqual(handoff.graphics3C.fixtureWorldXY,[4365,4045]);
 assert.equal(audit.sourceFacadeAlphaHazard.count,69);
 for(const [offset,result] of [[-20,"behindFacade"],[20,"inFrontOfFacade"]]){
  const plan=createRedLionVisualDepthPlan({actors:[{id:"knight",x:4357,y:4075+offset}]});
  assert.deepEqual(plan[result].map(v=>v.id),["knight"]);
 }
 const screen=projectArenaPoint(4357,4055,4365,4075,640,640);
 assert.deepEqual([screen.x,screen.y],[313.28,303.2]);
});

test("A2.34 Chrome and Firefox genuine World chunk renderer is bounded and observed in six screenshots",()=>{
 assert.equal(report.screenshots,6);
 assert.equal(report.results.length,2);
 for(const browser of ["chrome","firefox"]){
  const r=report.results.find(x=>x.engine===browser);
  assert.ok(r);
  assert.match(r.version,browser==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(r.errors,[]);
  assert.equal(r.captures.length,3);
  assert.equal(r.warmSampleCount,20);
  assert.equal(r.cacheBound,24);
  assert.equal(r.buildBound,3);
  assert.equal(r.worldTilesCreatedMax,0);
  assert.equal(r.gameFrameTimeClaimed,false);
  assert.equal(r.liveServerTested,false);
  for(const key of ["worldWarmP95Ms","composedWarmP95Ms"])
   assert.ok(Number.isFinite(r[key])&&r[key]>=0);
  for(const [i,[dy,cameraEast]] of [[-20,0],[20,0],[-20,80]].entries()){
   const c=r.captures[i],s=c.state;
   assert.equal(s.ready,true);
   assert.equal(s.dy,dy);
   assert.equal(s.cameraEast,cameraEast);
   assert.equal(s.realWorld336RendererUsed,true);
   assert.equal(s.world336OptInSourcePresent,true);
   assert.equal(s.placeholderTavernStillDrawnByWorld336,true);
   assert.equal(s.rawWorldBuildingDepthSortingPresent,false);
   assert.equal(s.actualOnlineGameExecuted,false);
   assert.equal(s.liveServerAttached,false);
   assert.equal(s.productionApproved,false);
   assert.equal(s.portalOrCollisionModified,false);
   assert.deepEqual(s.visualDoor,[4365,4075]);
   assert.deepEqual(s.authoredWorldEntrance,[4365,4060]);
   assert.deepEqual(s.threeCFixtureWorldXY,[4365,4045]);
   assert.ok(s.actorXYErrorPx<.001);
   assert.deepEqual(s.proposedBehindIds,dy<0?["knight"]:[]);
   assert.deepEqual(s.proposedFrontIds,dy>=0?["knight"]:[]);
   for(const stat of Object.values(s.sourceRendererStats)){
    assert.ok(stat.tilesCreated<=3);
    assert.ok(stat.tilesCached<=24);
    assert.equal(stat.tilesVisible,6);
    assert.equal(stat.tilesCached,6);
   }
   const image=read(pref+"a234-review/"+c.screenshot);
   assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(image.readUInt32BE(16),1430);
   assert.ok(image.length>60000);
  }
 }
});

test("A2.34 Firefox composited review is not a 60Hz or production FPS acceptance",()=>{
 const fox=report.results.find(x=>x.engine==="firefox");
 assert.ok(fox.composedWarmP95Ms>16.7);
 assert.ok(fox.composedWarmP95Ms>fox.worldWarmP95Ms);
 assert.equal(report.actualMultiplayerNetworkConnected,false);
 const html=read("web/greyhaven-a234-real-world-review.html").toString("utf8");
 const viewer=read("web/greyhaven-a234-real-world-review.mjs").toString("utf8");
 const tool=read("tools/art/verify_greyhaven_a234_real_world.mjs").toString("utf8");
 assert.match(html,/not.*online-game\.mjs/i);
 assert.match(viewer,/createAuthoredWorldRenderer/);
 assert.match(viewer,/world\.buildings\.find/);
 assert.match(viewer,/createRedLionVisualDepthPlan/);
 assert.match(tool,/git.*rev-parse/);
 assert.match(tool,/127\.0\.0\.1/);
 assert.match(tool,/webDriverBiDi/);
 const online=read("web/online-game.mjs").toString("utf8");
 assert.doesNotMatch(online,/createAuthoredWorldRenderer/);
 assert.doesNotMatch(online,/createRedLionVisualDepthPlan/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
});
