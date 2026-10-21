import {prepareRedLionSourceArt,createRedLionArtGatedWorldPainter} from "../src/browser/red-lion-original-art-readiness.mjs";
import {createAuthoredWorldRenderer} from "/__3cp37__/src/browser/authored-world-renderer.mjs";
import {normalizeWorldBuildingReplacementIds} from "/__world521__/src/world/building-presentation.mjs";
import {MAP_IDS} from "/__world521__/src/world/authored-maps.mjs";
import {projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const status=document.getElementById("status");
window.__redLionFallbackReview=null;
try {
 const paths=Object.freeze({
  day:"/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_day_dimensional.webp",
  dusk:"/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp",
  roof:"/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp"
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
 function frame(canvas,painter,fa=null){
  const c=document.getElementById(canvas).getContext("2d",{willReadFrequently:true});
  c.save();c.translate(w/2,w/2);c.scale(z,z);c.translate(-w/2,-w/2);
  painter.draw(c,MAP_IDS.overworld,camera,w,w,z);c.restore();
  if(fa){
   const point=projectArenaPoint(4365,4075,camera.x,camera.y,w,w,z);
   c.drawImage(fa.day,point.x-114,point.y-269);
   c.drawImage(fa.roof,point.x-119,point.y-283);
  }
  return c.getImageData(0,0,w,w).data;
 }
 const baseline=frame("baseline",makePainter([]));
 const observed=frame("gated",decision.painter,decision.paintFacadeAllowed?art:null);
 let changed=0;
 for(let i=0;i<baseline.length;i+=4)
  if(baseline[i]!==observed[i]||
     baseline[i+1]!==observed[i+1]||
     baseline[i+2]!==observed[i+2]||
     baseline[i+3]!==observed[i+3])changed++;
 const ready=art.status==="ready";
 window.__redLionFallbackReview=Object.freeze({
  ready:true,artReady:ready,
  actualBrowserImageDecode:ready,
  fallbackDefaultPlaceholder:decision.fallbackDefaultPlaceholder,
  replacementApplied:decision.paintFacadeAllowed,
  replacedBuildingIds:[...decision.painter.replacedBuildingIds],
  originalFacadePixelsDifferentFromPlaceholder:changed,
  fallbackPixelsIdenticalToOriginal:!ready&&changed===0,
  browserSourcePaths:paths,
  actorDepthVerified:false,
  gameRendererIntegrated:false,
  originalAssetsMutated:false,
  lowEndChromiumIssueResolved:false,
  releaseApproved:false
 });
 status.textContent=ready?"All authentic facade images decoded; World validator enabled one replacement.":
  "One original facade asset failed; World original placeholder kept.";
}catch(e){
 status.textContent="Source contract error: "+String(e);
 console.error(e);
}
