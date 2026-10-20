import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../web/greyhaven-a27-art-preview.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../web/greyhaven-a27-art-preview.mjs",import.meta.url),"utf8");
const acceptance=readFileSync(new URL("../tools/art/verify_greyhaven_a27_browser.mjs",import.meta.url),"utf8");
const webps=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_webp_report.json",
  import.meta.url),"utf8"));

test("A2.7 preview is a separate art-only route, never imported by the gameplay client",()=>{
  assert.match(html,/greyhaven-a27-art-preview\.mjs/);
  assert.match(html,/Review only:/);
  assert.match(html,/roof-opacity|id="roof"/);
  assert.match(html,/id="building"/);
  assert.match(html,/id="review"/);
  assert.match(html,/id="roof-front"/);
  assert.match(html,/no gameplay/);
  assert.doesNotMatch(html,/online-game\.mjs|game\.mjs|authoritative-client\.mjs/);
  assert.doesNotMatch(js,/from ["'].*online-game|connect\(|WebSocket|EventSource|fetch\(.+POST/);
  assert.match(js,/artOnly: true/);
  assert.match(js,/gameXYCompatible: false/);
  assert.match(js,/authoritativePortalIntegrated: false/);
});

test("A2.7 images and offsets use actual A2.6 WebP source report without inventing map pins",()=>{
  assert.deepEqual(Object.keys(webps.buildings).sort(),
    ["blacksmith","gable_merchant","red_lion"]);
  assert.equal(webps.browserGameXYAligned,false);
  assert.equal(webps.browserRuntimeIntegrated,false);
  assert.match(js,/data\.layers\.base/);
  assert.match(js,/data\.layers\.roof/);
  assert.match(js,/drawOffsetPixelsFromVisualDoor/);
  assert.match(js,/validLayerFilename/);
  assert.match(js,/img\.decode\(\)/);
  assert.match(js,/roofSlider\.value/);
  assert.match(js,/ctx\.globalAlpha/);
  for(const [slug,entry] of Object.entries(webps.buildings)){
    for(const layer of ["base","roof"]){
      assert.equal(entry.layers[layer].filename,slug+"_a26_"+layer+".webp");
      assert.equal(entry.layers[layer].visiblePixelRoundtrip,true);
    }
  }
});
test("A2.7 local Chrome acceptance does not modify or deploy the production game",()=>{
  assert.match(acceptance,/127\.0\.0\.1/);
  assert.match(acceptance,/--no-sandbox/);
  assert.match(acceptance,/noCombatRuntime:true/);
  assert.match(acceptance,/noRealGameFrameTimeTest:true/);
  assert.match(acceptance,/notProductionApproved:true/);
  assert.match(acceptance,/greyhaven_a27_browser_roof_fade\.png/);
  assert.doesNotMatch(acceptance,/git push|docker|deploy|fetch\(.*admin/);
});
