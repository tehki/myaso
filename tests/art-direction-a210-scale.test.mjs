import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const folder=new URL("../assets/environment/greyhaven/a210-review/",import.meta.url);
const door=JSON.parse(readFileSync(new URL("greyhaven_a210_door_measurement.json",folder),"utf8"));
const report=JSON.parse(readFileSync(new URL("greyhaven_a210_scale_report.json",folder),"utf8"));
test("A2.10 projected Red Lion door matches authored Blender 3/4 source",()=>{
  assert.equal(door.doorObject,"Red Lion / door_front");
  assert.equal(door.cameraSource,"A2 / Red Lion hero / 3-4 angle");
  assert.deepEqual(door.canvas,[640,640]);
  assert.deepEqual(door.doorGroundPixel,[320,320]);
  assert.equal(door.authoredDoorHeightMeters,2.39);
  assert.equal(door.projectedDoorBoundingHeightPx,119.587);
  assert.equal(door.gameXYMatched,false);
  assert.equal(door.productionSpriteScaleApproved,false);
  assert.equal(door.gameplayModified,false);
  assert.equal(door.anatomicalFootPivotValidated,false);
});
test("A2.10 real Chrome compared original 80/112 with 90/126 and 96/134",()=>{
  assert.match(report.browser,/^Chrome\//);
  assert.deepEqual(report.errors,[]);
  assert.equal(report.sourceAtlasesCopiedIntoGraphicsPR,false);
  assert.equal(report.productionScaleApproved,false);
  assert.equal(report.realGameIntegration,false);
  assert.equal(report.combatChanged,false);
  assert.equal(report.footBoneAnchorMeasured,false);
  assert.equal(report.actualMultiplayerFpsMeasured,false);
  assert.equal(report.deployed,false);
  assert.deepEqual(report.candidates,[1,1.125,1.2]);
  assert.equal(report.doorHeightPx,119.587);
  for(const [name,state] of Object.entries({
    silver_idle:report.idle,silver_roll:report.silverRoll,t1_roll:report.t1Roll
  })){
    assert.equal(state.clip,name);
    assert.equal(state.atlasIsActualPr326,true);
    assert.equal(state.gameScaleChanged,false);
    assert.equal(state.physicsChanged,false);
    assert.equal(state.anatomicalFeetValidated,false);
    const samples=["baseline","moderate","larger"].map(k=>state.options[k]);
    const sizes=name==="silver_idle"?[80,90,96]:[112,126,134];
    assert.deepEqual(samples.map(s=>s.width),sizes);
    assert.deepEqual(samples.map(s=>s.height),sizes);
    assert.deepEqual(samples.map(s=>s.scale),[1,1.125,1.2]);
    assert.ok(samples[0].silhouetteHeightPx<samples[1].silhouetteHeightPx);
    assert.ok(samples[1].silhouetteHeightPx<samples[2].silhouetteHeightPx);
    for(const candidate of samples){
      assert.ok(candidate.silhouetteToProjectedDoorHeightRatio>0);
      assert.equal(candidate.authoredDoorHeightPx,119.587);
      assert.equal(candidate.rigFootContactValidated,false);
      assert.equal(candidate.gameRendererChanged,false);
    }
  }
  assert.equal(report.idle.options.baseline.silhouetteHeightPx,59);
  assert.equal(report.idle.options.moderate.silhouetteHeightPx,66.375);
  assert.equal(report.idle.options.larger.silhouetteHeightPx,70.8);
});
test("A2.10 image captures are real Chrome screenshots, not synthetic illustrations",()=>{
  for(const name of ["greyhaven_a210_three_scales_idle.png",
    "greyhaven_a210_three_scales_silver_roll.png",
    "greyhaven_a210_three_scales_t1_roll.png"]){
    const file=new URL(name,folder);
    assert.ok(statSync(file).size>10000);
    const buffer=readFileSync(file);
    assert.equal(buffer.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(buffer.readUInt32BE(16),1750);
    assert.ok(buffer.readUInt32BE(20)>=1130);
  }
});
test("A2.10 scale review cannot alter the game client or source knight atlases",()=>{
  const html=readFileSync(new URL("../web/greyhaven-a210-scale-lab.html",import.meta.url),"utf8");
  const js=readFileSync(new URL("../web/greyhaven-a210-scale-lab.mjs",import.meta.url),"utf8");
  const testCode=readFileSync(new URL("../tools/art/verify_greyhaven_a210_browser.mjs",import.meta.url),"utf8");
  assert.match(html,/visual sizes/);
  assert.doesNotMatch(html,/online-game\.mjs/);
  assert.match(js,/const testPlacement/);
  assert.match(js,/KNIGHT/);
  assert.match(js,/rigFootContactValidated:false/);
  assert.match(js,/gameScaleChanged:false/);
  assert.match(js,/physicsChanged:false/);
  assert.match(js,/__a29_knights__/);
  assert.match(testCode,/127\.0\.0\.1/);
  assert.match(testCode,/productionScaleApproved:false/);
  assert.doesNotMatch(js,/new WebSocket|localStorage|fetch\(.+POST/);
});
