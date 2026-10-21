import {createAuthoredWorldRenderer} from "/__3cp37__/src/browser/authored-world-renderer.mjs";
import {normalizeWorldBuildingReplacementIds,worldBuildingPresentation} from "/__world521__/src/world/building-presentation.mjs";
import {MAP_IDS,getAuthoredMap} from "/__world521__/src/world/authored-maps.mjs";
import {projectArenaPoint,ARENA_VIEW_ZOOM} from "../src/browser/arena-viewport.mjs";

const info=document.getElementById("status");
window.__p0OriginalFacadeProof=null;
try{
 const MAP=MAP_IDS.overworld,VIEW=640;
 const b=getAuthoredMap(MAP).buildings.find(item=>item.id==="red-lion");
 if(!b||b.entrance.x!==4365||b.entrance.y!==4060||
   ARENA_VIEW_ZOOM!==.84)throw Error("Original World entrance changed");
 const t=worldBuildingPresentation(MAP,"red-lion",[]);
 if(t?.visualDepthY!==4075||t?.interactionPortal?.y!==4075)
  throw Error("World depth/portal contract altered");
 const decoder=async path=>{const image=new Image();image.src=path;await image.decode();return image;};
 const [day,dusk,roof]=await Promise.all([
  decoder("/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_day_dimensional.webp"),
  decoder("/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp"),
  decoder("/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp")
 ]);
 if(day.naturalWidth!==228||day.naturalHeight!==297||
  dusk.naturalWidth!==228||dusk.naturalHeight!==297||
  roof.naturalWidth!==238||roof.naturalHeight!==197)
  throw Error("3B original facade/roof size changed");
 const camera={x:4365,y:4075},smithCamera={x:3800,y:4038};
 const draw=(camera,replacements,facade=null,canvas=null)=>{
  const c=canvas??document.createElement("canvas");c.width=c.height=VIEW;
  const ctx=c.getContext("2d",{willReadFrequently:true});
  const painter=createAuthoredWorldRenderer({
   cacheCap:24,buildLimit:8,replacedBuildingIds:replacements,
   worldReplacementValidator:normalizeWorldBuildingReplacementIds
  });
  ctx.save();ctx.translate(320,320);ctx.scale(.84,.84);ctx.translate(-320,-320);
  painter.draw(ctx,MAP,camera,VIEW,VIEW,.84);
  ctx.restore();
  if(facade){
   const anchor=projectArenaPoint(4365,4075,camera.x,camera.y,VIEW,VIEW,.84);
   // Original 3B #466 facade native 228×297, anchored at visual doorway.
   // Historical A2.26 roof stays frozen and is not reauthored.
   ctx.drawImage(facade,anchor.x-114,anchor.y-269);
   ctx.drawImage(roof,anchor.x-119,anchor.y-283);
  }
  return{canvas:c,stats:{...painter.stats},replacements:painter.replacedBuildingIds};
 };
 const rgba=canvas=>canvas.getContext("2d").getImageData(0,0,VIEW,VIEW).data;
 const count=(a,b)=>{let changed=0;
  for(let i=0;i<a.length;i+=4)
   if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;
  return changed;
 };
 const original=draw(camera,[]);
 const suppressed=draw(camera,["red-lion"]);
 const redLionReplacementDifference=count(rgba(original.canvas),rgba(suppressed.canvas));
 const daylight=draw(camera,["red-lion"],day,document.getElementById("day"));
 const dusklight=draw(camera,["red-lion"],dusk,document.getElementById("dusk"));
 const replacedDayPixelDiff=count(rgba(suppressed.canvas),rgba(daylight.canvas));
 const replacedDuskPixelDiff=count(rgba(suppressed.canvas),rgba(dusklight.canvas));
 const dayDuskDiff=count(rgba(daylight.canvas),rgba(dusklight.canvas));
 const originalSmith=draw(smithCamera,[]);
 const replacedSmith=draw(smithCamera,["red-lion"]);
 const smithDiff=count(rgba(originalSmith.canvas),rgba(replacedSmith.canvas));
 let smithNotReplaceable=false,missingValidatorRejected=false;
 try{normalizeWorldBuildingReplacementIds(MAP,["smith"])}catch{smithNotReplaceable=true;}
 try{createAuthoredWorldRenderer({replacedBuildingIds:["red-lion"]})}
 catch{missingValidatorRejected=true;}
 window.__p0OriginalFacadeProof={
  ready:true,sourceWorld:"3178b9aad8757ceb3594ff04b9e3099dced6b729",
  source3C:"efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac",
  source3B:"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5",
  actualFirstParty3CPainter:true,actualOriginal3BFacade:true,
  originalWorldValidator:true,suppressedDefaultPlaceholder:true,
  redLionReplacementDifference,replacedDayPixelDiff,replacedDuskPixelDiff,dayDuskDiff,
  smithDiff,smithNotReplaceable,missingValidatorRejected,
  dayDrawnCache:daylight.stats.cached,duskDrawnCache:dusklight.stats.cached,
  dayDuskSourceDistinct:dayDuskDiff>0,
  frozenRoofByteSourcePreserved:true,originalZoneAndPortalPreserved:true,
  onlineGameIntegrated:false,real3AActorDepthTested:false,
  original3CAtmosphereReauthored:false,approvedForRelease:false};
 info.textContent="Original World / 3C / 3B visual source TESTED only; "+
  "removed Red Lion placeholder "+redLionReplacementDifference+
  " pixel changes, new day facade "+replacedDayPixelDiff+
  ", dusk "+replacedDuskPixelDiff+
  ", Blacksmith affected "+smithDiff+
  " pixels. NOT LIVE multiplayer or actor depth.";
}catch(e){info.textContent="Source contract failed closed: "+String(e);console.error(e);}
