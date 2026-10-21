import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url);
const file=path=>readFileSync(new URL(path,root));
const json=path=>JSON.parse(file(path).toString("utf8"));
const sha=path=>createHash("sha256").update(file(path)).digest("hex");
const base="assets/environment/greyhaven/";
const report=json(base+"a229-review/greyhaven_a229_craft_browser_report.json");
const contract=json(base+"red-lion-a225-architecture-handoff.json");
const authored=json(base+"a228-review/greyhaven_a228_facade_report.json");
const roof=json(base+"a226-review/greyhaven_a226_weathering_report.json");

test("A2.29 source-authentic review leaves original roof and facade bytes untouched",()=>{
 assert.equal(report.baselineGraphicsHead,"6d40942b82b24d8596ed55af2850454d00a9165b");
 assert.equal(report.sourceHashes["a228-review/red_lion_a228_facade_day.webp"],authored.variants.day.sha256);
 assert.equal(report.sourceHashes["a228-review/red_lion_a228_facade_dusk.webp"],authored.variants.dusk.sha256);
 for(const [name,digest] of Object.entries(report.sourceHashes))assert.equal(sha(base+name),digest);
 assert.equal(roof.newRoofSha256,sha(base+"a228-review/red_lion_a228_roof.webp"));
 for(const key of ["roofEdited","productionApproved","trueGameCapture","dynamicAtmosphereLightingValidated","liveFrameTimingMeasured","fighterReadabilityValidated"])assert.equal(report[key],false);
 assert.deepEqual([contract.proposedWorldPlacement.door.x,contract.proposedWorldPlacement.door.y],[4365,4075]);
});

test("A2.29 native Chrome/Firefox DPR1/DPR2 material crops protect source alpha",()=>{
 assert.equal(report.browsers.length,4);
 for(const mode of ["chrome","firefox"])for(const dpr of [1,2]){
  const entry=report.browsers.find(x=>x.kind===mode&&x.dpr===dpr);
  assert.ok(entry,mode+" DPR"+dpr);
  assert.match(entry.browserVersion,mode==="chrome"?/^Chrome\/154\./:/^firefox\//);
  assert.deepEqual(entry.errors,[]);
  const state=entry.state;
  assert.equal(state.ready,true);
  assert.equal(state.sourceHead,report.baselineGraphicsHead);
  assert.equal(state.gameZoom,0.84);
  assert.equal(state.metersPerWorldUnit,0.025);
  assert.deepEqual(state.visibleVariants,["source","day","dusk"]);
  assert.deepEqual(Object.keys(state.regions),["door","windowWest","windowEast","plinth"]);
  for(const key of ["roofBytesChanged","dynamicLightingEngine","runtimeIntegrated","productionApproved"])assert.equal(state[key],false);
  for(const region of Object.values(state.regions)){
   for(const kind of ["day","dusk"]){
    const stats=region.variants[kind];
    assert.equal(stats.alphaDifferences,0);
    assert.ok(stats.visibleSourcePixels>100);
    assert.ok(stats.changedVisibleRGB>200);
    assert.ok(stats.changedVisibleRGB<=stats.visibleSourcePixels);
   }
  }
  const png=file(base+"a229-review/"+entry.screenshot);
  assert.ok(png.length>100000);
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),1500*dpr);
 }
});

test("A2.29 window illumination contrasts with the darkened stone plinth",()=>{
 for(const run of report.browsers){
  const region=run.state.regions;
  for(const name of ["windowWest","windowEast"]){
   assert.ok(region[name].variants.dusk.candidateMeanLuma >
             region[name].variants.day.candidateMeanLuma+5,run.kind+" window detail");
  }
  assert.ok(region.plinth.variants.dusk.candidateMeanLuma <
            region.plinth.variants.day.candidateMeanLuma-15);
  assert.equal(run.state.sourceArtBlenderEdited,false);
 }
 const viewer=file("web/greyhaven-a229-craft-inspector.mjs").toString("utf8");
 const harness=file("tools/art/verify_greyhaven_a229_craft_browser.mjs").toString("utf8");
 assert.match(viewer,/getImageData/);
 assert.match(viewer,/roofBytesChanged:false/);
 assert.match(harness,/127\.0\.0\.1/);
 assert.match(harness,/webDriverBiDi/);
 assert.doesNotMatch(viewer,/WebSocket|localStorage|XMLHttpRequest/);
});
