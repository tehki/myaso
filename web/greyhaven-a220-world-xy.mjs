// A2.20: actual 120%-scale PR #326 knight atlas on game projection.
// This review is NEVER imported by the game, never changes world authority.
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const $=id=>document.getElementById(id);
const center=320,side=640,sourceFrame=160,companion="/__a220_knights__/";
const artRoot="../assets/environment/greyhaven/";
const configs={
 playable:{path:"a25-review/",meta:"greyhaven_a25_webp_report.json"},
 cinematic:{path:"a26-review/",meta:"greyhaven_a26_webp_report.json"}
};
const clips={silver_idle:4,silver_roll:8,t1_roll:8};
const rect={idle:{w:96,h:96,x:-48,y:-62.4},roll:{w:134,h:134,x:-67,y:-78}};
let loaded=null,rendered=null,queued=false;
const getJson=async path=>{
 const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});
 if(!r.ok)throw Error("HTTP "+r.status+" "+path);
 return r.json();
};
async function decode(path){
 const image=new Image();image.decoding="async";
 image.src=new URL(path,import.meta.url).href;
 await image.decode();
 return image;
}
function drawBG(ctx){
 ctx.fillStyle="#5f705f";ctx.fillRect(0,0,side,side);
 ctx.lineWidth=1;ctx.strokeStyle="rgba(244,235,197,.11)";
 for(let x=0;x<=side;x+=32){
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,side);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,x);ctx.lineTo(side,x);ctx.stroke();
 }
}
function line(ctx,a,b,color){
 ctx.strokeStyle=color;ctx.lineWidth=2.4;ctx.beginPath();
 ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
}
function cross(ctx,p,color){
 const [x,y]=p;line(ctx,[x-7,y],[x+7,y],color);
 line(ctx,[x,y-7],[x,y+7],color);
}
function buildingLayer(ctx,mode,key,alpha=1){
 const layer=loaded[mode].layers[key];
 ctx.save();ctx.globalAlpha=alpha;
 ctx.drawImage(layer.image,center+layer.offset[0],center+layer.offset[1]);
 ctx.restore();
}
function drawActor(ctx,x,y,clip){
 const atlas=loaded.atlases[clip];
 const roll=clip.endsWith("_roll");
 const dest=rect[roll?"roll":"idle"];
 const frame=roll?3:0,dir=0;
 ctx.save();ctx.translate(x,y);
 ctx.fillStyle="rgba(35,33,27,.3)";
 ctx.beginPath();ctx.ellipse(0,11*1.2,24,9.6,0,0,Math.PI*2);ctx.fill();
 ctx.imageSmoothingQuality="high";
 ctx.drawImage(atlas,frame*160,dir*160,160,160,dest.x,dest.y,dest.w,dest.h);
 ctx.restore();
 return dest;
}
function basisAt(basis,dx,dy,meters){
 return [center+(basis.x[0]*dx+basis.y[0]*dy)*meters,
 center+(basis.x[1]*dx+basis.y[1]*dy)*meters];
}
function render(){
 queued=false;if(!loaded)return;
 const dx=Number($("east").value),dy=Number($("south").value);
 const clip=$("pose").value,roof=Number($("roof").value)/100;
 if(!Object.hasOwn(clips,clip))throw Error("Unrecognized knight frame");
 const proposed=loaded.proposed;
 const actor=projectArenaPoint(proposed[0]+dx,proposed[1]+dy,
                               proposed[0],proposed[1],side,side);
 const game=[actor.x,actor.y];
 const before=[center,center];
 const candidate=basisAt(loaded.playable.basis,dx,dy,loaded.meters);
 const oblique=basisAt(loaded.cinematic.basis,dx,dy,loaded.meters);
 const playableError=Math.hypot(candidate[0]-game[0],candidate[1]-game[1]);
 const cinematicError=Math.hypot(oblique[0]-game[0],oblique[1]-game[1]);
 const checked=$("vectors").checked;
 for(const mode of ["playable","cinematic"]){
  const cv=$(mode),ctx=cv.getContext("2d",{alpha:false});
  drawBG(ctx);
  buildingLayer(ctx,mode,"base");
  const path=mode==="playable"?candidate:oblique;
  if(checked){
   line(ctx,before,game,"#f5d5ab");
   line(ctx,game,path,mode==="playable"?"#90edbf":"#ffc270");
   cross(ctx,path,mode==="playable"?"#90edbf":"#ffc270");
   cross(ctx,before,"#b3eff5");
  }
  const dest=drawActor(ctx,game[0],game[1],clip);
  buildingLayer(ctx,mode,"roof",roof);
  ctx.fillStyle="rgba(24,34,24,.92)";ctx.fillRect(10,10,480,62);
  ctx.fillStyle="#fff0ce";ctx.font="15px system-ui";
  ctx.fillText(mode==="playable"?"Calibrated game-XY candidate":"Cinematic 3/4 — not XY-compatible",20,32);
  ctx.font="12px system-ui";ctx.fillStyle="#ffe0ae";
  ctx.fillText("Ground XY mismatch: "+(mode==="playable"?playableError:cinematicError).toFixed(3)+
    " px · knight "+dest.w+"px",20,54);
  cv.dataset.errorPx=(mode==="playable"?playableError:cinematicError).toFixed(4);
 }
 $("east-out").value=String(dx);
 $("south-out").value=String(dy);
 $("roof-out").value=Math.round(roof*100)+"%";
 $("status").dataset.state="ready";
 $("status").textContent="Same original source atlas frame · approved 120% knight · "+
  "offset ("+dx+", "+dy+") game units · overhead discrepancy "+playableError.toFixed(3)+
  " px · cinematic discrepancy "+cinematicError.toFixed(3)+
  " px. Proposed door remains nonauthoritative.";
 rendered={ready:true,clip,dx,dy,roof,sourceKnightPrHead:loaded.knightHead,
  sourceGraphicPrHead:loaded.graphicsHead,sourceGameZoom:ARENA_VIEW_ZOOM,
  gamePoint:game,authoredOverheadPoint:candidate,authoredCinematicPoint:oblique,
  overheadErrorPx:playableError,cinematicErrorPx:cinematicError,
  knightDraw:rect[clip.endsWith("_roll")?"roll":"idle"],
  roofAlpha:roof,activePortalValidated:false,gameRuntimeModified:false,
  worldAuthorityChanged:false,knightSourceAssetsCopied:false,
  correctedThreeQuarterCamera:false,liveMultiplayerValidated:false};
}
function queue(){if(!queued){queued=true;requestAnimationFrame(render);}}
for(const name of ["east","south","roof","pose","vectors"])
 $(name).addEventListener("input",queue);
