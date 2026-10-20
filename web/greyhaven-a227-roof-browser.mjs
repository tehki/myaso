// A2.27: offline paired actual-art roof QA, no gameplay integration.
// No synthetic character art or source WebP copies: companion PR326 is separate.
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const $=id=>document.getElementById(id);
const dirs={baseline:"a224",refined:"a226"},size=640,center=320;
const art="../assets/environment/greyhaven/";
const knightRoot="/__a227_knights__/";
const clips={silver_idle:4,silver_roll:8,t1_roll:8};
const display={idle:{x:-48,y:-62.4,w:96,h:96},
 roll:{x:-67,y:-78,w:134,h:134}};
let loaded=null,last=null,pending=false;
const read=async path=>{
 const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});
 if(!r.ok)throw Error("HTTP "+r.status()+" "+path);
 return r.json();
};
const decode=async path=>{
 const img=new Image();img.decoding="async";img.src=new URL(path,import.meta.url).href;
 await img.decode();return img;
};
function imageAlphaBounds(img,offset){
 const ctx=document.createElement("canvas").getContext("2d",{willReadFrequently:true});
 ctx.canvas.width=size;ctx.canvas.height=size;
 ctx.drawImage(img,center+offset[0],center+offset[1]);
 const pixels=ctx.getImageData(0,0,size,size).data;
 let minX=size,minY=size,maxX=-1,maxY=-1;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  if(pixels[(y*size+x)*4+3]===0)continue;
  minX=Math.min(minX,x);minY=Math.min(minY,y);
  maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
 }
 if(maxX<0)throw Error("Empty artwork roof");
 return [minX,minY,maxX+1,maxY+1];
}
function compareRoofPixels(before,after){
 const canvases=[before,after].map(part=>{
  const c=document.createElement("canvas");
  c.width=size;c.height=size;
  const x=c.getContext("2d",{willReadFrequently:true});
  x.drawImage(part.image,center+part.offset[0],center+part.offset[1]);
  return x.getImageData(0,0,size,size).data;
 });
 let changedVisible=0,alphaDifferences=0;
 for(let i=0;i<canvases[0].length;i+=4){
  const a=canvases[0][i+3],b=canvases[1][i+3];
  if(a!==b)alphaDifferences++;
  if(a>0&&b>0&&(canvases[0][i]!==canvases[1][i]||
       canvases[0][i+1]!==canvases[1][i+1]||
       canvases[0][i+2]!==canvases[1][i+2]))changedVisible++;
 }
 return {changedVisiblePixels:changedVisible,alphaPixelDifferences:alphaDifferences};
}
function groundPos(b,dx,dy,meters){
 return [center+meters*(b.x[0]*dx+b.y[0]*dy),
 center+meters*(b.x[1]*dx+b.y[1]*dy)];
}
function cross(ctx,p,color){
 ctx.lineWidth=2;ctx.strokeStyle=color;ctx.beginPath();
 ctx.moveTo(p[0]-7,p[1]);ctx.lineTo(p[0]+7,p[1]);
 ctx.moveTo(p[0],p[1]-7);ctx.lineTo(p[0],p[1]+7);ctx.stroke();
}
function layer(ctx,variant,part,alpha=1){
 const {image,offset}=loaded.versions[variant].layers[part];
 ctx.save();ctx.globalAlpha=alpha;
 ctx.drawImage(image,center+offset[0],center+offset[1]);
 ctx.restore();
}
function render(){
 pending=false;if(!loaded)return;
 const dx=+$("east").value,dy=+$("south").value;
 const clip=$("clip").value,roof=+$("roof").value/100;
 if(!Object.hasOwn(clips,clip))throw Error("Unknown knight clip");
 const at=loaded.visualDoor;
 const projected=projectArenaPoint(at[0]+dx,at[1]+dy,at[0],at[1],size,size);
 const game=[projected.x,projected.y];
 const roll=clip.endsWith("_roll"),rect=display[roll?"roll":"idle"];
 const results={};
 for(const key of Object.keys(dirs)){
  const cv=$(key),ctx=cv.getContext("2d",{alpha:false});
  ctx.fillStyle="#6d806a";ctx.fillRect(0,0,size,size);
  ctx.lineWidth=1;ctx.strokeStyle="rgba(242,232,191,.13)";
  for(let i=0;i<size;i+=32){
   ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,size);
   ctx.moveTo(0,i);ctx.lineTo(size,i);ctx.stroke();
  }
  layer(ctx,key,"base");
  const calc=groundPos(loaded.versions[key].groundBasis,dx,dy,loaded.meters);
  const diff=Math.hypot(calc[0]-game[0],calc[1]-game[1]);
  if($("markers").checked){cross(ctx,[center,center],"#9ff4eb");cross(ctx,calc,"#f8da92");cross(ctx,game,"#96efb6");}
  const frame=roll?3:0;
  ctx.save();ctx.translate(...game);
  ctx.fillStyle="rgba(30,32,21,.28)";ctx.beginPath();
  ctx.ellipse(0,13,24,9.5,0,0,Math.PI*2);ctx.fill();
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(loaded.atlases[clip],frame*160,0,160,160,rect.x,rect.y,rect.w,rect.h);
  ctx.restore();
  layer(ctx,key,"roof",roof);
  ctx.fillStyle="rgba(19,31,24,.9)";ctx.fillRect(9,10,510,62);
  ctx.fillStyle="#f6e6c9";ctx.font="15px system-ui";
  ctx.fillText(key==="baseline"?"A2.24 original clay roof":"A2.26 weathered clay roof",20,33);
  ctx.font="12px system-ui";
  ctx.fillText("Game XY discrepancy: "+diff.toFixed(5)+"px · "+rect.w+"px knight",20,55);
  cv.dataset.errorPx=diff.toFixed(5);
  results[key]={groundXYErrorPx:diff,roofAlphaBounds:loaded.versions[key].roofBounds};
 }
 $("east-out").value=String(dx);
 $("south-out").value=String(dy);
 $("roof-out").value=Math.round(roof*100)+"%";
 $("status").dataset.state="ready";
 $("status").textContent="Same game XY, original 120% knight · baseline "+
  results.baseline.groundXYErrorPx.toFixed(5)+"px, refined "+
  results.refined.groundXYErrorPx.toFixed(5)+"px · roof top displacement "+
  (results.refined.roofAlphaBounds[1]-results.baseline.roofAlphaBounds[1])+"px.";
 last={ready:true,clip,dx,dy,roof,gamePoint:game,versions:results,
  originalKnightPrHead:loaded.knightHead,sourceGameZoom:ARENA_VIEW_ZOOM,
  knightDraw:rect,roofPixelComparison:loaded.roofPixelComparison,roofTopLoweredPx:
  results.refined.roofAlphaBounds[1]-results.baseline.roofAlphaBounds[1],
  roofBottomShiftPx:
  results.refined.roofAlphaBounds[3]-results.baseline.roofAlphaBounds[3],
  originalBlenderSceneModified:false,productionApproved:false,
  multiplayerRuntimeIntegrated:false,authoritativeDoorOrColliderValidated:false,
  dynamicRoofOcclusionValidated:false,knightAssetsCopiedToGraphics:false};
}
function queue(){if(!pending){pending=true;requestAnimationFrame(render);}}
for(const name of ["east","south","roof","clip","markers"])
 $(name).addEventListener("input",queue);
