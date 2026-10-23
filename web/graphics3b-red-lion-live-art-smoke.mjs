import {createOriginalRedLionLiveArt,redLionActorHudVisible} from "../src/browser/red-lion-live-art.mjs";
import {createAuthoredWorldRenderer} from "../src/browser/authored-world-renderer.mjs";
import {MAP_IDS} from "../src/world/authored-maps.mjs";
const w=640,h=640,z=.84;
const pan=new URLSearchParams(location.search).get("mode")==="pan";
const camera=pan?{x:4465,y:4115}:{x:4365,y:4075};
const result=document.querySelector("#status");
window.__graphics3bLiveArtSmoke=null;
try{
 const before=document.getElementById("baseline").getContext("2d",{willReadFrequently:true});
 before.save();before.translate(w/2,h/2);before.scale(z,z);before.translate(-w/2,-h/2);
 // Compare like-for-like: actual live default and detailed World caches share
 // the same canonical three-tile warm-up budget (not 8 vs 3).
 const defaultWorld=createAuthoredWorldRenderer();
 defaultWorld.draw(before,MAP_IDS.overworld,camera,w,h,z);
 before.restore();
 const art=createOriginalRedLionLiveArt();
 const ok=await art.load();
 const after=document.getElementById("composed").getContext("2d",{willReadFrequently:true});
 let frame=null;
 if(ok)frame=art.prepare(camera,w,h,z);
 if(frame){
  after.drawImage(frame.world,0,0);
  after.drawImage(frame.facade,0,0);
 }else{
  after.drawImage(document.getElementById("baseline"),0,0);
 }
 const aa=before.getImageData(0,0,w,h).data;
 const bb=after.getImageData(0,0,w,h).data;
 let changed=0,changedAlpha=0;
 for(let i=0;i<aa.length;i+=4){
  if(aa[i]!==bb[i]||aa[i+1]!==bb[i+1]||aa[i+2]!==bb[i+2])changed++;
  if(aa[i+3]!==bb[i+3])changedAlpha++;
 }
 // World9 depth-point browser probes, NOT manufactured Rust player snapshots.
 // They certify that the presentational HUD path cannot reveal names/vitals
 // when an authored, opaque facade would cover a real replicated fighter.
 const sourceDepthProbe=Object.freeze({
  nonOptinPreservesHud:redLionActorHudVisible(art,null,{x:4365,y:4040}),
  behindFacadeOccluded:!!frame&&!redLionActorHudVisible(art,frame,{x:4365,y:4040}),
  frontThresholdVisible:!!frame&&redLionActorHudVisible(art,frame,{x:4365,y:4075}),
  outsideFootprintVisible:!!frame&&redLionActorHudVisible(art,frame,{x:5300,y:4040})
 });
 const outcome=Object.freeze({
  sourceDepthProbe,
  ready:true,sourceArtState:art.state().phase,originalSourceHashValidated:!!frame,
  canonicalReplacement:!!frame,changedRgb:changed,changedAlpha,
  unchangedWorldFallback:!frame && changed===0,worldReplaceOnlyRedLion:true,
  realGameAuthority:false,realMultiplayerActors:false,originalSourceBlender:true,cameraX:camera.x,cameraY:camera.y,actualCameraPan:pan
 });
 window.__graphics3bLiveArtSmoke=outcome;
 result.textContent=JSON.stringify(outcome);
}catch(error){window.__graphics3bLiveArtSmoke={ready:false,error:String(error)};
 result.textContent="Source contract failure: "+String(error);}
