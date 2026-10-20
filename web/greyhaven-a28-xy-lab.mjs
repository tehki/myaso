// A2.8 isolated browser acceptance: imports the EXACT published combat XY formula.
// None of this code is imported by online-game.mjs or attached to game input/net.
import {ARENA_VIEW_ZOOM, projectArenaPoint} from "../src/browser/arena-viewport.mjs";

const $ = id => document.getElementById(id);
const east = $("east"), south = $("south"), roof = $("roof"), source = $("source");
const status = $("measurements");
const canvases = {calibrated: $("calibrated"), cinematic: $("cinematic")};
const art = {
  calibrated: {prefix:"../assets/environment/greyhaven/a25-review/",
    report:"greyhaven_a25_webp_report.json",key:"red_lion"},
  cinematic: {prefix:"../assets/environment/greyhaven/a26-review/",
    report:"greyhaven_a26_webp_report.json",key:"red_lion"}
};
let result = null;
let requestPending = false;
let lastDrawMs = 0;
const size = 640, center = size / 2;

const localJSON = async path => {
  const response = await fetch(new URL(path,import.meta.url),{cache:"no-store"});
  if (!response.ok) throw new Error("Review source missing: " + response.status);
  return response.json();
};
const getLayerData = (pair,name,kind) => {
  const layer = pair.layers[name];
  if (!layer) throw new Error("Missing "+kind+"/"+name+" image report");
  const filename = kind==="calibrated" ? layer.webp : layer.filename;
  const expected = "red_lion_a"+(kind==="calibrated"?"25":"26")+
    "_"+name+".webp";
  if(filename!==expected) throw new Error("Unexpected authored WebP filename");
  const dims = kind==="calibrated" ? layer.croppedPixels : layer.cropPixels;
  const offset = kind==="calibrated"
    ? layer.drawOffsetFromVisualDoorPixels : layer.drawOffsetPixelsFromVisualDoor;
  if (!Array.isArray(dims) || !Array.isArray(offset) ||
      dims.length!==2 || offset.length!==2 ||
      !dims.every(Number.isFinite) || !offset.every(Number.isFinite)) {
    throw new Error("Invalid review-pivot crop metadata");
  }
  return {file:filename,dims,offset};
};
async function loadPair(kind,meta) {
  const base=art[kind], data=meta.buildings.red_lion;
  if(!data) throw new Error("Missing Red Lion art");
  const result={};
  for(const name of ["base","roof"]){
    const layer=getLayerData(data,name,kind);
    const image=new Image();
    image.decoding="async";
    image.src=new URL(base.prefix+layer.file,import.meta.url).href;
    await image.decode();
    if (image.naturalWidth!==layer.dims[0] || image.naturalHeight!==layer.dims[1])
      throw new Error("Decoded image dimensions differ from measured bake");
    result[name]={image,offset:layer.offset};
  }
  return result;
}
function drawBackdrop(ctx){
  ctx.fillStyle="#647260";ctx.fillRect(0,0,size,size);
  ctx.lineWidth=1;ctx.strokeStyle="rgba(250,239,204,.12)";
  for(let a=0;a<=size;a+=40){
    ctx.beginPath();ctx.moveTo(a,0);ctx.lineTo(a,size);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,a);ctx.lineTo(size,a);ctx.stroke();
  }
}
function cross(ctx,x,y,color){
  ctx.strokeStyle=color;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(x-8,y);ctx.lineTo(x+8,y);
  ctx.moveTo(x,y-8);ctx.lineTo(x,y+8);ctx.stroke();
}
function reference(ctx,x,y){
  // This is a synthetic *world center/disc*, NOT an A3 knight foot sprite.
  const radius=result.fighterRadiusWorldUnits*ARENA_VIEW_ZOOM;
  ctx.fillStyle="rgba(19,27,30,.2)";
  ctx.beginPath();ctx.ellipse(x+2,y+6,radius*1.2,radius*.55,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#f59ac2";ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
  cross(ctx,x,y,"#fff4f7");
}
function draw(kind,dx,dy) {
  const cv=canvases[kind], ctx=cv.getContext("2d",{alpha:false});
  drawBackdrop(ctx);
  const pair=result[kind];
  for(const name of ["base","roof"]){
    const layer=pair[name];
    if(name==="roof"){
      ctx.save();ctx.globalAlpha=Number(roof.value)/100;
    }
    ctx.drawImage(layer.image,center+layer.offset[0],center+layer.offset[1]);
    if(name==="roof")ctx.restore();
  }
  const door=result.proposedDoor;
  const projected=projectArenaPoint(door[0]+dx,door[1]+dy,door[0],door[1],size,size);
  const metersX=dx*result.metersPerWorldUnit;
  const metersY=dy*result.metersPerWorldUnit;
  const basis=kind==="calibrated"?result.topDownBasis:result.cinematicBasis;
  const artPoint={
    x:center+basis.x[0]*metersX+basis.y[0]*metersY,
    y:center+basis.x[1]*metersX+basis.y[1]*metersY
  };
  const err=Math.hypot(artPoint.x-projected.x,artPoint.y-projected.y);
  if(source.checked) {
    ctx.beginPath();ctx.moveTo(projected.x,projected.y);
    ctx.lineTo(artPoint.x,artPoint.y);
    ctx.lineWidth=3;ctx.strokeStyle="#ffce68";ctx.stroke();
    ctx.fillStyle="#ffce68";
    ctx.beginPath();ctx.arc(artPoint.x,artPoint.y,6,0,Math.PI*2);ctx.fill();
  }
  reference(ctx,projected.x,projected.y);
  cross(ctx,center,center,"#eff4d1");
  ctx.fillStyle="rgba(13,20,19,.86)";ctx.fillRect(12,12,480,55);
  ctx.font="14px system-ui";ctx.fillStyle="#f5e8cb";
  ctx.fillText(kind==="calibrated"?"A2.5 calibrated overhead":"A2.6 cinematic 3/4",22,32);
  ctx.font="12px system-ui";ctx.fillStyle="#f8d195";
  ctx.fillText("XY vs authored point difference: "+err.toFixed(3)+" px",22,52);
  cv.dataset.errorPx=err.toFixed(3);
  cv.dataset.projectedX=projected.x.toFixed(3);
  cv.dataset.projectedY=projected.y.toFixed(3);
  return err;
}
function update(){
  requestPending=false;
  if(!result)return;
  const start=performance.now();
  const dx=Number(east.value),dy=Number(south.value);
  $("east-out").value=(dx>0?"+":"")+dx;
  $("south-out").value=(dy>0?"+":"")+dy;
  $("roof-out").value=roof.value+"%";
  const calibratedError=draw("calibrated",dx,dy);
  const cinematicError=draw("cinematic",dx,dy);
  lastDrawMs=performance.now()-start;
  status.dataset.state="ready";
  status.textContent="Game source zoom "+ARENA_VIEW_ZOOM+
    " · proposed A1 door ("+result.proposedDoor.join(", ")+")"+
    " · synthetic offset ("+dx+", "+dy+") world units"+
    " · calibrated error "+calibratedError.toFixed(3)+" px"+
    " · cinematic mismatch "+cinematicError.toFixed(3)+" px"+
    " · actor disc radius "+(result.fighterRadiusWorldUnits*ARENA_VIEW_ZOOM).toFixed(2)+
    " px (presentational reference ONLY).";
}
function schedule(){
  if(!requestPending){
    requestPending=true;
    requestAnimationFrame(update);
  }
}
for(const el of [east,south,roof,source])el.addEventListener("input",schedule);
window.__greyhavenA28Review=()=>({
  ready:status.dataset.state==="ready",
  gameZoom:ARENA_VIEW_ZOOM,
  eastWorldUnits:Number(east.value),southWorldUnits:Number(south.value),
  roofOpacity:Number(roof.value)/100,
  calibratedErrorPx:Number(canvases.calibrated.dataset.errorPx),
  cinematicErrorPx:Number(canvases.cinematic.dataset.errorPx),
  projectedX:Number(canvases.calibrated.dataset.projectedX),
  projectedY:Number(canvases.calibrated.dataset.projectedY),
  syntheticReference:true,knightFeetPivotValidated:false,
  gameIntegrated:false,portalAuthorityVerified:false,
  lastDrawMs
});
try{
  const [manifest,calibration,overhead,cinematicReport,cinematic] = await Promise.all([
    localJSON("../assets/environment/greyhaven/art-manifest.v1.json"),
    localJSON("../assets/environment/greyhaven/a25-review/greyhaven_a25_camera_report.json"),
    localJSON(art.calibrated.prefix+art.calibrated.report),
    localJSON("../assets/environment/greyhaven/a26-review/greyhaven_a26_render_report.json"),
    localJSON(art.cinematic.prefix+art.cinematic.report)
  ]);
  const proposedDoor=manifest.firstSlice.approvedBuilding.door;
  const meters=manifest.coordinateConvention.metersPerWorldUnit;
  const radius=manifest.coordinateConvention.fighterRadiusWorldUnits;
  if (manifest.coordinateConvention.cameraZoom!==ARENA_VIEW_ZOOM ||
      calibration.gameZoom!==ARENA_VIEW_ZOOM ||
      Math.abs(calibration.gamePixelsPerAuthoringMeter-ARENA_VIEW_ZOOM/meters)>.00001 ||
      calibration.productionApproved!==false ||
      cinematicReport.gameXYProjectionMatched!==false ||
      cinematic.browserRuntimeIntegrated!==false ||
      !Number.isFinite(radius) || radius<=0)
    throw new Error("Visual/source projection assumptions changed; do not trust this review");
  const c=calibration.buildings.red_lion.basis;
  const o=c.gameAlignedPixelsPerMeterXAfterFlip, p=c.gameAlignedPixelsPerMeterYAfterFlip;
  const oblique=cinematicReport.buildings.red_lion;
  const bx=oblique.blenderGroundBasisX,by=oblique.blenderGroundBasisY;
  if (![o,p,bx,by].every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(Number.isFinite)))
    throw new Error("Incomplete camera basis evidence");
  result={
    calibrated:await loadPair("calibrated",overhead),
    cinematic:await loadPair("cinematic",cinematic),
    topDownBasis:{x:o,y:p},cinematicBasis:{x:bx,y:by},
    proposedDoor:[proposedDoor.x,proposedDoor.y],
    metersPerWorldUnit:meters,
    fighterRadiusWorldUnits:radius
  };
  schedule();
}catch(error){
  console.error("A2.8 art-only preview failed",error);
  status.dataset.state="error";
  status.textContent="Cannot validate offline art inputs: "+error.message;
}