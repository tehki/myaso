import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const render=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_render_report.json",
  import.meta.url),"utf8"));
const webp=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_webp_report.json",
  import.meta.url),"utf8"));

test("A2.6 actual 3/4 renders keep visual doors centered but reject game XY matching",()=>{
  assert.deepEqual(render.canvas,[640,640]);
  assert.equal(render.gameXYProjectionMatched,false);
  assert.equal(render.drawInBrowserApproved,false);
  assert.equal(render.A3RollChanged,false);
  assert.equal(render.gameplayChanged,false);
  assert.equal(render.productionApproved,false);
  assert.deepEqual(Object.keys(render.buildings).sort(),
    ["blacksmith","gable_merchant","red_lion"]);
  for(const [slug,b] of Object.entries(render.buildings)){
    assert.equal(b.runtimeDoorOrPivotValidated,false);
    assert.ok(b.maxXYGameProjectionMismatchPixelsPerMeter>10,
      slug+" cannot be treated as a game-XY atlas");
    assert.ok(Math.abs(b.anchorPixels[0]-320)<0.01);
    assert.ok(Math.abs(b.anchorPixels[1]-320)<0.01);
    assert.ok(b.layers.base.renderVisibleMeshes>0);
    assert.ok(b.layers.roof.renderVisibleMeshes>0);
    assert.ok(b.layers.whole.renderVisibleMeshes>0);
    assert.ok(b.layers.base.pngBytes>5000 && b.layers.roof.pngBytes>5000);
  }
  assert.equal(render.buildings.blacksmith.facadeRelativeCameraTurnDegrees,180);
  assert.equal(render.buildings.red_lion.facadeRelativeCameraTurnDegrees,0);
});

test("A2.6 six authored WebPs preserve cropped RGBA, door offsets and small composite mismatch",()=>{
  assert.equal(webp.browserGameXYAligned,false);
  assert.equal(webp.browserRuntimeIntegrated,false);
  assert.equal(webp.roofOcclusionValidated,false);
  assert.equal(webp.productionApproved,false);
  assert.deepEqual(webp.canvas,[640,640]);
  for(const [slug,b] of Object.entries(webp.buildings)){
    let total=0;
    assert.equal(b.gameWorldDoorPositionValidated,false);
    assert.equal(b.spriteFeetPivotValidatedInBrowser,false);
    assert.ok(b.compositeForegroundRGBMeanAbsoluteErrorVsWholeRender<3);
    for(const layer of ["base","roof"]){
      const a=b.layers[layer];
      assert.equal(a.visiblePixelRoundtrip,true);
      assert.match(a.sha256,/^[0-9a-f]{64}$/);
      assert.equal(a.filename,slug+"_a26_"+layer+".webp");
      const [x0,y0,x1,y1]=a.cropSourceRect;
      assert.deepEqual(a.cropPixels,[x1-x0,y1-y0]);
      const [dx,dy]=a.drawOffsetPixelsFromVisualDoor;
      const [ax,ay]=a.visualDoorAnchorPixelsInCrop;
      assert.ok(Math.abs(dx+ax)<.001 && Math.abs(dy+ay)<.001);
      assert.ok(a.bytes>1500);
      total+=a.bytes;
    }
    assert.equal(b.combinedWebPBytes,total);
  }
});
