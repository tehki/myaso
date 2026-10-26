// Graphics3B artist-only 2.5D candidate, not wired into online-game, World/authority,
// building replacement allowlist, physics, Combat or public website.
import {createOriginalRedLionLiveArt} from "../src/browser/red-lion-live-art.mjs";

const status=document.querySelector("#status");
const moodInput=document.querySelector("#mood");
const left=document.querySelector("#original");
const right=document.querySelector("#comparison");
const allowed=(location.hostname==="localhost"||location.hostname==="127.0.0.1")
  &&new URLSearchParams(location.search).get("quaterniusReview")==="1";
const sourceBase="../.artifacts/quaternius-greyhaven-sprite-review/";
function fail(message){status.textContent="ART REVIEW BLOCKED: "+message;status.style.color="#ff9d86"}
function loadImage(url){return new Promise((ok,bad)=>{
 const image=new Image();image.onload=()=>ok(image);
 image.onerror=()=>bad(Error("missing genuine Blender output "+url));image.src=url;
});}
if(!allowed)fail("requires localhost and explicit ?quaterniusReview=1");
else try{
 const manifest=await (await fetch(sourceBase+"greyhaven-quaternius-2d5-review-manifest.json",{cache:"no-store"})).json();
 if(manifest.kind!=="graphics3b-quaternius-real-blender-v2-review-2d5" ||
    manifest.placedInWorld9!==false||manifest.serverAuthorized!==false||
    manifest.noChangedRedLion!==true||manifest.sourceCreatorArchiveMirrorParityVerified!==false||
    manifest.realQuaterniusDoorFrameWorldBoundsVerified!==true||
    !(manifest.doorFrameCenterOffsetMeters>=0&&manifest.doorFrameCenterOffsetMeters<=0.015)||
    manifest.cameraReview?.projection!=="ORTHO"||
    JSON.stringify(manifest.cameraReview?.position)!=="[3,-12,17]"||
    JSON.stringify(manifest.cameraReview?.target)!=="[0,0,2.8]"||
    manifest.cameraReview?.orthoScale!==12.8||
    manifest.cameraReview?.liveWorld9CameraChanged!==false||
    manifest.duskWindowAndDoorGlassFromGenuineBlender!==true||
    manifest.duskProceduralSmokeFromSourceChimney!==true||
    manifest.chimneySmokeAnimatedInGame!==false||
    manifest.realSourcePBRGableInfillInBlender!==true||
    manifest.gableTimberBraceCount!==3||
    manifest.gablePlainPlasterNoUVTexture!==true||
    manifest.gableSourcePlasterUnchanged!==true||
    manifest.gableCenterPostRemoved!==true||
    manifest.gableSourceMatchedWeathered!==true||
    manifest.gableNoDarkApexAtlasStain!==true||
    !(manifest.gableApexSeamExtendedMeters>=0.14&&manifest.gableApexSeamExtendedMeters<=0.20)||
    manifest.gableWeatheringWorldScale!==9.5||
    manifest.gableApexHiddenTipRiseMeters!==0.17||
    manifest.gableApexHiddenTipForwardMeters!==0.035||
    manifest.originalRoofAndWallMeshesUnchanged!==true)
   throw Error("not an isolated approved-comparison-only sprite manifest");
 const images={},imageInfo={};
 for(const key of ["day","dusk"]){
  const info=manifest.images[key];
  if(!info||!new RegExp("^greyhaven-quaternius-cottage-"+key+"-2d5-review\\.webp$").test(info.name)
     ||info.width!==640||info.height!==640)throw Error("review sprite manifest mismatch");
  images[key]=await loadImage(sourceBase+info.name);
  imageInfo[key]=info;
  if(images[key].naturalWidth!==640||images[key].naturalHeight!==640)
   throw Error("real Blender review frame did not decode");
 }
 const art=createOriginalRedLionLiveArt();
 if(!await art.load()||art.state().phase!=="ready")
  throw Error("exact original Red Lion and frozen roof source verification failed: "+art.state().failure);
 const camera={x:4365,y:4075},w=960,h=540,z=.84;
 function paint(){
  const mood=moodInput.value,frame=art.prepare(camera,w,h,z,mood);
  if(!frame)throw Error("World9/3C source frame unavailable");
  for(const canvas of [left,right]){
   const ctx=canvas.getContext("2d");
   ctx.clearRect(0,0,w,h);
   ctx.drawImage(frame.world,0,0);
   ctx.drawImage(frame.facade,0,0);
  }
  const c=right.getContext("2d");
  c.fillStyle="rgba(11,18,15,.93)";
  c.fillRect(680,136,260,300);
  c.strokeStyle="#b6a07e";c.lineWidth=2;c.strokeRect(680,136,260,300);
  // Screen-space editorial comparison ONLY: no world coordinate, map entry or physics.
  // Crop transparent margins and match visible cottage height to the
  // original 228x297 Red Lion facade at the same 0.84 review zoom.
  // This is an editorial comparison only; sprite source pixels remain unchanged.
  const [sx,sy,sw,sh]=imageInfo[mood].alphaBoundingBox;
  const scale=Math.min(230/sw,249/sh);
  const dw=sw*scale,dh=sh*scale;
  c.drawImage(images[mood],sx,sy,sw,sh,810-dw/2,267-dh/2,dw,dh);
  c.fillStyle="#f4e2c1";c.font="bold 15px system-ui";
  c.textAlign="center";c.fillText("COTTAGE / HEIGHT-MATCHED",810,411);
  status.textContent="Original World9 / 3C / Red Lion source validated. "+
    "Quaternius front-gable, height-matched art candidate: "+mood+
    ". Never mapped, placed, collided, or admitted as a live building.";
 }
 moodInput.addEventListener("change",()=>{try{paint()}catch(e){fail(String(e))}});
 paint();
}catch(e){fail(String(e))}
