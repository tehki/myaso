import {createKnightSpriteRenderer, KNIGHT_FRAME_PX} from "./knight-sprites.mjs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
const cvs=document.getElementById("stage"), ctx=cvs.getContext("2d"), out=document.getElementById("details");
const renderer=createKnightSpriteRenderer({sourceKickPreview:true,assetBase:new URL("./assets/knights/",import.meta.url)});
const stages=[
 {label:"Both windup — no contact",local:COMBAT_ACTION.kickWindup,remote:COMBAT_ACTION.kickWindup},
 {label:"Remote active, local windup",local:COMBAT_ACTION.kickWindup,remote:COMBAT_ACTION.kickActive},
 {label:"Local active, remote recovery",local:COMBAT_ACTION.kickActive,remote:COMBAT_ACTION.kickRecovery},
 {label:"Both recovery — no contact",local:COMBAT_ACTION.kickRecovery,remote:COMBAT_ACTION.kickRecovery},
 {label:"Death and idle — no kick",local:COMBAT_ACTION.dead,remote:COMBAT_ACTION.idle},
];
let artificialNowMs=1000;
const drawImage=ctx.drawImage.bind(ctx);
let records=[];
ctx.drawImage=function(image,...args){
  if(image?.src?.endsWith("/silver_kick.webp")){
    records.push({frame:args[0]/KNIGHT_FRAME_PX,facing:args[1]/KNIGHT_FRAME_PX});
  }
  return drawImage(image,...args);
};
function paint(stage=0,direction=0){
 if(!Number.isInteger(stage)||stage<0||stage>=stages.length)throw new Error("invalid stage");
 if(!Number.isInteger(direction)||direction<0||direction>=8)throw new Error("invalid direction");
 artificialNowMs+=120;
 const selected=stages[stage];records=[];
 ctx.fillStyle="#9bad9d";ctx.fillRect(0,0,cvs.width,cvs.height);
 ctx.fillStyle="#263f36";ctx.fillRect(10,10,1100,74);
 ctx.textAlign="left";ctx.font="bold 20px system-ui";ctx.fillStyle="#fff0cf";
 ctx.fillText(selected.label+" | source facing "+direction,25,42);
 ctx.font="14px system-ui";ctx.fillText("Two independent renderer identities / not authenticated real clients",25,69);
 ctx.strokeStyle="#59786b";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(20,400);ctx.lineTo(1100,400);ctx.stroke();
 const rotation=Math.PI/2+direction*Math.PI/4;
 const positions=[320,800];
 const results=[];
 for (const [idx,part] of ["local","remote"].entries()){
   const action=selected[part], netId=idx===0?1:2;
   ctx.fillStyle="#2d5544";ctx.font="bold 21px system-ui";ctx.textAlign="center";
   ctx.fillText(idx===0?"LOCAL #1 (mock)":"REMOTE #2 (mock)",positions[idx],150);
   ctx.fillStyle="#304e3d";ctx.font="16px system-ui";
   ctx.fillText("observed action "+action,positions[idx],179);
   ctx.save();ctx.translate(positions[idx],380);
   const f={netId,x:idx*90+120,y:95,action,facing:rotation};
   const before=records.length;
   const drew=renderer.draw(ctx,f,{actorKind:"player",remote:idx===1,rotation:0,nowMs:artificialNowMs});
   const images=records.slice(before);
   results.push({id:netId,drew,kickFrames:images.map(i=>i.frame),directions:images.map(i=>i.facing)});
   ctx.restore();
 }
 const report={stage,direction,ready:renderer.loaded().includes("silver_kick"),realServer:false,realGreyhaven:false,
    simulatedAuthoritativeStates:true,actorCount:2,kickDrawCount:records.length,results};
 out.textContent=JSON.stringify({stage:stage+1,direction,frames:results.map(x=>x.kickFrames)},null,2);
 return report;
}
window.__GRAPHICS3A_SPARTAN_OPTIN_CLIENT_QA__={ready:()=>renderer.loaded().includes("silver_kick"),
  run:paint,stages:stages.length};
const timer=setInterval(()=>{
 if(!renderer.loaded().includes("silver_kick"))return;
 clearInterval(timer);paint(0,0);
},40);
