import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ARMORY_RACK_ART} from "../src/browser/armory-rack-visual.mjs";
const root=new URL("../",import.meta.url);
const filename="assets/environment/greyhaven/armory-p0/world-ui-review/armory_p0_world493_ui503_native_report.json";
const report=JSON.parse(readFileSync(new URL(filename,root),"utf8"));

test("P0 original 3B sword source yields one robust opaque qa landmark, never enlarging UI hit box",()=>{
 assert.equal(report.browserResults.length,2);
 for(const b of report.browserResults){
  assert.deepEqual(b.stableHit,{
   x:20,y:55,radius:2,minimumNeighborhoodAlpha:224,
   qaLandmarkOnly:true,expandsHitBox:false
  });
  assert.equal(b.alphaSampler.sourceShaExpected,ARMORY_RACK_ART.swordSha256);
  assert.equal(b.alphaSampler.alphaOpaquePixel,159);
  assert.equal(b.alphaSampler.alphaTransparentPixel,0);
  assert.ok(b.alphaSampler.clickablePixels>0);
  assert.equal(b.maskOverlap.sourceMaskOnly,true);
  assert.equal(b.maskOverlap.liveRenderedGameOcclusionValidated,false);
  assert.equal(b.maskOverlap.count,4);
  assert.equal(b.maskOverlap.pairs.length,6);
  assert.equal(b.maskOverlap.maxOverlap,0);
  for(const pair of b.maskOverlap.pairs){
   assert.equal(pair.sourceMaskOverlapPixels,0);
   assert.equal(pair.ids.length,2);
   assert.notEqual(pair.ids[0],pair.ids[1]);
  }
 }
});

test("P0 each of four distinct original World swords independently clickable via real UI503 in Chrome + Firefox",()=>{
 const expectedIds=Array.from({length:4},(_,i)=>"ART-ONLY-NO-SERVER-"+i);
 for(const engine of ["chrome","firefox"]){
  const b=report.browserResults.find(x=>x.engine===engine);
  assert.ok(b);
  assert.deepEqual(b.errors,[]);
  assert.deepEqual(b.initial.sourceWorldSocketPositions,[
   [3740,4038],[3780,4038],[3820,4038],[3860,4038]
  ]);
  assert.equal(b.allSwordClicks.length,8);
  for(const mode of ["scaled-dpr2","desktop"]){
   const segment=b.allSwordClicks.filter(x=>x.mode===mode);
   assert.equal(segment.length,4);
   assert.deepEqual(segment.map(x=>x.index),[0,1,2,3]);
   assert.deepEqual(segment.map(x=>x.itemId),expectedIds);
   assert.ok(segment.every(x=>x.visualIntentOnly===true));
   assert.ok(segment.every(x=>x.realPickupCommitted===false));
   assert.ok(segment.every(x=>Number.isFinite(x.pointerCanvasXY[0])&&
                               Number.isFinite(x.pointerCanvasXY[1])));
   assert.ok(segment.every(x=>x.cssWidth>0&&x.cssWidth<=640));
  }
  const state=b.afterAllFourSourcePixelClicks;
  assert.equal(state.visualIntents.length,10);
  assert.deepEqual(state.visualIntents.slice(-4),expectedIds);
  assert.deepEqual(state.visualIntents.slice(2,6),expectedIds);
  assert.equal(state.combatFallback,1);
  assert.equal(state.cancelled,3);
  assert.equal(state.actualServerEvents,0);
  assert.equal(state.combatHandlerActuallyCalled,false);
  assert.equal(state.productionApproved,false);
 }
});

test("P0 four-sword source click matrix preserves strict pointer, UI and network boundaries",()=>{
 const tool=readFileSync(new URL("tools/art/verify_armory_world493_ui503.mjs",root),"utf8");
 const viewer=readFileSync(new URL("web/armory-p0-world493-ui-review.mjs",root),"utf8");
 assert.match(tool,/allSwordClicks/);
 assert.match(tool,/__p0WorldUiSourceMaskOverlap/);
 assert.match(tool,/assert\.equal\(maskOverlap\.maxOverlap,0\)/);
 assert.match(viewer,/__p0WorldUiSourceMaskOverlap/);
 assert.match(viewer,/stableSourcePixel/);
 assert.match(viewer,/hitTestVisibleSwordAlpha/);
 assert.doesNotMatch(viewer,/WebSocket|TryPickup|XMLHttpRequest/);
 assert.equal(report.realGameClientExecuted,false);
 assert.equal(report.realMultiplayerUsers,0);
 assert.equal(report.realServerTryPickup,false);
 assert.equal(report.combatHandlerExecuted,false);
 assert.equal(report.productionApproved,false);
});
