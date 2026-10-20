// A2.10 visual-only canvas size comparison; NOT imported by multiplayer.
// Companions loaded from pinned, independent PR #326 checkout through localhost QA.
const $=id=>document.getElementById(id);
const status=$("status");
const specs=Object.freeze([
 {key:"baseline",factor:1}, {key:"moderate",factor:1.125},
 {key:"larger",factor:1.2}
]);
const sourceClipFrames=Object.freeze({silver_idle:4,silver_roll:8,t1_roll:8});
const BASE=Object.freeze({
 idle:{width:80,height:80,dx:-40,dy:-52},
 roll:{width:112,height:112,dx:-56,dy:-65}
});
const knightPrefix="/__a29_knights__/";
const buildingPrefix="../assets/environment/greyhaven/a26-review/";
const testPlacement=Object.freeze({x:65,y:38}); // same non-authoritative offset in all cases
let loaded=null, frameData={}, renderMs=0, pending=false;

async function jsonAt(url) {
 const r=await fetch(new URL(url,import.meta.url),{cache:"no-store"});
 if(!r.ok)throw Error("HTTP "+r.status()+" "+url);
 return r.json();
}
async function imgAt(url) {
 const img=new Image();img.decoding="async";
 img.src=new URL(url,import.meta.url).href;
 await img.decode();return img;
}
function chosen(){
 const clip=$("clip").value;
 if(!Object.hasOwn(sourceClipFrames,clip))throw Error("Unknown atlas clip");
 const direction=Number($("direction").value);
 const frame=Number($("frame").value);
 if(![0,2,4,6].includes(direction)||frame<0||frame>=sourceClipFrames[clip])
   throw Error("Atlas frame outside validated grid");
 return {clip,direction,frame,isRoll:clip.endsWith("_roll")};
}
function opaqueFrameBounds(img,x,y) {
 const temp=document.createElement("canvas");temp.width=temp.height=160;
 const ct=temp.getContext("2d",{willReadFrequently:true});
 ct.drawImage(img,x,y,160,160,0,0,160,160);
 const d=ct.getImageData(0,0,160,160).data;
 let left=160,top=160,right=-1,bottom=-1,pixels=0;
 for(let iy=0;iy<160;iy++)for(let ix=0;ix<160;ix++){
   if(d[(iy*160+ix)*4+3]<32)continue;
   left=Math.min(left,ix);top=Math.min(top,iy);
   right=Math.max(right,ix);bottom=Math.max(bottom,iy);pixels++;
 }
 if(pixels<100)throw Error("Empty source sprite frame");
 return {left,top,right,bottom,pixels};
}
function clear(ctx) {
 ctx.fillStyle="#586b5a";ctx.fillRect(0,0,640,640);
 ctx.strokeStyle="rgba(236,229,203,.12)";ctx.lineWidth=1;
 for(let n=0;n<=640;n+=32){
   ctx.beginPath();ctx.moveTo(n,0);ctx.lineTo(n,640);ctx.stroke();
   ctx.beginPath();ctx.moveTo(0,n);ctx.lineTo(640,n);ctx.stroke();
 }
}
function cross(ctx,x,y){
 ctx.strokeStyle="#ffd885";ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);
 ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();
}
function render(){
 pending=false;if(!loaded)return;
 const start=performance.now();
 const {clip,direction,frame,isRoll}=chosen();
 const img=loaded.atlases[clip];
 const sx=frame*160,sy=direction*160;
 const opaque=opaqueFrameBounds(img,sx,sy);
 const baseline=BASE[isRoll?"roll":"idle"];
 for(const spec of specs){
   const ctx=$(spec.key).getContext("2d",{alpha:false});
   clear(ctx);
   for(const layerName of ["base","roof"]){
     if(layerName==="roof")continue;
     const layer=loaded.layers[layerName];
     ctx.drawImage(layer.image,320+layer.drawOffset[0],320+layer.drawOffset[1]);
   }
   const scale=spec.factor;
   const width=Math.round(baseline.width*scale);
   const height=Math.round(baseline.height*scale);
   // Keep the same PR #326 fighter WORLD CENTER, and scale its presentation
   // offset with size. No changes to game-world positions or collision.
   const offsetX=baseline.dx*scale;
   const offsetY=baseline.dy*scale;
   const px=320+testPlacement.x, py=320+testPlacement.y;
   ctx.fillStyle="rgba(49,38,28,.45)";
   ctx.beginPath();ctx.ellipse(px,py+11,20,8,0,0,Math.PI*2);ctx.fill();
   ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
   ctx.drawImage(img,sx,sy,160,160,px+offsetX,py+offsetY,width,height);
   const roof=loaded.layers.roof;
   ctx.save();ctx.globalAlpha=Number($("roof").value)/100;
   ctx.drawImage(roof.image,320+roof.drawOffset[0],320+roof.drawOffset[1]);
   ctx.restore();
   if($("origin").checked) {
     cross(ctx,320,320);
     cross(ctx,px,py);
   }
   ctx.fillStyle="rgba(22,30,22,.88)";
   ctx.fillRect(10,11,407,58);
   ctx.fillStyle="#f9e5c6";ctx.font="15px system-ui";
   ctx.fillText(spec.key+" · "+Math.round(scale*1000)/10+"% knight",20,32);
   ctx.font="12px system-ui";ctx.fillStyle="#e3d0ad";
   ctx.fillText("The SAME Red Lion, camera, world-origin proxy and frame",20,53);
   const bottomOffset=offsetY+(opaque.bottom+1)*height/160;
   const spriteHeight=(opaque.bottom-opaque.top+1)*height/160;
   frameData[spec.key]={
     scale,clip,direction,frame,width,height,
     drawOffset:[Number(offsetX.toFixed(3)),Number(offsetY.toFixed(3))],
     silhouetteHeightPx:Number(spriteHeight.toFixed(3)),
     silhouetteBottomFromCenterPx:Number(bottomOffset.toFixed(3)),
     authoredDoorHeightPx:loaded.doorHeight,
     silhouetteToProjectedDoorHeightRatio:Number((spriteHeight/loaded.doorHeight).toFixed(4)),
     sourceFrameAlphaBounds:opaque,
     artistPivotOnly:true,rigFootContactValidated:false,
     gameRendererChanged:false
   };
   $(spec.key+"-info").textContent=
    width+"×"+height+" canvas px · visible silhouette "+
    spriteHeight.toFixed(1)+"px ("+
    (spriteHeight/loaded.doorHeight*100).toFixed(1)+"% of Blender door bounds)";
 }
 renderMs=performance.now()-start;
 $("frame-num").value=(frame+1)+"/"+sourceClipFrames[clip];
 $("roof-num").value=$("roof").value+"%";
 status.dataset.state="ready";
 status.textContent="Red Lion door mesh projected height: "+loaded.doorHeight.toFixed(1)+
 "px in the 3/4 review · same source atlas frame in 3 independent scales."+
 " Character feet, combat scale and 3/4 world XY remain unvalidated.";
}
function request(){
 if(!pending){pending=true;requestAnimationFrame(render);}
}
for(const id of ["direction","frame","roof","origin"])$(id).addEventListener("input",request);
$("clip").addEventListener("change",()=>{
 $("frame").max=String(sourceClipFrames[$("clip").value]-1);
 $("frame").value="0";request();
});
window.__a210ScaleReview=()=>({
 state:status.dataset.state,
 options:{...frameData},
 clip:$("clip").value,direction:Number($("direction").value),
 frame:Number($("frame").value),roofOpacity:Number($("roof").value)/100,
 doorHeightPx:loaded?.doorHeight??null,
 atlasIsActualPr326:Boolean(loaded),
 gameScaleChanged:false,physicsChanged:false,
 anatomicalFeetValidated:false,
 multiplayerFPSMeasured:false,
 browserGameXYAligned:false,
 drawMs:renderMs
});
try {
 const [artReport,atlasReport,door]=await Promise.all([
   jsonAt(buildingPrefix+"greyhaven_a26_webp_report.json"),
   jsonAt(knightPrefix+"asset-build-report.json"),
   jsonAt("../assets/environment/greyhaven/a210-review/greyhaven_a210_door_measurement.json")
 ]);
 if(artReport.browserRuntimeIntegrated!==false ||
    artReport.browserGameXYAligned!==false||
    artReport.productionApproved!==false||
    door.productionSpriteScaleApproved!==false||
    door.gameplayModified!==false)
     throw Error("Source graphics reports cannot authorize runtime use");
 const layers={};
 for(const kind of ["base","roof"]){
   const entry=artReport.buildings.red_lion.layers[kind];
   if(entry.filename!=="red_lion_a26_"+kind+".webp"||
      entry.visiblePixelRoundtrip!==true)throw Error("Unverified roof or wall input");
   const image=await imgAt(buildingPrefix+entry.filename);
   if(image.naturalWidth!==entry.cropPixels[0] ||
      image.naturalHeight!==entry.cropPixels[1])throw Error("Wrong Red Lion atlas crop");
   layers[kind]={image,drawOffset:entry.drawOffsetPixelsFromVisualDoor};
 }
 const atlases={};
 for(const [name,count] of Object.entries(sourceClipFrames)){
   const data=atlasReport[name];
   if(data.frames!==count||data.outputFrameSize!==160||
     (name.endsWith("_roll")&&data.visualDurationMs!==350))
     throw Error("PR #326 companion manifest version differs");
   const image=await imgAt(knightPrefix+name+".webp");
   if(image.naturalWidth!==count*160||image.naturalHeight!==8*160)
     throw Error("Unexpected knight atlas dimensions");
   atlases[name]=image;
 }
 const doorHeight=door.projectedDoorBoundingHeightPx;
 if(!Number.isFinite(doorHeight)||doorHeight<=20||doorHeight>230)
   throw Error("Missing measured Blender door bounds");
 loaded={layers,atlases,doorHeight};
 request();
}catch(error){
 status.dataset.state="error";
 status.textContent="Unmerged companion review not available: "+error.message;
 console.warn("A2.10 isolated review",error.message);
}