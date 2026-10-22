/**
 * Graphics 3B P0 — read-only first-party Canvas fold budget.
 * The minimum vertical reclaim is for a full existing-sized canvas; it does not
 * prescribe a CSS fix or certify that HUD/sprites remain unobscured.
 */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
export function measureGameplayCanvasFoldBudget({viewportHeight,canvasTop,canvasHeight}={}){
 if(![viewportHeight,canvasTop,canvasHeight].every(finite)||
    viewportHeight<=0||canvasHeight<=0)
  throw new RangeError("Actual finite viewport and Canvas geometry required");
 const visible=Math.max(0,Math.min(viewportHeight,canvasTop+canvasHeight)-Math.max(0,canvasTop));
 const visibleFraction=Number((visible/canvasHeight).toFixed(6));
 const lowerOverflowPx=Math.max(0,Math.ceil(canvasTop+canvasHeight-viewportHeight));
 const upperOverflowPx=Math.max(0,Math.ceil(-canvasTop));
 return Object.freeze({
  viewportHeight,canvasTop,canvasHeight,
  visibleCanvasFraction:visibleFraction,
  canvasCenterInsidePage:canvasTop+canvasHeight/2>=0&&canvasTop+canvasHeight/2<viewportHeight,
  canvasFullyInPage:upperOverflowPx===0&&lowerOverflowPx===0,
  lowerOverflowPx,upperOverflowPx,
  minimumUpwardLayoutReclaimPx:canvasHeight>viewportHeight?null:lowerOverflowPx,
  canvasTallerThanViewport:canvasHeight>viewportHeight,
  sourceAuthority:"actual DOM geometry only",
  fullSilhouetteOrHUDOcclusionCertified:false,
  changesGameOrPageLayout:false
 });
}
