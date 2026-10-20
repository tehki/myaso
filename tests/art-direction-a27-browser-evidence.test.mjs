import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const directory=new URL("../assets/environment/greyhaven/a27-review/",import.meta.url);
const report=JSON.parse(readFileSync(new URL("greyhaven_a27_browser_report.json",directory),"utf8"));

test("A2.7 real Chrome report verifies all three image-backed art-only building selections",()=>{
  assert.match(report.browser,/^Chrome\//);
  assert.equal(report.noCombatRuntime,true);
  assert.equal(report.noRealGameFrameTimeTest,true);
  assert.equal(report.notProductionApproved,true);
  assert.deepEqual(report.browserErrors,[]);
  assert.deepEqual(Object.keys(report.loaded).sort(),["blacksmith","gable_merchant","red_lion"]);
  for(const [slug,result] of Object.entries(report.loaded)){
    assert.equal(result.loadedBuilding,slug);
    assert.equal(result.status,"ready");
    assert.equal(result.roofOpacity,1);
    assert.equal(result.artOnly,true);
    assert.equal(result.gameXYCompatible,false);
    assert.equal(result.authoritativePortalIntegrated,false);
    assert.ok(result.decodeMs>0);
    assert.ok(result.lastCanvasRenderMs>=0);
    assert.ok(result.lastCanvasRenderMs<5000);
    assert.ok(result.decodeMs<5000);
  }
  assert.equal(report.faded.roofOpacity,.25);
  assert.equal(report.faded.roofFront,false);
  assert.equal(report.reset.roofOpacity,1);
  assert.equal(report.reset.roofFront,true);
});

test("A2.7 attached screenshots are actual nonempty browser PNG captures",()=>{
  for(const name of [
    "greyhaven_a27_browser_red_lion.png",
    "greyhaven_a27_browser_gable_merchant.png",
    "greyhaven_a27_browser_blacksmith.png",
    "greyhaven_a27_browser_roof_fade.png"
  ]){
    const file=new URL(name,directory);
    assert.ok(statSync(file).size>10000,name+" must contain real screenshot pixels");
    const png=readFileSync(file);
    assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16),1220);
    assert.ok(png.readUInt32BE(20)>=960);
  }
});
