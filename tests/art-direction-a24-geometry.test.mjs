import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARENA_VIEW_ZOOM, projectArenaPoint } from '../src/browser/arena-viewport.mjs';

const report=JSON.parse(readFileSync(
  new URL('../assets/environment/greyhaven/a24-review/greyhaven_a24_projection_report.json',import.meta.url),
  'utf8'));
const roof=JSON.parse(readFileSync(
  new URL('../assets/environment/greyhaven/a24-review/greyhaven_a24_roof_crop_report.json',import.meta.url),
  'utf8'));

test('A2.4 browser projections exactly follow actual viewport source and A1 scale',()=>{
  assert.equal(report.gameZoom, ARENA_VIEW_ZOOM);
  assert.equal(report.gameWorldUnitsPerMeter,40);
  assert.ok(Math.abs(report.expectedGamePixelsPerMeter-40*ARENA_VIEW_ZOOM)<1e-10);
  const [dx,dy]=report.manifestDoorGameXY;
  const [width,height]=report.browserComparisonViewportPixels;
  assert.deepEqual([width,height],[1120,720]);
  assert.equal(report.doorAlignedSamples[0].id,'door');
  for(const sample of report.doorAlignedSamples){
    const [x,y]=sample.meters;
    const expected=projectArenaPoint(dx+x*40,dy+y*40,dx,dy,width,height);
    assert.ok(Math.abs(expected.x-sample.browserPixel[0])<=0.001);
    assert.ok(Math.abs(expected.y-sample.browserPixel[1])<=0.001);
    const p=sample.blenderDoorAlignedPixel;
    const err=Math.hypot(expected.x-p[0],expected.y-p[1]);
    assert.ok(Math.abs(err-sample.registrationErrorPx)<0.003,
      'Measured Blender camera mismatch must agree with current browser camera');
  }
  assert.ok(report.maxSampleErrorPx>50);
  assert.equal(report.requiresCameraMatchedRerender,true);
  assert.equal(report.directSingleLayerPlacementApproved,false);
  assert.equal(report.productionApproved,false);
});

test('A2.4 cropped roof can restore the full review alpha canvas, but not runtime pivots',()=>{
  assert.deepEqual(roof.sourceCanvas,[1120,720]);
  assert.deepEqual(roof.originalAlphaBoundingBox,[108,39,1061,567]);
  assert.deepEqual(roof.cropSourceRectPixels,[106,37,1063,569]);
  assert.deepEqual(roof.drawOffsetPixels,[106,37]);
  assert.deepEqual(roof.croppedCanvasPixels,[957,532]);
  assert.equal(roof.referenceCanvasPixelRoundtrip,true);
  assert.ok(roof.croppedWebpBytes<roof.originalWebpBytes);
  assert.ok(roof.byteSavings>20000);
  assert.equal(roof.runtimeIntegrated,false);
  assert.equal(roof.stableGameWorldPivotValidated,false);
  assert.equal(roof.roofOcclusionInBrowserValidated,false);
  assert.equal(roof.productionApproved,false);
});