window.__a220WorldXY=()=>rendered;
try{
 const [manifest,camera,overhead,cinematicMeta,cinematic,knights]=await Promise.all([
  getJson(artRoot+"art-manifest.v1.json"),
  getJson(artRoot+"a25-review/greyhaven_a25_camera_report.json"),
  getJson(artRoot+"a25-review/greyhaven_a25_webp_report.json"),
  getJson(artRoot+"a26-review/greyhaven_a26_render_report.json"),
  getJson(artRoot+"a26-review/greyhaven_a26_webp_report.json"),
  getJson(companion+"asset-build-report.json")
 ]);
 const meters=manifest.coordinateConvention.metersPerWorldUnit;
 const door=manifest.firstSlice.approvedBuilding.door;
 if(manifest.coordinateConvention.cameraZoom!==ARENA_VIEW_ZOOM||
    camera.gameZoom!==ARENA_VIEW_ZOOM||
    camera.productionApproved!==false||
    cinematicMeta.gameXYProjectionMatched!==false||
    overhead.productionApproved!==false||
    cinematic.browserGameXYAligned!==false||
    cinematic.browserRuntimeIntegrated!==false||
    cinematic.productionApproved!==false||
    !Number.isFinite(meters)||meters<=0)
   throw Error("Game-camera and art gate diverged; review not credible");
 const available={playable:overhead,cinematic};
 const data={proposed:[door.x,door.y],meters,atlases:{},
  knightHead:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef",
  graphicsHead:"a9f188c31ea671120e05ed5e61e8c8a7b63745cb"};
 for(const mode of ["playable","cinematic"]){
  const entries=available[mode].buildings.red_lion.layers;
  const layers={};
  for(const kind of ["base","roof"]){
   const entry=entries[kind];
   const filename=mode==="playable"?entry.webp:entry.filename;
   const dimensions=mode==="playable"?entry.croppedPixels:entry.cropPixels;
   const offset=mode==="playable"?entry.drawOffsetFromVisualDoorPixels:
     entry.drawOffsetPixelsFromVisualDoor;
   if(filename!=="red_lion_"+(mode==="playable"?"a25":"a26")+"_"+kind+".webp" ||
      !Array.isArray(offset)||offset.length!==2||!offset.every(Number.isFinite))
     throw Error("Greyhaven WebP provenance mismatch");
   const image=await decode(artRoot+configs[mode].path+filename);
   if(image.naturalWidth!==dimensions[0]||image.naturalHeight!==dimensions[1])
     throw Error("Wrong native building bake pixels");
   layers[kind]={image,offset};
  }
  const b=mode==="playable"?
   camera.buildings.red_lion.basis:cinematicMeta.buildings.red_lion;
  const x=mode==="playable"?b.gameAlignedPixelsPerMeterXAfterFlip:b.blenderGroundBasisX;
  const y=mode==="playable"?b.gameAlignedPixelsPerMeterYAfterFlip:b.blenderGroundBasisY;
  if(![x,y].every(v=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)))
   throw Error("Missing measured world XY basis");
  data[mode]={layers,basis:{x,y}};
 }
 for(const [clip,frames] of Object.entries(clips)){
  const record=knights[clip];
  if(record.frames!==frames||record.outputFrameSize!==160||
     (clip.endsWith("_roll")&&record.visualDurationMs!==350))
    throw Error("Real knight atlas contract changed");
  const image=await decode(companion+clip+".webp");
  if(image.naturalWidth!==frames*160||image.naturalHeight!==8*160)
    throw Error("Incorrect original knight atlas image");
  data.atlases[clip]=image;
 }
 loaded=data;queue();
}catch(error){
 $("status").dataset.state="error";
 $("status").textContent="Art-only integration preview blocked: "+error.message;
 console.warn("A2.20 preview",error);
}
