import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {AUTHORED_MAPS,MAP_IDS} from "/__a231_3c__/authored-maps.mjs";
import {GREYHAVEN_LIGHTING_VERSION,createGreyhavenLightingPlan,paintGreyhavenLightingPools,paintGreyhavenLightingFixtures} from "/__a231_3c__/greyhaven-atmosphere.mjs";
const $=id=>document.getElementById(id);
const src="../assets/environment/greyhaven/";
async function json(p){const r=await fetch(new URL(p,import.meta.url),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status+" "+p);return r.json();}
async function image(p){const i=new Image();i.src=new URL(p,import.meta.url).href;await i.decode();return i;}
let state=null;
window.__a231Review=()=>state;
try{
 const spec=await json(src+"a231-review/greyhaven_a231_lighting_handoff.json");
 const world=AUTHORED_MAPS[MAP_IDS.overworld];
 const building=world.buildings.find(b=>b.id==="red-lion");
 if(!building||GREYHAVEN_LIGHTING_VERSION!=="3c-p24-1"||
  ARENA_VIEW_ZOOM!==.84||spec.graphics3C.sourceHead!=="8e85584b6007b38e1a00155b77473e92b0afec6a"||
  building.x!==spec.building.x||building.y!==spec.building.y||building.w!==spec.building.w||
  building.h!==spec.building.h||building.entrance.x!==spec.building.authoredWorldEntrance[0]||
  building.entrance.y!==spec.building.authoredWorldEntrance[1]||
  !spec.material.roofByteIdenticalToA226||spec.material.extraRadialFacadeGlow||
  spec.a230AlphaRisk.changedPixels!==69||spec.approvedForProduction)
   throw Error("Unapproved or drifting cross-branch source contract");
 // Construct a named isolated fixture from the actual immutable World data;
 // filter OTHER 3C building lights (including nearby market) from this 3B-only
 // visual review, NOT from real 3C source or any production world map.
 const map={...world,buildings:[building]};
 const leftTile={x:4096,y:3584,width:512,height:512};
 const belowTile={x:4096,y:4096,width:512,height:512};
 const tileDefs=[leftTile,belowTile];
 const cached=tileDefs.map(tile=>{
  const pool=document.createElement("canvas"),fixture=document.createElement("canvas");
  pool.width=fixture.width=512;pool.height=fixture.height=512;
  const t0=performance.now();
  const a=pool.getContext("2d");a.save();a.translate(-tile.x,-tile.y);
  paintGreyhavenLightingPools(a,map,tile);a.restore();
  const b=fixture.getContext("2d");b.save();b.translate(-tile.x,-tile.y);
  paintGreyhavenLightingFixtures(b,map,tile);b.restore();
  return {tile,pool,fixture,coldMs:performance.now()-t0,
   plan:createGreyhavenLightingPlan(map,tile)};
 });
 const light=cached[0].plan.find(l=>l.id==="red-lion");
 if(!light||light.x!==4365||light.fixtureY!==4045||light.poolY!==4069||
    light.radius!==108||
    !cached[1].plan.some(l=>l.id==="red-lion"))throw Error("3C P2.4 fixture unexpectedly changed");
 const [day,dusk,roof,silver,adult,adultMeta,knightMeta]=await Promise.all([
  image(src+"a231-review/"+spec.material.day.file),image(src+"a231-review/"+spec.material.dusk.file),
  image(src+"a231-review/"+spec.material.roof.file),
  image("/__a231_knights__/silver_idle.webp"),
  image("/__a231_adults__/adult-masculine_idle.webp"),
  json("/__a231_adults__/adult-masculine_idle.json"),
  json("/__a231_knights__/asset-build-report.json")
 ]);
 if(day.naturalWidth!==228||dusk.naturalWidth!==228||roof.naturalWidth!==238||
    day.naturalHeight!==297||dusk.naturalHeight!==297||roof.naturalHeight!==197||
    silver.naturalWidth!==640||silver.naturalHeight!==1280||
    adult.naturalWidth!==640||adult.naturalHeight!==1280||
    adultMeta.sourceFramePx!==160||adultMeta.atlasHeight!==1280||
    knightMeta.silver_idle.outputFrameSize!==160)throw Error("Pinned art dimensions wrong");

 let pending=false,camDx=0,camDy=0,drawCount=0;
 const origin=spec.building.visualArtDoor;
 const truePos=(x,y)=>projectArenaPoint(x,y,origin[0]+camDx,origin[1]+camDy,640,640);
 function draw(){
  pending=false;
  const dx=Number($("dx").value),dy=Number($("dy").value),roofOpacity=Number($("roof").value)/100,
   depth=$("depth").value;
  const results={};const fullErrors=[];
  const silverAt=truePos(origin[0]+dx,origin[1]+dy);
  const adultAt=truePos(origin[0]-75,origin[1]+38);
  for(const [mode,facade] of [["day",day],["dusk",dusk]]){
   const started=performance.now();
   const ctx=$(mode).getContext("2d",{willReadFrequently:true});
   ctx.fillStyle=mode==="day"?"#8b8c78":"#404a4a";
   ctx.fillRect(0,0,640,640);
   ctx.strokeStyle=mode==="day"?"rgba(95,94,76,.22)":"rgba(22,28,24,.4)";
   for(let j=0;j<640;j+=32){
    ctx.beginPath();ctx.moveTo(j,0);ctx.lineTo(j,640);ctx.moveTo(0,j);ctx.lineTo(640,j);ctx.stroke();
   }
   const blitChunks=key=>{
    for(const entry of cached){
     const pt=truePos(entry.tile.x,entry.tile.y);
     ctx.drawImage(entry[key],pt.x,pt.y,512*ARENA_VIEW_ZOOM,512*ARENA_VIEW_ZOOM);
    }
   };
   // Existing 3C P2.4 cached warm ground pool (dusk only in this review mode).
   if(mode==="dusk")blitChunks("pool");
   const anchor=truePos(origin[0],origin[1]);
   const drawActors=()=>{
    ctx.drawImage(silver,0,0,160,160,silverAt.x-48,silverAt.y-62.4,96,96);
    ctx.drawImage(adult,0,0,160,160,adultAt.x-48,adultAt.y-62.4,96,96);
   };
   if(depth==="behind")drawActors();
   ctx.drawImage(facade,anchor.x-114,anchor.y-269);
   blitChunks("fixture"); // 3C's own *single* forged sconce and flame
   if(depth==="front")drawActors();
   ctx.save();ctx.globalAlpha=roofOpacity;
   ctx.drawImage(roof,anchor.x-119,anchor.y-283);ctx.restore();
   results[mode]={drawMs:performance.now()-started};
  }
  drawCount++;
  state={ready:true,
   authoringMode:"isolated cross-branch art composite, NOT actual Greyhaven runtime",
   gameZoom:ARENA_VIEW_ZOOM,camDx,camDy,dx,dy,depth,roofOpacity,
   artDoor:origin,authoredWorldEntrance:spec.building.authoredWorldEntrance,
   fixtureWorldXY:[light.x,light.fixtureY],poolWorldXY:[light.x,light.poolY],radius:light.radius,
   chunkWorldUnits:512,cachedChunks:cached.length,coldChunkBuildMs:cached.map(c=>c.coldMs),
   single3CSourceVersion:GREYHAVEN_LIGHTING_VERSION,
   redLion3CLightCount:1,
   facade3BApertureNoRadialGlow:true,
   originalBlenderGeometryPreserved:true,alphaHazardPixelCount:spec.a230AlphaRisk.changedPixels,
   sourceHead:"a71378a42be3408ea4116e8e5333e3b9faeb3faf",
   source3CHead:spec.graphics3C.sourceHead,
   adultPreviewProductionApproved:false,
   sourceKnightHead:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
   sourceAdultHead:"91f1c2c4737b8f0275bb22bfbca4acc1501daa00",
   engineScreenshotOnly:true,realGameDrawOrderValidated:false,liveGameFPSMeasured:false,
   serverPortalOrCollisionValidated:false,productionApproved:false,
   frameCanvasDrawSamplesMs:results,drawCount,
   playerXYErrorPx:Math.hypot(silverAt.x-(320+(dx-camDx)*.84),silverAt.y-(320+(dy-camDy)*.84))};
  $("dxValue").textContent=String(dx);$("dyValue").textContent=String(dy);$("roofValue").textContent=(roofOpacity*100)+"%";
  $("status").textContent="Original pinned 3B + 3C sources: one sconce and cached ground pool, no extra radial facade glow. Source preview, not production.";
  $("status").dataset.state="ready";
 }
 const refresh=()=>{if(!pending){pending=true;requestAnimationFrame(draw);}};
 for(const id of ["dx","dy","roof","depth"])$(id).addEventListener("input",refresh);
 window.__a231SetCamera=(x,y)=>{camDx=x;camDy=y;refresh();};
 requestAnimationFrame(draw);
}catch(e){$("status").textContent="Blocked: "+e.message;$("status").dataset.state="error";console.error(e);}
