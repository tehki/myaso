import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const prefix="assets/environment/greyhaven/armory-p0/resource-load-review/";
const read=(name)=>JSON.parse(readFileSync(new URL(prefix+name,root),"utf8"));
const original493=read("armory_original_world493_five_source_windows.json");
const consolidated521=read("armory_consolidated_world521_five_source_windows.json");
const fault=read("armory_intentional_world493_http503_continuation.json");
const names=["minimal","world","graphics","graph","draw"];
const SHA={
 "07060f981b8a1dac89184b621b6893dd970a08ae":"db5274b9ad3ea8e28f4a2ef44358cfed247d0625785dc353577a3ee6d136f9e9",
 "3178b9aad8757ceb3594ff04b9e3099dced6b729":"2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a"
};
for(const [source,report,repetitions] of [
 ["07060f981b8a1dac89184b621b6893dd970a08ae",original493,2],
 ["3178b9aad8757ceb3594ff04b9e3099dced6b729",consolidated521,1]
]){
 test("P0 exact original "+source.slice(0,8)+" accepts each isolated original World/3B module subset + images in Chrome and Firefox",()=>{
  assert.equal(report.sourceHeads.world,source);
  assert.equal(report.sourceHeads.graphicsAncestor,"40112c3d3f0eeeb441a3206beba7c5d21e292852");
  assert.deepEqual(report.conditions.variants,names);
  assert.deepEqual(report.conditions.browsers,["chrome","firefox"]);
  assert.equal(report.conditions.repeat,repetitions);
  assert.equal(report.conditions.faultInjectionRoute,null);
  assert.equal(report.conditions.experimentalFaultInjection,false);
  assert.equal(report.conditions.drawBudget,1);
  assert.equal(report.completedRuns,2*repetitions*5);
  assert.equal(report.successfulOnTestedHost,true);
  assert.equal(report.actualX230iTested,false);
  assert.equal(report.performancePassed,false);
  assert.equal(report.gameClientExecuted,false);
  assert.equal(report.productionEdited,false);
  assert.equal(report.hasServerOwnedItemIds,false);
  assert.equal(report.sourceSha256["/__worldsource__/src/browser/authored-world-renderer.mjs"],SHA[source]);
  assert.equal(report.sourceSha256["/__worldsource__/src/world/alpha-armory.mjs"],
    "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf");
  for(const engine of ["chrome","firefox"])for(let repetition=1;repetition<=repetitions;repetition++){
    const group=report.results.filter(r=>r.engine===engine&&r.repetition===repetition);
    assert.deepEqual(group.map(r=>r.variant),names);
    const by=Object.fromEntries(group.map(r=>[r.variant,r]));
    assert.ok(by.minimal.responses.length<by.world.responses.length);
    assert.ok(by.minimal.responses.length<by.graphics.responses.length);
    assert.ok(by.graphics.responses.length<by.graph.responses.length);
    assert.ok(by.world.responses.length<by.graph.responses.length);
    for(const entry of group){
      assert.match(entry.version,engine==="chrome"?/^Chrome\/154\./:/^firefox\/153/);
      assert.deepEqual(entry.errors,[]);
      assert.equal(entry.probe.phase,"DONE");
      assert.equal(entry.serverItemEvents,0);
      assert.ok(entry.probe.log.some(x=>x.stage==="image:both-decoded"));
      assert.ok(entry.probe.log.some(x=>x.stage==="armory_sword:decoded"));
      assert.ok(entry.probe.log.some(x=>x.stage==="armory_rack:decoded"));
    }
    assert.equal(by.minimal.fullWorldSourceGraphLoaded,false);
    assert.equal(by.minimal.graphicsSourceModulesLoaded,false);
    assert.equal(by.world.fullWorldSourceGraphLoaded,true);
    assert.equal(by.world.graphicsSourceModulesLoaded,false);
    assert.equal(by.graphics.fullWorldSourceGraphLoaded,false);
    assert.equal(by.graphics.graphicsSourceModulesLoaded,true);
    assert.equal(by.graph.fullWorldSourceGraphLoaded,true);
    assert.equal(by.graph.graphicsSourceModulesLoaded,true);
    assert.equal(by.graph.worldDrawTested,false);
    assert.equal(by.draw.worldDrawTested,true);
    assert.equal(by.draw.probe.originalWorldDrawn,true);
    assert.equal(by.draw.probe.log.filter(x=>x.stage==="draw:complete").length,1);
    assert.ok(by.draw.probe.log.find(x=>x.stage==="draw:complete").ms>=0);
  }
 });
}

test("P0 controlled failing original World import preserves independent Graphics-only evidence, remains red and marks synthetic fault",()=>{
 assert.equal(fault.sourceHeads.world,"07060f981b8a1dac89184b621b6893dd970a08ae");
 assert.equal(fault.conditions.faultInjectionRoute,"/__worldsource__/src/world/alpha-armory.mjs");
 assert.equal(fault.conditions.experimentalFaultInjection,true);
 assert.equal(fault.conditions.repeat,1);
 assert.deepEqual(fault.conditions.browsers,["chrome"]);
 assert.deepEqual(fault.results.map(r=>r.variant),names);
 assert.deepEqual(fault.results.map(r=>r.probe.phase),["DONE","ERROR","DONE","ERROR","ERROR"]);
 assert.equal(fault.completedRuns,2);
 assert.equal(fault.successfulOnTestedHost,false);
 for(const r of fault.results){
  assert.equal(r.repetition,1);
  if(["world","graph","draw"].includes(r.variant)){
   assert.ok(r.errors.some(x=>x.includes("HTTP 503")&&x.includes("alpha-armory.mjs")));
   assert.equal(r.probe.originalWorldDrawn,false);
  }else{
   assert.equal(r.probe.phase,"DONE");
   assert.deepEqual(r.errors,[]);
  }
 }
 assert.equal(fault.actualX230iTested,false);
 assert.equal(fault.productionEdited,false);
});

test("P0 browser source bisection accepts only exact World #493 or #521 heads, never mutates original game sources",()=>{
 const script=readFileSync(new URL("../tools/art/diagnose_armory_module_graph_resource_p0.mjs",import.meta.url),"utf8");
 const module=readFileSync(new URL("../web/armory-p0-graph-load-probe.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../web/armory-p0-graph-load-probe.html",import.meta.url),"utf8");
 assert.match(script,/Object\.hasOwn\(allowedWorldHeads/);
 assert.match(script,/P0_GRAPH_FAIL_ROUTE/);
 assert.match(script,/P0_GRAPH_TIMEOUT_MS/);
 assert.match(script,/const variants=\["minimal","world","graphics","graph","draw"\]/);
 assert.match(script,/INTENTIONAL QA-ONLY SOURCE FAILURE/);
 assert.match(module,/import\("\/__worldsource__\/src\/world\/alpha-armory\.mjs"\)/);
 assert.match(module,/import\("\.\.\/src\/browser\/armory-rack-visual\.mjs"\)/);
 assert.match(html,/loadSourceGroup\(mode\)/);
 assert.match(html,/Image\(\)/);
 assert.doesNotMatch(html,/WebSocket|TryPickup|XMLHttpRequest/);
 const actualGame=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.doesNotMatch(actualGame,/armory-p0-graph-load-probe/);
});
