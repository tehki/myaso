import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const rel="assets/environment/greyhaven/armory-p0/resource-load-review/";
const json=(name)=>JSON.parse(readFileSync(new URL(rel+name,root),"utf8"));
const two=json("armory_module_graph_resource_windows.json");
const six=json("armory_module_graph_six_draw_windows.json");
const expected={
 world:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
 graphicsAncestor:"40112c3d3f0eeeb441a3206beba7c5d21e292852"
};
const assetHashes={
 "assets/environment/greyhaven/armory-p0/armory_rack.webp":
  "83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp":
  "795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31"
};
test("P0 original rack/sword loader retains exact World and Graphics source provenance",()=>{
 for(const report of [two,six]){
  assert.deepEqual(report.sourceHeads,expected);
  assert.deepEqual(report.sourceAssetSha256,assetHashes);
  assert.equal(report.sourceSha256["/__world521__/src/world/alpha-armory.mjs"],
   "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf");
  assert.equal(report.sourceSha256["/__world521__/src/browser/authored-world-renderer.mjs"],
   "2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a");
  assert.equal(report.conditions.localhostOnly,true);
  assert.equal(report.productionEdited,false);
  assert.equal(report.gameClientExecuted,false);
  assert.equal(report.hasServerOwnedItemIds,false);
  assert.equal(report.actualX230iTested,false);
  assert.equal(report.performancePassed,false);
 }
 for(const [path,digest] of Object.entries(assetHashes)){
  const bytes=readFileSync(new URL("../"+path,import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"),digest);
 }
});

test("P0 Windows Chrome/Firefox minimal vs original World+3B source graph detects all decode and HTTP errors, not fake fps",()=>{
 assert.equal(two.conditions.repeat,2);
 assert.deepEqual(two.conditions.variants,["minimal","graph","draw"]);
 assert.equal(two.conditions.drawBudget,1);
 assert.equal(two.results.length,12);
 assert.equal(two.completedRuns,12);
 assert.equal(two.successfulOnTestedHost,true);
 for(const browser of ["chrome","firefox"])for(const repetition of [1,2]){
  const group=two.results.filter(r=>r.engine===browser&&r.repetition===repetition);
  assert.equal(group.length,3);
  assert.deepEqual(group.map(r=>r.variant),["minimal","graph","draw"]);
  const min=group[0],graph=group[1],draw=group[2];
  assert.match(min.version,browser==="chrome"?/^Chrome\/154\./:/^firefox\/153/);
  assert.ok(min.resources.length<graph.resources.length);
  for(const r of group){
   assert.equal(r.probe.phase,"DONE");
   assert.deepEqual(r.errors,[]);
   assert.equal(r.serverItemEvents,0);
   assert.ok(r.probe.log.some(x=>x.stage==="armory_rack:decoded"));
   assert.ok(r.probe.log.some(x=>x.stage==="armory_sword:decoded"));
   assert.ok(r.probe.log.some(x=>x.stage==="image:both-decoded"));
   assert.ok(r.resources.some(x=>x.url.endsWith("/armory_rack.webp")));
   assert.ok(r.resources.some(x=>x.url.endsWith("/armory_sword.webp")));
  }
  assert.equal(min.fullWorldSourceGraphLoaded,false);
  assert.equal(graph.fullWorldSourceGraphLoaded,true);
  assert.equal(draw.fullWorldSourceGraphLoaded,true);
  assert.ok(graph.probe.log.some(x=>x.stage==="graph:ready"));
  assert.equal(draw.worldDrawTested,true);
  assert.equal(draw.probe.originalWorldDrawn,true);
  assert.equal(draw.probe.log.filter(x=>x.stage==="draw:complete").length,1);
  assert.equal(min.probe.log.filter(x=>x.stage==="draw:begin").length,0);
  assert.equal(graph.probe.log.filter(x=>x.stage==="draw:begin").length,0);
 }
});

test("P0 six original World draws are actually exercised with no invented low-end-performance approval",()=>{
 assert.equal(six.conditions.repeat,1);
 assert.equal(six.conditions.drawBudget,6);
 assert.equal(six.results.length,6);
 assert.equal(six.completedRuns,6);
 assert.equal(six.successfulOnTestedHost,true);
 for(const browser of ["chrome","firefox"]){
  const run=six.results.find(r=>r.engine===browser&&r.variant==="draw");
  assert.ok(run);
  assert.equal(run.probe.phase,"DONE");
  assert.deepEqual(run.errors,[]);
  assert.equal(run.probe.log.filter(x=>x.stage==="draw:begin").length,6);
  const durations=run.probe.log.filter(x=>x.stage==="draw:complete").map(x=>x.ms);
  assert.equal(durations.length,6);
  assert.ok(durations.every(t=>Number.isFinite(t)&&t>=0));
  assert.equal(run.probe.originalWorldDrawn,true);
  assert.equal(run.serverItemEvents,0);
 }
 assert.equal(six.actualX230iTested,false);
 assert.equal(six.performancePassed,false);
});

test("P0 browser probe keeps route allowlist and actual World imports; leaves online game unchanged",()=>{
 const code=readFileSync(new URL("../tools/art/diagnose_armory_module_graph_resource_p0.mjs",import.meta.url),"utf8");
 const script=readFileSync(new URL("../web/armory-p0-graph-load-probe.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../web/armory-p0-graph-load-probe.html",import.meta.url),"utf8");
 assert.match(code,/http\.listen|server\.listen/);
 assert.match(code,/localhostOnly:true/);
 assert.match(code,/actualX230iTested:false/);
 assert.match(code,/P0_GRAPH_DRAWS/);
 assert.match(script,/createAuthoredWorldRenderer/);
 assert.match(script,/createWorld493RackArtPlan/);
 assert.match(html,/paintArmoryRackPresentedFrame/);
 assert.match(html,/image:both-decoded/);
 assert.doesNotMatch(html,/WebSocket|TryPickup|XMLHttpRequest/);
 assert.doesNotMatch(readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8"),/armory-p0-graph-load-probe/);
});
