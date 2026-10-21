import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARENA_VIEW_ZOOM } from "../src/browser/arena-viewport.mjs";

const camera=JSON.parse(readFileSync(
  new URL("../assets/environment/greyhaven/a25-review/greyhaven_a25_camera_report.json",import.meta.url),
  "utf8"
));
const webp=JSON.parse(readFileSync(
  new URL("../assets/environment/greyhaven/a25-review/greyhaven_a25_webp_report.json",import.meta.url),
  "utf8"
));

test("A2.5 measured Blender camera basis now agrees with actual game XY after vertical flip",()=>{
  assert.equal(camera.gameZoom,ARENA_VIEW_ZOOM);
  assert.equal(camera.metersPerWorldUnit,.025);
  assert.ok(Math.abs(camera.gamePixelsPerAuthoringMeter-33.6)<1e-8);
  assert.deepEqual(camera.canvas,[640,640]);
  assert.equal(camera.sourceBlenderSaved,false);
  assert.equal(camera.gameplayModified,false);
  assert.equal(camera.A3RollModified,false);
  assert.equal(camera.productionApproved,false);
  assert.deepEqual(Object.keys(camera.buildings).sort(),["gable_merchant","red_lion"]);
  for(const item of Object.values(camera.buildings)){
    const basis=item.basis;
    assert.ok(basis.maximumBasisErrorPxPerMeter<.01);
    const x=basis.gameAlignedPixelsPerMeterXAfterFlip;
    const y=basis.gameAlignedPixelsPerMeterYAfterFlip;
    assert.ok(Math.abs(x[0]-33.6)<.01 && Math.abs(x[1])<.01);
    assert.ok(Math.abs(y[1]-33.6)<.01 && Math.abs(y[0])<.01);
    assert.deepEqual(item.visualDoorPixelAnchorAfterFlip,[320,320]);
    assert.equal(item.authoritativeWorldPlacementVerified,false);
    assert.equal(item.browserSpritePivotVerified,false);
  }
  assert.deepEqual(camera.buildings.red_lion.proposedManifestDoorGameXY,[4365,4075]);
  assert.equal(camera.buildings.gable_merchant.proposedManifestDoorGameXY,null);
});

test("A2.5 all cropped lossless WebP layers round-trip and carry independent visual door offsets",()=>{
  assert.equal(webp.gameCameraZoom,ARENA_VIEW_ZOOM);
  assert.equal(webp.doorPortalAuthorityVerified,false);
  assert.equal(webp.roofOcclusionRuntimeEnabled,false);
  assert.equal(webp.browserPerformanceMeasured,false);
  assert.equal(webp.productionApproved,false);
  for(const [key,building] of Object.entries(webp.buildings)){
    let total=0;
    for(const layer of ["base","roof"]){
      const entry=building.layers[layer];
      assert.match(entry.webp,new RegExp("^"+key+"_a25_"+layer+"\\.webp$"));
      assert.equal(entry.canvasRoundtripExactVisibleRGBA,true);
      assert.equal(entry.imageFlippedVerticallyForGamePositiveYDown,true);
      assert.ok(entry.encodedBytes>1000);
      assert.match(entry.sha256,/^[0-9a-f]{64}$/);
      const [x0,y0,x1,y1]=entry.sourceRectPixels;
      assert.deepEqual(entry.croppedPixels,[x1-x0,y1-y0]);
      const [dx,dy]=entry.drawOffsetFromVisualDoorPixels;
      assert.ok(Math.abs(dx-(x0-320))<.001 && Math.abs(dy-(y0-320))<.001);
      const [ax,ay]=entry.visualDoorAnchorPixelsInCroppedImage;
      assert.ok(Math.abs(ax+dx)<.001 && Math.abs(ay+dy)<.001);
      total+=entry.encodedBytes;
    }
    assert.equal(building.combinedLosslessWebpBytes,total);
    assert.equal(building.gameWorldPlacementApproved,false);
  }
});
