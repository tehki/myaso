import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const build=readFileSync(new URL("../tools/art/build_blood_iron_a2.py",import.meta.url),"utf8");
const renderScript=readFileSync(
  new URL("../tools/art/render_greyhaven_a26_billboards.py",import.meta.url),"utf8");
const report=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_render_report.json",
  import.meta.url),"utf8"));
const webps=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_webp_report.json",
  import.meta.url),"utf8"));

test("Blacksmith forge is next to anvil, not across the entrance path",()=>{
  assert.match(build, /"Blacksmith \/ open forge hearth",\(9\.3,6\.05,\.62\)/);
  assert.match(build, /"Blacksmith \/ orange embers",\(9\.3,5\.54,\.92\)/);
  assert.match(build, /"Blacksmith \/ anvil",\(10\.7,6\.4,\.92\)/);
  assert.match(renderScript, /assert not intersects\(forge,entrance_lane\)/);
  assert.match(renderScript, /assert not intersects\(anvil,entrance_lane\)/);
  assert.match(renderScript, /assert not intersects\(forge,door\) and not intersects\(forge,step\)/);
  assert.match(renderScript, /assert not intersects\(anvil,door\) and not intersects\(anvil,step\)/);
  assert.match(renderScript, /workyard_previous/);
  assert.match(renderScript, /"gameCollisionModified":False/);
  assert.match(renderScript, /"originalBlenderSceneSaved":False/);
  const q=report.blacksmithWorkyard;
  assert.deepEqual(q.correctedForgeCenterXYZ,[9.3,6.05,.62]);
  assert.deepEqual(q.correctedEmbersCenterXYZ,[9.3,5.54,.92]);
  assert.equal(q.visibleFrontFireboxOpening,true);
  assert.match(build, /"Blacksmith \/ firebox mouth",\(9\.3,5\.60,\.90\)/);
  assert.deepEqual(q.originalForgeCenterXYZ,[13.3,6.95,.62]);
  assert.equal(q.forgeToAnvilHorizontalClearanceMeters,.325);
  assert.equal(q.forgingPropsInEntranceCorridor,false);
  assert.equal(q.doorAndStepUnmodified,true);
  assert.equal(q.gameCollisionModified,false);
  assert.equal(report.gameplayChanged,false);
  assert.equal(report.A3RollChanged,false);
  assert.equal(report.productionApproved,false);
});
test("Only Blacksmith artistic composition changed; WebP review remains unapproved",()=>{
  assert.deepEqual(Object.keys(report.buildings).sort(),
    ["blacksmith","gable_merchant","red_lion"]);
  assert.equal(report.buildings.blacksmith.facadeRelativeCameraTurnDegrees,180);
  assert.equal(webps.browserGameXYAligned,false);
  assert.equal(webps.browserRuntimeIntegrated,false);
  assert.equal(webps.productionApproved,false);
  const b=webps.buildings.blacksmith;
  assert.ok(b.compositeForegroundRGBMeanAbsoluteErrorVsWholeRender<3);
  assert.equal(b.gameWorldDoorPositionValidated,false);
  assert.equal(b.spriteFeetPivotValidatedInBrowser,false);
  for(const layer of ["base","roof"]){
    assert.equal(b.layers[layer].visiblePixelRoundtrip,true);
    assert.match(b.layers[layer].sha256,/^[a-f0-9]{64}$/);
  }
});
