import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const art=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/art-manifest.v1.json",import.meta.url),"utf8"));
const calibrated=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a25-review/greyhaven_a25_camera_report.json",import.meta.url),"utf8"));
const cinematic=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_render_report.json",import.meta.url),"utf8"));
const webp25=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a25-review/greyhaven_a25_webp_report.json",import.meta.url),"utf8"));
const webp26=JSON.parse(readFileSync(new URL(
  "../assets/environment/greyhaven/a26-review/greyhaven_a26_webp_report.json",import.meta.url),"utf8"));

const door=art.firstSlice.approvedBuilding.door;
const meters=art.coordinateConvention.metersPerWorldUnit;
function compare(dx,dy,xb,yb){
  const projected=projectArenaPoint(door.x+dx,door.y+dy,door.x,door.y,640,640);
  const bx=320+dx*meters*xb[0]+dy*meters*yb[0];
  const by=320+dx*meters*xb[1]+dy*meters*yb[1];
  return {projected,delta:Math.hypot(projected.x-bx,projected.y-by)};
}
test("A2.8 uses authentic game zoom and proposed A1 door, never server claims",()=>{
  assert.equal(ARENA_VIEW_ZOOM,.84);
  assert.equal(art.coordinateConvention.cameraZoom,ARENA_VIEW_ZOOM);
  assert.equal(meters,.025);
  assert.deepEqual([door.x,door.y],[4365,4075]);
  assert.equal(calibrated.productionApproved,false);
  assert.equal(cinematic.gameXYProjectionMatched,false);
  assert.equal(webp25.productionApproved,false);
  assert.equal(webp26.browserRuntimeIntegrated,false);
});
test("A2.8 measured overhead basis matches projectArenaPoint and 3/4 does not",()=>{
  const c=calibrated.buildings.red_lion.basis;
  const k=cinematic.buildings.red_lion;
  for(const [dx,dy] of [[40,40],[120,-80],[-120,80],[0,0]]){
    const good=compare(dx,dy,c.gameAlignedPixelsPerMeterXAfterFlip,c.gameAlignedPixelsPerMeterYAfterFlip);
    assert.ok(good.delta<.001,"top-down mismatch");
    const bad=compare(dx,dy,k.blenderGroundBasisX,k.blenderGroundBasisY);
    if(dx===0&&dy===0)assert.equal(bad.delta,0);
    else assert.ok(bad.delta>5,"tilted 3/4 cannot count as calibrated");
  }
  const a=compare(40,40,k.blenderGroundBasisX,k.blenderGroundBasisY);
  const b=compare(120,-80,k.blenderGroundBasisX,k.blenderGroundBasisY);
  assert.ok(Math.abs(a.delta-36.17)<.02);
  assert.ok(Math.abs(b.delta-270.766)<.02);
});
test("A2.8 review route is standalone and imports game viewport formula",()=>{
  const html=readFileSync(new URL("../web/greyhaven-a28-xy-lab.html",import.meta.url),"utf8");
  const src=readFileSync(new URL("../web/greyhaven-a28-xy-lab.mjs",import.meta.url),"utf8");
  const harness=readFileSync(new URL("../tools/art/verify_greyhaven_a28_browser.mjs",import.meta.url),"utf8");
  assert.match(html,/greyhaven-a28-xy-lab\.mjs/);
  assert.match(html,/Not a playable world/);
  assert.doesNotMatch(html,/online-game\.mjs|network-client\.mjs/);
  assert.match(src,/import \{ARENA_VIEW_ZOOM, projectArenaPoint\} from "\.\.\/src\/browser\/arena-viewport\.mjs"/);
  assert.match(src,/knightFeetPivotValidated:false/);
  assert.match(src,/gameIntegrated:false/);
  assert.match(src,/portalAuthorityVerified:false/);
  assert.match(src,/syntheticReference:true/);
  assert.match(harness,/127\.0\.0\.1/);
  assert.match(harness,/real Chrome isolated XY camera comparison/);
  assert.doesNotMatch(src,/new WebSocket|fetch\(.+,.*POST|\/processing|localStorage/);
});

const evidenceDir=new URL("../assets/environment/greyhaven/a28-review/",import.meta.url);
test("A2.8 browser screenshots and report preserve non-production acceptance",()=>{
  const r=JSON.parse(readFileSync(new URL("greyhaven_a28_browser_report.json",evidenceDir),"utf8"));
  assert.match(r.browser,/^Chrome\//);
  assert.equal(r.gameplayChanged,false);
  assert.equal(r.knightFootPivotVerified,false);
  assert.equal(r.worldPortalAuthorityVerified,false);
  assert.equal(r.gameRuntimeFPSMeasured,false);
  assert.equal(r.deployed,false);
  assert.deepEqual(r.consoleOrNetworkErrors,[]);
  assert.equal(r.initial.calibratedErrorPx,0);
  assert.ok(r.initial.cinematicErrorPx>30);
  assert.equal(r.initial.roofOpacity,.6);
  assert.equal(r.moved.calibratedErrorPx,0);
  assert.ok(r.moved.cinematicErrorPx>250);
  assert.equal(r.moved.roofOpacity,.2);
  for(const name of ["greyhaven_a28_camera_comparison.png",
                     "greyhaven_a28_xy_offset_and_roof_fade.png"]){
    const file=new URL(name,evidenceDir);
    assert.ok(statSync(file).size>10000,name);
    const data=readFileSync(file);
    assert.equal(data.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(data.readUInt32BE(16),1480);
    assert.ok(data.readUInt32BE(20)>=1030);
  }
});