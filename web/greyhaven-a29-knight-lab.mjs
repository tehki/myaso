// A2.9: browser-only source-art inspection. Not imported by the online game.
// PR #326 atlas is supplied only by the offline localhost acceptance harness.
// Draw offsets match web/knight-sprites.mjs at PR #326 head c0b08a2.
const $ = id => document.getElementById(id);
const scene = $("scene"), detail = $("detail"), result = $("result");
const clipControl = $("clip"), directionControl = $("direction");
const frameControl = $("frame"), roofControl = $("roof");
const roofFront = $("roof-front"), originControl = $("origin");
const allowed = Object.freeze({silver_idle:4,silver_roll:8,t1_roll:8});
const KNIGHT_FRAME_PX=160;
const KNIGHT_DRAW=Object.freeze({
  idle:{x:-40,y:-52,width:80,height:80},
  roll:{x:-56,y:-65,width:112,height:112}
});
const artBase="../assets/environment/greyhaven/a26-review/";
const companion="/__a29_knights__/";
let loaded=null, drawDuration=0, lastReadout=null;
let requested=false;
async function readJSON(url) {
  const response=await fetch(new URL(url,import.meta.url),{cache:"no-store"});
  if(!response.ok)throw new Error("HTTP "+response.status()+" for "+url);
  return response.json();
}
async function loadImage(url) {
  const img=new Image();
  img.decoding="async";
  img.src=new URL(url,import.meta.url).href;
  await img.decode();
  return img;
}
function cloneLayer(entry,name){
  const expected="red_lion_a26_"+name+".webp";
  if(entry.filename!==expected || entry.visiblePixelRoundtrip!==true) {
    throw new Error("Red Lion roof/base provenance unexpected");
  }
  return {name,offset:entry.drawOffsetPixelsFromVisualDoor,
    dimensions:entry.cropPixels, filename:entry.filename};
}
async function setup(){
  try{
    const [report,manifest]=await Promise.all([
      readJSON(artBase+"greyhaven_a26_webp_report.json"),
      readJSON(companion+"asset-build-report.json")
    ]);
    if(report.browserGameXYAligned!==false || report.browserRuntimeIntegrated!==false
       || report.productionApproved!==false)throw Error("Unexpected A2.6 deployment flags");
    const b=report.buildings.red_lion;
    const layers={};
    for(const name of ["base","roof"]){
      layers[name]=cloneLayer(b.layers[name],name);
      layers[name].image=await loadImage(artBase+layers[name].filename);
      if(layers[name].image.naturalWidth!==layers[name].dimensions[0] ||
         layers[name].image.naturalHeight!==layers[name].dimensions[1])
        throw new Error("Invalid decoded building layer dimensions");
    }
    const sprites={};
    for(const [name,frames] of Object.entries(allowed)){
      if(manifest[name]?.frames!==frames ||
         manifest[name]?.outputFrameSize!==KNIGHT_FRAME_PX ||
         (name.endsWith("_roll")&&manifest[name]?.visualDurationMs!==350))
        throw new Error("Companion knight atlas does not match PR #326 source contract");
      const image=await loadImage(companion+name+".webp");
      if(image.naturalWidth!==frames*KNIGHT_FRAME_PX ||
         image.naturalHeight!==8*KNIGHT_FRAME_PX)
        throw new Error("Companion atlas layout does not match 8-direction frame grid");
      sprites[name]=image;
    }
    loaded={layers,sprites,manifest};
    result.dataset.state="ready";
    schedule();
  }catch(error){
    result.dataset.state="error";
    result.textContent="Companion art preview unavailable: "+error.message+
      ". Use the local A2.9 harness with a separate checkout of PR #326.";
    console.warn("A2.9 companion art check",error.message);
  }
}
function grid(ctx,w,h) {
  ctx.fillStyle="#5a6b60";ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="rgba(239,231,196,.1)";ctx.lineWidth=1;
  for(let x=0;x<=w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=0;y<=h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
}
function drawLayer(ctx,name) {
  const layer=loaded.layers[name];
  ctx.drawImage(layer.image,320+layer.offset[0],320+layer.offset[1]);
}
function boxForSelected() {
  const name=clipControl.value;
  if(!Object.hasOwn(allowed,name))throw Error("Unapproved clip");
  return KNIGHT_DRAW[name.endsWith("_roll")?"roll":"idle"];
}
function opaqueBounds(image,sx,sy) {
  const work=document.createElement("canvas");
  work.width=work.height=KNIGHT_FRAME_PX;
  const ctx=work.getContext("2d",{willReadFrequently:true});
  ctx.clearRect(0,0,160,160);
  ctx.drawImage(image,sx,sy,160,160,0,0,160,160);
  const {data}=ctx.getImageData(0,0,160,160);
  let minX=160,minY=160,maxX=-1,maxY=-1,n=0;
  for(let y=0;y<160;y++){
    for(let x=0;x<160;x++){
      if(data[(y*160+x)*4+3]<32)continue;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);n++;
    }
  }
  if(n<100)throw Error("Atlas frame unexpectedly empty");
  return {left:minX,top:minY,right:maxX,bottom:maxY,pixels:n};
}
function drawKnight(ctx,x,y,box,img,sx,sy) {
  // Shadow and frame/presentation sizing copied from PR #326.
  ctx.fillStyle="rgba(49,38,28,.45)";
  ctx.beginPath();ctx.ellipse(x,y+11,20,8,0,0,Math.PI*2);ctx.fill();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(img,sx,sy,160,160,
    x+box.x,y+box.y,box.width,box.height);
}
function cross(ctx,x,y,color){
  ctx.strokeStyle=color;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x-10,y);ctx.lineTo(x+10,y);
  ctx.moveTo(x,y-10);ctx.lineTo(x,y+10);ctx.stroke();
}
function showDetail(img,sx,sy,bounds,box,screenBottom) {
  const ctx=detail.getContext("2d",{alpha:false});
  grid(ctx,400,400);
  const scale=2, offsetX=40,offsetY=20;
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(img,sx,sy,160,160,offsetX,offsetY,320,320);
  const boundBottomY=offsetY+(bounds.bottom+1)*scale;
  ctx.strokeStyle="#ffdc7f";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(offsetX,boundBottomY);
  ctx.lineTo(offsetX+320,boundBottomY);ctx.stroke();
  // Draw the world-space fighter origin, in source-frame units.
  const sourceOriginY=(-box.y)/box.height*160;
  const originY=offsetY+sourceOriginY*scale;
  ctx.strokeStyle="#fd9cb5";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(offsetX,originY);
  ctx.lineTo(offsetX+320,originY);ctx.stroke();
  ctx.fillStyle="#14211c";ctx.fillRect(8,347,385,45);
  ctx.fillStyle="#f3e6cb";ctx.font="13px system-ui";
  ctx.fillText("Yellow = silhouette pixel floor; pink = world center",14,367);
  ctx.fillText("Bottommost alpha proxy from center: "+screenBottom.toFixed(2)+" px",14,384);
}
function render(){
  requested=false;if(!loaded)return;
  const began=performance.now();
  const name=clipControl.value,dir=Number(directionControl.value);
  const frames=allowed[name],frame=Number(frameControl.value);
  if(!frames||dir<0||dir>7||frame<0||frame>=frames)return;
  const box=boxForSelected();
  const image=loaded.sprites[name],sx=frame*160,sy=dir*160;
  const bounds=opaqueBounds(image,sx,sy);
  const proxyBottom=box.y+(bounds.bottom+1)*box.height/160;
  const ctx=scene.getContext("2d",{alpha:false});
  grid(ctx,640,640);
  drawLayer(ctx,"base");
  if(roofFront.checked){
    drawKnight(ctx,320,320,box,image,sx,sy);
    ctx.save();ctx.globalAlpha=Number(roofControl.value)/100;
    drawLayer(ctx,"roof");ctx.restore();
  }else{
    ctx.save();ctx.globalAlpha=Number(roofControl.value)/100;
    drawLayer(ctx,"roof");ctx.restore();
    drawKnight(ctx,320,320,box,image,sx,sy);
  }
  if(originControl.checked)cross(ctx,320,320,"#ed84a4");
  ctx.fillStyle="rgba(15,22,17,.88)";
  ctx.fillRect(14,13,515,55);
  ctx.fillStyle="#f5e7c6";ctx.font="14px system-ui";
  ctx.fillText("Real PR #326 knight atlas — "+name+" / "+dir+" / frame "+frame,22,34);
  ctx.font="12px system-ui";ctx.fillStyle="#efcc9c";
  ctx.fillText("A2.6 visual doorway reference ≠ multiplayer portal / knight foot",22,53);
  showDetail(image,sx,sy,bounds,box,proxyBottom);
  $("frame-value").value=(frame+1)+" / "+frames;
  $("roof-value").value=roofControl.value+"%";
  drawDuration=performance.now()-began;
  lastReadout={
    clip:name,directionIndex:dir,frame,frames,renderWidth:box.width,
    renderHeight:box.height,drawOffset:[box.x,box.y],
    silhouetteAlphaBounds:bounds,silhouetteBottomFromOriginPx:proxyBottom,
    roofOpacity:Number(roofControl.value)/100,
    roofOverActor:roofFront.checked,renderMs:drawDuration,
    source:"companion PR #326 actual atlas",
    originKind:"world-center, NOT anatomically verified foot",
    anatomicalFootPivotVerified:false,gameIntegrated:false
  };
  result.textContent="Real A3 sprite: "+name+" · facing "+dir+" · frame "+(frame+1)+
    "/"+frames+" · opaque silhouette bottom "+proxyBottom.toFixed(2)+
    " px relative to fighter origin · roof "+roofControl.value+
    "% · visual art-only comparison; foot joint contact is UNVERIFIED.";
}
function schedule(){
  if(!requested){requested=true;requestAnimationFrame(render);}
}
for(const control of [directionControl,frameControl,roofControl,roofFront,originControl])
  control.addEventListener("input",schedule);
clipControl.addEventListener("change",()=>{
  frameControl.max=String(allowed[clipControl.value]-1);
  frameControl.value="0";
  schedule();
});
window.__a29KnightReview=()=>({
  state:result.dataset.state,
  ...lastReadout,
  realAtlasLoaded:Boolean(loaded),
  version:"A2.9",
  sourceAssetsCommittedToGraphicsPR:false,
  browserGameXYAligned:false,
  authoritativePortalVerified:false,
  actualMultiplayerFPSMeasured:false
});
setup();