window.__a227Review=()=>last;
try{
 const [manifest,knights]=await Promise.all([
  read(art+"art-manifest.v1.json"),
  read(knightRoot+"asset-build-report.json")
 ]);
 if(manifest.coordinateConvention.cameraZoom!==ARENA_VIEW_ZOOM)
  throw Error("Game zoom diverged from original art");
 const m=manifest.coordinateConvention.metersPerWorldUnit;
 const door=manifest.firstSlice.approvedBuilding.door;
 const versions={},atlases={};
 for(const [key,id] of Object.entries(dirs)){
  const base=art+id+"-review/";
  const [geometry,report]=await Promise.all([
   read(art+"a222-review/greyhaven_a222_geometry_report.json"),
   read(base+(id==="a226"?"greyhaven_a226_weathering_report.json":"greyhaven_"+id+"_webp_report.json"))
  ]);
  if(geometry.sourceGameZoom!==ARENA_VIEW_ZOOM||
     geometry.productionApproved!==false||geometry.gameSourceModified!==false||
     geometry.geometry.maxGroundXYDrift!==0||geometry.sourceSceneSaved!==false||
     geometry.roofOcclusionRuntimeApproved!==false||report.productionApproved!==false||
     (key==="baseline"?report.originalGroundVerticesMovedXY!==false:report.geometrySilhouetteOrGameXYModified!==false)||
     JSON.stringify(geometry.proposedDoorGameXY)!==JSON.stringify([door.x,door.y])||
     JSON.stringify(geometry.visualDoorAnchorPixels)!=="[320,320]")
    throw Error("Source provenance/XY safety gate failed: "+key);
  const layers={};
  for(const part of ["base","roof"]){
   const l=report.layers[part],img=await decode(base+l.file);
   if(l.file!=="red_lion_"+id+"_"+part+".webp"||
      img.naturalWidth!==l.croppedPixels[0]||
      img.naturalHeight!==l.croppedPixels[1]||
      (key==="baseline" ? (!l.roundtripExactRGBA||!l.flippedIntoGamePositiveYDown) : (part==="roof"&&!report.roofLosslessRoundtripRGBA)))
    throw Error("Incorrect source Red Lion raster "+key+"/"+part);
   layers[part]={image:img,offset:l.drawOffsetFromVisualDoorPixels};
  }
  versions[key]={layers,groundBasis:geometry.groundBasisPixelsPerSourceMeter,
   roofBounds:imageAlphaBounds(layers.roof.image,layers.roof.offset)};
 }
 if(JSON.stringify(versions.baseline.groundBasis)!==
    JSON.stringify(versions.refined.groundBasis)||
    versions.refined.roofBounds[1]-versions.baseline.roofBounds[1]!==0||
    versions.refined.roofBounds[3]-versions.baseline.roofBounds[3]!==0)
  throw Error("Actual browser-baked roof alpha or ground geometry drifted");
 for(const [name,n] of Object.entries(clips)){
  const x=knights[name];if(x.frames!==n||x.outputFrameSize!==160||
    (name.endsWith("_roll")&&x.visualDurationMs!==350))
    throw Error("Approved knight animation contract changed");
  const img=await decode(knightRoot+name+".webp");
  if(img.naturalWidth!==160*n||img.naturalHeight!==1280)
    throw Error("Original knight atlas dimensions incorrect");
  atlases[name]=img;
 }
 const roofPixelComparison=compareRoofPixels(versions.baseline.layers.roof,versions.refined.layers.roof);
 if(roofPixelComparison.alphaPixelDifferences!==0||
    roofPixelComparison.changedVisiblePixels<30000||
    roofPixelComparison.changedVisiblePixels>44000)
  throw Error("A2.27 roof RGB/alpha provenance mismatch");
 loaded={meters:m,visualDoor:[door.x,door.y],versions,atlases,
  knightHead:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",roofPixelComparison};
 queue();
}catch(err){
 $("status").dataset.state="error";
 $("status").textContent="Review blocked: "+err.message;
 console.error(err);
}
