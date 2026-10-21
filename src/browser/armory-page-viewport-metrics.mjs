/**
 * Graphics 3B P0 — source-geometry visibility in the browser's *actual page*.
 * This is passive telemetry only, not a layout/scroll/Canvas/input decision.
 * Distinguishes "inside intrinsic Canvas" from "above the browser fold".
 * It does not assert visibility through HUD overlays or other DOM occlusion.
 */
import {projectArenaPoint} from "./arena-viewport.mjs";
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function rect(x,y,width,height){
  if(![x,y,width,height].every(finite)||width<=0||height<=0)
    throw new RangeError("Finite positive CSS or canvas dimensions required");
  return Object.freeze({x,y,width,height});
}
function visiblePortion(box,viewport){
 const ix=Math.max(0,Math.min(box.x+box.width,viewport.width)-Math.max(box.x,0));
 const iy=Math.max(0,Math.min(box.y+box.height,viewport.height)-Math.max(box.y,0));
 return Object.freeze({
   visibleFraction:Number((ix*iy/(box.width*box.height)).toFixed(6)),
   fullyInBrowserViewport:ix>=box.width-1e-6 && iy>=box.height-1e-6,
   intersectsBrowserViewport:ix>0&&iy>0
 });
}
export function measureOriginalRackPageVisibility({
 rackScreenRect,canvasRect,canvasWidth,canvasHeight,
 viewportWidth,viewportHeight,camera,zoom,observedActors=[]
}={}){
 if(!rackScreenRect||!Array.isArray(observedActors)||
    !finite(canvasWidth)||canvasWidth<=0||
    !finite(canvasHeight)||canvasHeight<=0||
    !finite(viewportWidth)||viewportWidth<=0||
    !finite(viewportHeight)||viewportHeight<=0||
    !camera||!finite(camera.x)||!finite(camera.y)||!finite(zoom)||zoom<=0)
   throw new RangeError("Cannot measure without exact original game viewport");
 const canvas=rect(canvasRect.x,canvasRect.y,canvasRect.width,canvasRect.height);
 const rack=rect(rackScreenRect.x,rackScreenRect.y,
   rackScreenRect.width,rackScreenRect.height);
 const scaleX=canvas.width/canvasWidth,scaleY=canvas.height/canvasHeight;
 const canvasCss=canvas;
 const rackCss=rect(canvas.x+rack.x*scaleX,
  canvas.y+rack.y*scaleY,rack.width*scaleX,rack.height*scaleY);
 const rackInBrowser=visiblePortion(rackCss,{width:viewportWidth,height:viewportHeight});
 // A fighter's center is a useful visibility anchor, NOT proof every body
 // pixel or original Silver character animation is visible and unobscured.
 const actors=observedActors.map(a=>{
  if(!Number.isSafeInteger(a.netId)||!finite(a.x)||!finite(a.y))
   throw new RangeError("Untrusted or malformed source actor");
  const p=projectArenaPoint(a.x,a.y,camera.x,camera.y,
   canvasWidth,canvasHeight,zoom);
  const cx=canvas.x+p.x*scaleX,cy=canvas.y+p.y*scaleY;
  return Object.freeze({netId:a.netId,
   pageCenterX:Number(cx.toFixed(3)),
   pageCenterY:Number(cy.toFixed(3)),
   centerInsideBrowserViewport:cx>=0&&cy>=0&&
     cx<viewportWidth&&cy<viewportHeight});
 });
 return Object.freeze({
  rackCss,canvasCss,
  rackVisibleFraction:rackInBrowser.visibleFraction,
  rackFullyInBrowserViewport:rackInBrowser.fullyInBrowserViewport,
  rackIntersectsBrowserViewport:rackInBrowser.intersectsBrowserViewport,
  canvasVisibleFraction:visiblePortion(canvasCss,{width:viewportWidth,height:viewportHeight}).visibleFraction,
  actorCentersInsideBrowser:actors.filter(x=>x.centerInsideBrowserViewport).length,
  actorCentersTotal:actors.length,actors:Object.freeze(actors),
  measuredFromRealDOM:false, // caller must use real canvas getBoundingClientRect()
  pageOcclusionVerified:false,
  fullSilverAnimationVisibilityVerified:false,
  changesGameplay:false
 });
}
