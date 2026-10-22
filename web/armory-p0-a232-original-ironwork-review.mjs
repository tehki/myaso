import {prepareRedLionSourceArt,createRedLionArtGatedWorldPainter} from "../src/browser/red-lion-original-art-readiness.mjs";
import {paintRedLionFrameInScratch} from "../src/browser/red-lion-atomic-frame-qa.mjs";
import {createAuthoredWorldRenderer} from "/__3cp37__/src/browser/authored-world-renderer.mjs";
import {normalizeWorldBuildingReplacementIds} from "/__world521__/src/world/building-presentation.mjs";
import {MAP_IDS} from "/__world521__/src/world/authored-maps.mjs";
import {projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const status=document.getElementById("status");
window.__redLionFallbackReview=null;
try {
 const paths=Object.freeze({
  day:"/__3ba232__/assets/environment/greyhaven/a232-review/red_lion_a232_day_ironwork.webp",
  dusk:"/__3ba232__/assets/environment/greyhaven/a232-review/red_lion_a232_dusk_ironwork.webp",
  roof:"/__3ba232__/assets/environment/greyhaven/a232-review/red_lion_a232_roof_unchanged.webp"
 });
 const loadImage=src=>new Promise((resolve,reject)=>{
  const i=new Image();
  i.onload=()=>i.decode().then(()=>resolve(i),reject);
  i.onerror=()=>reject(new Error("Original source image unavailable"));
  i.src=src;
 });
 const art=await prepareRedLionSourceArt({
  paths,loadImage,origin:location.origin
 });
 const makePainter=replaced=>createAuthoredWorldRenderer({
  replacedBuildingIds:replaced,worldReplacementValidator:normalizeWorldBuildingReplacementIds,
  cacheCap:24,buildLimit:8
 });
 const decision=createRedLionArtGatedWorldPainter({
  art,createRenderer:createAuthoredWorldRenderer,
  worldReplacementValidator:normalizeWorldBuildingReplacementIds,
  options:{cacheCap:24,buildLimit:8}
 });
 const camera={x:4365,y:4075},w=640,z=.84;
 function frame(canvas,painter,fa=null,fault=false){
  const c=canvas.getContext("2d",{willReadFrequently:true});
  c.save();c.translate(w/2,w/2);c.scale(z,z);c.translate(-w/2,-w/2);
  painter.draw(c,MAP_IDS.overworld,camera,w,w,z);c.restore();
  if(fa){
   const point=projectArenaPoint(4365,4075,camera.x,camera.y,w,w,z);
   c.drawImage(fa.day,point.x-114,point.y-269);
   // QA-only deterministic late graphics exception AFTER the first real
   // image was painted into a scratch buffer, not the visible destination.
   if(fault)throw new Error("QA injected late Red Lion Canvas draw failure");
   c.drawImage(fa.roof,point.x-119,point.y-283);
  }
  return c.getImageData(0,0,w,w).data;
 }
 const baseline=frame(document.getElementById("baseline"),makePainter([]));
 const injectedCanvasFailure=new URLSearchParams(location.search).get("lateCanvasFault")==="1";
 const composed=paintRedLionFrameInScratch({
  destinationCanvas:document.getElementById("gated"),
  makeScratch:(width,height)=>{
   const e=document.createElement("canvas");e.width=width;e.height=height;return e;
  },
  preferDetailed:decision.paintFacadeAllowed,
  paintDetailed:canvas=>frame(canvas,decision.painter,art,injectedCanvasFailure),
  paintPlaceholder:canvas=>frame(canvas,makePainter([]))
 });
 const observed=document.getElementById("gated").getContext("2d",{willReadFrequently:true}).getImageData(0,0,w,w).data;
 let changed=0;
 for(let i=0;i<baseline.length;i+=4)
  if(baseline[i]!==observed[i]||
     baseline[i+1]!==observed[i+1]||
     baseline[i+2]!==observed[i+2]||
     baseline[i+3]!==observed[i+3])changed++;
 const ready=art.status==="ready";
 let priorSourceDifferencePixels=null,priorSourceArtReady=false;
 if(ready && !injectedCanvasFailure && composed.detailedDrawn){
  // Load prior original A2.31 source through the SAME actual browser, exact
  // pinned A2.32 commit's unchanged parent images; no reconstructed sprites.
  const priorPaths=Object.freeze({
   day:"/__3ba232__/assets/environment/greyhaven/a231-review/red_lion_a231_day_dimensional.webp",
   dusk:"/__3ba232__/assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp",
   roof:"/__3ba232__/assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp"
  });
  const prior=await prepareRedLionSourceArt({paths:priorPaths,loadImage,origin:location.origin});
  if(prior.status!=="ready")throw Error("Actual original A2.31 source comparison unavailable");
  priorSourceArtReady=true;
  const oldGated=createRedLionArtGatedWorldPainter({
   art:prior,createRenderer:createAuthoredWorldRenderer,
   worldReplacementValidator:normalizeWorldBuildingReplacementIds,
   options:{cacheCap:24,buildLimit:8}
  });
  if(!oldGated.paintFacadeAllowed)throw Error("Original A2.31 source gate unexpectedly denied");
  const earlierCanvas=document.createElement("canvas");
  earlierCanvas.width=w;earlierCanvas.height=w;
  const previous=frame(earlierCanvas,oldGated.painter,prior);
  let changedRgb=0,changedAlpha=0;
  for(let i=0;i<previous.length;i+=4){
   if(previous[i]!==observed[i]||previous[i+1]!==observed[i+1]||previous[i+2]!==observed[i+2])
    changedRgb++;
   if(previous[i+3]!==observed[i+3])changedAlpha++;
  }
  priorSourceDifferencePixels=Object.freeze({changedRgb,changedAlpha});
 }

 let priorHingeArtReady=false,priorHingeDifferencePixels=null;
 if(ready && !injectedCanvasFailure && composed.detailedDrawn){
  // Compare real 3B owner-approved physical door support revision against the
  // PREVIOUS genuine editable Blender A2.32 hinged-door source in this SAME
  // source World9+3C rendered browser frame; no synthetic image/actor movement.
  const priorHingePaths=Object.freeze({
   day:"/__3ba232_before__/assets/environment/greyhaven/a232-review/red_lion_a232_day_ironwork.webp",
   dusk:"/__3ba232_before__/assets/environment/greyhaven/a232-review/red_lion_a232_dusk_ironwork.webp",
   roof:"/__3ba232_before__/assets/environment/greyhaven/a232-review/red_lion_a232_roof_unchanged.webp"
  });
  const priorHingeArt=await prepareRedLionSourceArt({
   paths:priorHingePaths,loadImage,origin:location.origin
  });
  if(priorHingeArt.status!=="ready")
   throw Error("Actual A2.32 lower hinge source comparison unavailable");
  const priorHingeDecision=createRedLionArtGatedWorldPainter({
   art:priorHingeArt,createRenderer:createAuthoredWorldRenderer,
   worldReplacementValidator:normalizeWorldBuildingReplacementIds,
   options:{cacheCap:24,buildLimit:8}
  });
  if(!priorHingeDecision.paintFacadeAllowed)
   throw Error("Prior physically mounted A2.32 Blender World facade approval denied");
  const priorCanvas=document.createElement("canvas");
  priorCanvas.width=w;priorCanvas.height=w;
  const pixels=frame(priorCanvas,priorHingeDecision.painter,priorHingeArt);
  let changedRgb=0,changedAlpha=0;
  for(let i=0;i<pixels.length;i+=4){
   if(pixels[i]!==observed[i]||pixels[i+1]!==observed[i+1]||pixels[i+2]!==observed[i+2])
    changedRgb++;
   if(pixels[i+3]!==observed[i+3])changedAlpha++;
  }
  priorHingeArtReady=true;
  priorHingeDifferencePixels=Object.freeze({changedRgb,changedAlpha});
 }
 window.__redLionFallbackReview=Object.freeze({
  ready:true,artReady:ready,originalArtRevision:"A2.32",
  sourceBeforeRevision:"A2.31",priorSourceArtReady,priorSourceDifferencePixels,
  priorHingeArtReady,priorHingeDifferencePixels,
  raisedLowerHingeSourceZ:.96,unchangedUpperHingeSourceZ:1.88,
  actualBrowserImageDecode:ready,
  fallbackDefaultPlaceholder:composed.placeholderDrawn,
  replacementApplied:composed.detailedDrawn,
  replacedBuildingIds:composed.detailedDrawn?[...decision.painter.replacedBuildingIds]:[],
  recoveredLateDrawError:composed.recoveredLateDetailedFailure,
  injectedCanvasFailure,
  stagingScratchOnly:true,
  originalFacadePixelsDifferentFromPlaceholder:changed,
  fallbackPixelsIdenticalToOriginal:composed.placeholderDrawn&&changed===0,
  browserSourcePaths:paths,
  actorDepthVerified:false,
  gameRendererIntegrated:false,
  originalAssetsMutated:false,
  lowEndChromiumIssueResolved:false,
  releaseApproved:false
 });
 status.textContent=composed.recoveredLateDetailedFailure?
  "Original images decoded but late Canvas paint failed; entire World placeholder frame retained.":
  composed.detailedDrawn?
  "All authentic facade images decoded; World validator enabled one replacement.":
  "One original facade asset failed; World original placeholder kept.";
}catch(e){
 status.textContent="Source contract error: "+String(e);
 console.error(e);
}
