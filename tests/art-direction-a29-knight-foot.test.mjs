import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const dir=new URL("../assets/environment/greyhaven/a29-review/",import.meta.url);
const report=JSON.parse(readFileSync(new URL("greyhaven_a29_knight_browser_report.json",dir),"utf8"));
test("A2.9 used real PR326 knight source without importing atlases into graphics",()=>{
  assert.equal(report.companionPr326Commit,
    "c0b08a2a527cc492199db9f1e01dc9727225987f");
  assert.match(report.companionModuleSHA256,/^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(report.companionAtlasSHA256).sort(),
    ["silver_idle","silver_roll","t1_roll"]);
  for(const digest of Object.values(report.companionAtlasSHA256))
    assert.match(digest,/^[0-9a-f]{64}$/);
  assert.match(report.browser,/^Chrome\//);
  assert.deepEqual(report.browserErrors,[]);
  assert.equal(report.canvasPresentationOnly,true);
  assert.equal(report.anatomicalFootPivotVerified,false);
  assert.equal(report.combatHitboxChanged,false);
  assert.equal(report.spriteOrAtlasCommittedIntoGraphicsPR,false);
  assert.equal(report.realGameRuntimeTested,false);
  assert.equal(report.gameFrameTimeMeasured,false);
  assert.equal(report.multiplayerRooftopOcclusionValidated,false);
  assert.equal(report.deployed,false);
});
test("A2.9 Chrome recorded exact knight render size/offset from PR326 and silhouette proxies",()=>{
  const a=report.initial,b=report.rolled,c=report.sentinel;
  assert.equal(a.realAtlasLoaded,true);
  assert.equal(a.clip,"silver_idle");
  assert.deepEqual(a.drawOffset,[-40,-52]);
  assert.equal(a.renderWidth,80);
  assert.equal(a.renderHeight,80);
  assert.equal(b.clip,"silver_roll");
  assert.deepEqual(b.drawOffset,[-56,-65]);
  assert.equal(b.renderWidth,112);
  assert.equal(b.frame,7);
  assert.equal(c.clip,"t1_roll");
  assert.equal(c.renderWidth,112);
  assert.equal(c.frame,5);
  assert.equal(c.directionIndex,6);
  assert.equal(report.faded.roofOpacity,.2);
  assert.equal(report.faded.roofOverActor,false);
  assert.equal(report.sampledFrameCount,36);
  assert.equal(report.alphaSilhouetteSamples.length,36);
  const expected={silver_idle:[18,20.5],silver_roll:[10.6,22.5],t1_roll:[13.4,41.4]};
  for(const [clip,[low,high]] of Object.entries(expected)){
    const actual=report.alphaSilhouetteSamples.filter(x=>x.clip===clip);
    assert.equal(actual.length,12);
    assert.equal(Math.min(...actual.map(x=>x.proxyBottomRelativeToOriginPx)),low);
    assert.equal(Math.max(...actual.map(x=>x.proxyBottomRelativeToOriginPx)),high);
    assert.ok(actual.every(x=>x.alphaBounds.bottom<160&&x.alphaBounds.top>=0));
  }
  for(const sample of [a,b,c]) {
    assert.equal(sample.anatomicalFootPivotVerified,false);
    assert.equal(sample.gameIntegrated,false);
  }
});
test("A2.9 images are actual Chrome screenshots, not illustrative or invented",()=>{
  for(const name of ["greyhaven_a29_silver_idle_chrome.png",
    "greyhaven_a29_silver_a3_roll_chrome.png",
    "greyhaven_a29_t1_roll_roof_chrome.png"]){
    const path=new URL(name,dir);
    assert.ok(statSync(path).size>10000);
    const image=readFileSync(path);
    assert.equal(image.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
    assert.equal(image.readUInt32BE(16),1370);
    assert.ok(image.readUInt32BE(20)>=1060);
  }
});
test("A2.9 preview is opt-in and companion-only; no renderer/game/network import",()=>{
  const page=readFileSync(new URL("../web/greyhaven-a29-knight-lab.html",import.meta.url),"utf8");
  const viewer=readFileSync(new URL("../web/greyhaven-a29-knight-lab.mjs",import.meta.url),"utf8");
  const harness=readFileSync(new URL("../tools/art/verify_greyhaven_a29_knights.mjs",import.meta.url),"utf8");
  assert.match(page,/LOCAL, visual QA only/);
  assert.match(page,/not.*foot pivots/i);
  assert.doesNotMatch(page,/online-game\.mjs/);
  assert.match(viewer,/__a29_knights__/);
  assert.match(viewer,/silhouetteBottomFromOriginPx/);
  assert.match(viewer,/anatomicalFootPivotVerified:false/);
  assert.match(viewer,/sourceAssetsCommittedToGraphicsPR:false/);
  assert.match(harness,/actualCommit,expectedKnightCommit/);
  assert.match(harness,/127\.0\.0\.1/);
  assert.match(harness,/--serve/);
  assert.doesNotMatch(viewer,/new WebSocket|\/processing|localStorage|window\.location\.assign/);
});