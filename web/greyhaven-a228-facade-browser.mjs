import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const root="../assets/environment/greyhaven/", knightBase="/__a228_knights__/", size=640;
const $=id=>document.getElementById(id);
const fetchJson=async path=>{const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status+" "+path);return r.json();};
const loadImage=async path=>{const i=new Image();i.src=new URL(path,import.meta.url).href;await i.decode();return i;};
const contract=await fetchJson(root+"red-lion-a225-architecture-handoff.json");
const report=await fetchJson(root+"a228-review/greyhaven_a228_facade_report.json");
const knights=await fetchJson(knightBase+"asset-build-report.json");
const art={};
let state=null;
try{
 if(ARENA_VIEW_ZOOM!==0.84||contract.projection.cameraZoom!==ARENA_VIEW_ZOOM||
 report.roofBinaryIdenticalToA226!==true||report.productionApproved!==false||
 JSON.stringify(report.visualDoorCanvasPx)!=="[320,320]"||
 JSON.stringify(report.sourceGroundBasisPixelsPerSourceMeter)!==
 JSON.stringify(contract.projection.groundBasisPixelsPerSourceMeter))throw Error("Art/viewport contract mismatch");
 const source=contract.rasterLayers.base;
 const renderParts=[
  ["source",root+source.file.slice("assets/environment/greyhaven/".length),source],
  ["day",root+"a228-review/"+report.variants.day.file,report.variants.day],
  ["dusk",root+"a228-review/"+report.variants.dusk.file,report.variants.dusk]
 ];
 for(const [name,path,meta] of renderParts){
  const image=await loadImage(path);
  if(image.naturalWidth!==228||image.naturalHeight!==297||
   JSON.stringify(meta.drawOffsetFromVisualDoorPixels)!=="[-114,-269]")throw Error(name+" facade asset mismatch");
  art[name]=image;
 }
 art.roof=await loadImage(root+"a228-review/red_lion_a228_roof.webp");
 art.knight=await loadImage(knightBase+"silver_idle.webp");
 if(art.roof.naturalWidth!==238||art.roof.naturalHeight!==197||
    art.knight.naturalWidth!==640||art.knight.naturalHeight!==1280||
    knights.silver_idle.frames!==4||knights.silver_idle.outputFrameSize!==160)throw Error("Roof/Knight source dimensions changed");
 let scheduled=false;
 function paint(){
  scheduled=false;
  const dx=Number($("east").value),dy=Number($("south").value),
        opacity=Number($("roof").value)/100;
  const door=contract.proposedWorldPlacement.door;
  const pt=projectArenaPoint(door.x+dx,door.y+dy,door.x,door.y,size,size);
  const sourceCanvas={};
  const frameDurations={};
  for(const name of ["source","day","dusk"]){
   const began=performance.now();
   const context=$(name).getContext("2d",{willReadFrequently:true});
   context.fillStyle=name==="dusk"?"#2f414b":"#687a6e";
   context.fillRect(0,0,size,size);
   context.lineWidth=1;
   context.strokeStyle=name==="dusk"?"rgba(115,128,136,.15)":"rgba(220,213,187,.14)";
   for(let i=0;i<640;i+=32){
    context.beginPath();context.moveTo(i,0);context.lineTo(i,640);context.moveTo(0,i);context.lineTo(640,i);context.stroke();
   }
   context.drawImage(art[name],206,51);
   context.drawImage(art.knight,0,0,160,160,pt.x-48,pt.y-62.4,96,96);
   context.save();context.globalAlpha=opacity;
   context.drawImage(art.roof,201,37);context.restore();
   context.lineWidth=2;context.strokeStyle="#90f7d4";
   context.beginPath();context.moveTo(pt.x-5,pt.y);context.lineTo(pt.x+5,pt.y);context.moveTo(pt.x,pt.y-5);context.lineTo(pt.x,pt.y+5);context.stroke();
   sourceCanvas[name]=context.getImageData(0,0,size,size).data;
   frameDurations[name]=performance.now()-began;
  }
  function comparison(a,b){
   let different=0,alpha=0;
   const x=sourceCanvas[a],y=sourceCanvas[b];
   for(let i=0;i<x.length;i+=4){
    if(x[i+3]!==y[i+3])alpha++;
    if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2])different++;
   }
   return {changedCanvasPixels:different,alphaPixelDifferences:alpha};
  }
  const xyError=Math.hypot(pt.x-(320+dx*0.84),pt.y-(320+dy*0.84));
  state={ready:true,browserRendering:true,sourceKnightHead:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
   gameXY:[pt.x,pt.y],gameXYErrorPx:xyError,dx,dy,opacity,
   sourceToDay:comparison("source","day"),sourceToDusk:comparison("source","dusk"),
   frameRenderSamplesMs:frameDurations,roofBinaryIdentical:true,
   authoritativePortalValidated:false,dynamicRoofOcclusionValidated:false,
   networkGameplayModified:false,productionApproved:false};
  $("east-val").textContent=String(dx);$("south-val").textContent=String(dy);
  $("roof-val").textContent=Math.round(opacity*100)+"%";
  $("status").dataset.state="ready";
  $("status").textContent="Original game XY "+pt.x.toFixed(2)+","+pt.y.toFixed(2)+"; unchanged roof; source/detailed/dusk facade. Renderer draw samples are isolated art-canvas timings, not FPS.";
 }
 for(const id of ["east","south","roof"])$(id).addEventListener("input",()=>{if(!scheduled){scheduled=true;requestAnimationFrame(paint);}});
 requestAnimationFrame(paint);
 window.__a228Review=()=>state;
}catch(error){
 $("status").textContent="Review blocked: "+error.message;
 $("status").dataset.state="error";console.error(error);
}
