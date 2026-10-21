import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {measureGameplayCanvasFoldBudget} from "../scripts/graphics3b_gameplay_fold_budget.mjs";

test("exact actual Chrome 1280x720 source Canvas needs 252px of vertical reclaim",()=>{
 const b=measureGameplayCanvasFoldBudget({viewportHeight:720,canvasTop:365,canvasHeight:606.375});
 assert.equal(b.lowerOverflowPx,252);
 assert.equal(b.minimumUpwardLayoutReclaimPx,252);
 assert.equal(b.visibleCanvasFraction,0.585446);
 assert.equal(b.canvasCenterInsidePage,true);
 assert.equal(b.canvasFullyInPage,false);
 assert.equal(b.fullSilhouetteOrHUDOcclusionCertified,false);
});
test("exact actual Firefox 1280x720 source Canvas needs 270px of vertical reclaim",()=>{
 const b=measureGameplayCanvasFoldBudget({viewportHeight:720,canvasTop:383,canvasHeight:606.38330078125});
 assert.equal(b.lowerOverflowPx,270);
 assert.equal(b.visibleCanvasFraction,0.555754);
 assert.equal(b.canvasCenterInsidePage,true);
 assert.equal(b.canvasFullyInPage,false);
});
test("source Canvas fits fully when moved to a legal CSS rect with room below",()=>{
 const b=measureGameplayCanvasFoldBudget({viewportHeight:720,canvasTop:104,canvasHeight:606});
 assert.equal(b.visibleCanvasFraction,1);
 assert.equal(b.minimumUpwardLayoutReclaimPx,0);
 assert.equal(b.canvasFullyInPage,true);
});
test("cannot claim any upward-only fix will fit an oversized source Canvas",()=>{
 const b=measureGameplayCanvasFoldBudget({viewportHeight:540,canvasTop:50,canvasHeight:650});
 assert.equal(b.canvasTallerThanViewport,true);
 assert.equal(b.minimumUpwardLayoutReclaimPx,null);
 assert.equal(b.canvasFullyInPage,false);
});
test("negative original CSS Canvas top counts clipping above the page",()=>{
 const b=measureGameplayCanvasFoldBudget({viewportHeight:720,canvasTop:-40,canvasHeight:600});
 assert.equal(b.upperOverflowPx,40);
 assert.equal(b.lowerOverflowPx,0);
 assert.equal(b.canvasFullyInPage,false);
 assert.equal(b.visibleCanvasFraction,0.933333);
});
test("non-numeric source viewport input fails closed",()=>{
 for(const bad of [
  {viewportHeight:0,canvasTop:4,canvasHeight:606},
  {viewportHeight:720,canvasTop:Infinity,canvasHeight:606},
  {viewportHeight:720,canvasTop:4,canvasHeight:"606"},
  {viewportHeight:720,canvasTop:NaN,canvasHeight:606}
 ])assert.throws(()=>measureGameplayCanvasFoldBudget(bad),RangeError);
});
test("native evidence includes the budget without scrolling or modifying UI source",()=>{
 const src=readFileSync(new URL("../scripts/graphics3b_native_layout_parity.mjs",import.meta.url),"utf8");
 assert.match(src,/measureGameplayCanvasFoldBudget/);
 assert.match(src,/GRAPHICS3B_P0_LAYOUT_RECLAIM_REQUIRED/);
 assert.match(src,/foldBudget/);
 assert.doesNotMatch(src,/scrollTo\(|scrollIntoView\(|sendTryPickup|setPlayerPosition/);
});
