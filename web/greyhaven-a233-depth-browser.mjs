import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {createRedLionVisualDepthPlan} from "../src/browser/red-lion-visual-depth-review.mjs";
import {AUTHORED_MAPS,MAP_IDS} from "/__a233_3c__/authored-maps.mjs";
import {createGreyhavenLightingPlan,GREYHAVEN_LIGHTING_VERSION,paintGreyhavenLightingPools,paintGreyhavenLightingFixtures} from "/__a233_3c__/greyhaven-atmosphere.mjs";
const $=n=>document.getElementById(n);
const root="../assets/environment/greyhaven/";
async function json(path){const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status+" "+path);return r.json();}
async function im(path){const i=new Image();i.src=new URL(path,import.meta.url).href;await i.decode();return i;}
let state=null;window.__a233Review=()=>state;
try{
 const source=await json(root+"a231-review/greyhaven_a231_lighting_handoff.json");
 const count=await json(root+"a232-review/greyhaven_a232_threshold_actor_alpha_report.json");
 const originalWorld=AUTHORED_MAPS[MAP_IDS.overworld];
 const lion=originalWorld.buildings.find(b=>b.id==="red-lion");
 if(!lion||lion.entrance.x!==4365||lion.entrance.y!==4060||
    source.building.visualArtDoor[1]!==4075||
    GREYHAVEN_LIGHTING_VERSION!=="3c-p24-1"||
    ARENA_VIEW_ZOOM!==.84||count.sourceFacadeAlphaHazard.count!==69||
    !source.material.roofByteIdenticalToA226)throw Error("Original P2.4 / 3B source contract changed");
 const [facade,roof,knight,adult]=await Promise.all([
  im(root+"a231-review/"+source.material.dusk.file),
  im(root+"a231-review/"+source.material.roof.file),
  im("/__a233_knights__/silver_idle.webp"),
  im("/__a233_adults__/adult-masculine_idle.webp")
 ]);
 if(facade.naturalWidth!==228||roof.naturalWidth!==238||knight.naturalWidth!==640||adult.naturalWidth!==640||
    knight.naturalHeight!==1280||adult.naturalHeight!==1280)throw Error("Original source sizes changed");
 // These are the original 3C light painters and original data, not rewritten art.
 const tile={x:4096,y:3584,width:512,height:512};
 const map={...originalWorld,buildings:[lion]};
 const plan=createGreyhavenLightingPlan(map,tile);
 const fixture=plan.find(x=>x.id==="red-lion");
 if(!fixture||fixture.x!==4365||fixture.fixtureY!==4045||fixture.poolY!==4069)throw Error("3C lantern moved");
 const background=document.createElement("canvas");background.width=background.height=512;
 const shine=document.createElement("canvas");shine.width=shine.height=512;
 for(const [canvas,painter] of [[background,paintGreyhavenLightingPools],[shine,paintGreyhavenLightingFixtures]]){
  const context=canvas.getContext("2d");context.save();context.translate(-tile.x,-tile.y);
  painter(context,map,tile);context.restore();
 }
 const door={x:4365,y:4075};const lookup={north:knight,west:knight,south:adult};
 let pending=false;
 function render(){
  pending=false;
  const northY=Number($("northY").value),opacity=Number($("roofOpacity").value)/100;
  const actors=[
   {id:"north",x:door.x-8,y:door.y+northY},
   {id:"west",x:door.x-25,y:door.y},
   {id:"south",x:door.x+25,y:door.y+16},
  ];
  const order=createRedLionVisualDepthPlan({actors});
  const sprites={};const px={};
  for(const p of actors){px[p.id]=projectArenaPoint(p.x,p.y,door.x,door.y,640,640);}
  const drawActor=(ctx,p)=>{
   const sprite=lookup[p.id],screen=px[p.id];
   ctx.drawImage(sprite,0,0,160,160,screen.x-48,screen.y-62.4,96,96);
  };
  for(const mode of ["static","proposed"]){
   const ctx=$(mode).getContext("2d",{alpha:false});
   ctx.fillStyle="#444b49";ctx.fillRect(0,0,640,640);
   ctx.strokeStyle="rgba(185,175,149,.19)";
   for(let i=0;i<=640;i+=32){
    ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,640);ctx.moveTo(0,i);ctx.lineTo(640,i);ctx.stroke();
   }
   const anchor=projectArenaPoint(tile.x,tile.y,door.x,door.y,640,640);
   ctx.drawImage(background,anchor.x,anchor.y,512*.84,512*.84);
   if(mode==="proposed"){
    for(const actor of order.behindFacade)drawActor(ctx,actor);
   }
   ctx.drawImage(facade,206,51);
   ctx.drawImage(shine,anchor.x,anchor.y,512*.84,512*.84);
   if(mode==="static"){for(const actor of [...actors].sort((a,b)=>a.y-b.y||a.id.localeCompare(b.id)))drawActor(ctx,actor);}
   else for(const actor of order.inFrontOfFacade)drawActor(ctx,actor);
   ctx.save();ctx.globalAlpha=opacity;ctx.drawImage(roof,201,37);ctx.restore();
   ctx.fillStyle="#f1d5a5";ctx.font="12px monospace";
   ctx.fillText(mode==="static"?"ALWAYS FRONT (old review)":"VISUAL PLAN (not production)",8,624);
  }
  $("northValue").textContent=String(northY);$("roofValue").textContent=(opacity*100)+"%";
  state={ready:true,northY,roofOpacity:opacity,source3CVersion:GREYHAVEN_LIGHTING_VERSION,
   originalWorldEntrance:[lion.entrance.x,lion.entrance.y],
   visualDoor:[door.x,door.y],lanternXY:[fixture.x,fixture.fixtureY],poolXY:[fixture.x,fixture.poolY],
   thresholdAlphaHazardCount:count.sourceFacadeAlphaHazard.count,
   stageNames:order.stageNames,
   behindIds:order.behindFacade.map(p=>p.id),frontIds:order.inFrontOfFacade.map(p=>p.id),
   sortedFeet:actors.map(p=>({id:p.id,y:p.y})),
   alphaPixelMaskPixelsChanged:69,
   actualGameRendererIntegrated:false,serverPortalOrCollisionChanged:false,
   realOcclusionValidated:false,roofLogicEnabled:false,productionApproved:false};
  $("status").dataset.state="ready";
  $("status").textContent="Visual stage hypothesis: north "+(northY<0?"behind":"front")+
    "; west threshold in front; south in front. Actual World/Combat renderer untouched.";
 }
 for(const id of ["northY","roofOpacity"])$(id).addEventListener("input",()=>{
  if(!pending){pending=true;requestAnimationFrame(render);}
 });
 requestAnimationFrame(render);
}catch(error){$("status").textContent="Review blocked: "+error.message;$("status").dataset.state="error";console.error(error);}
