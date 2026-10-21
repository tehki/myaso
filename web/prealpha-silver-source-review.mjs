import {createKnightSpriteRenderer,KNIGHT_FRAME_PX} from "./knight-sprites.mjs";
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
const canvas=document.querySelector("#review"),ctx=canvas.getContext("2d");
const qa=document.querySelector("#qa");
const renderer=createKnightSpriteRenderer();
let activeDraws=[];
const drawImage=ctx.drawImage.bind(ctx);
ctx.drawImage=function(image,...args){
  if(image?.src?.includes("/assets/knights/")){
    activeDraws.push({source:new URL(image.src).pathname.split("/").at(-1),
      direction:args[1]/KNIGHT_FRAME_PX,frame:args[0]/KNIGHT_FRAME_PX,
      width:args[2],height:args[3]});
  }
  return drawImage(image,...args);
};
const valid={idle:COMBAT_ACTION.idle,walk:COMBAT_ACTION.idle,
  sprint:COMBAT_ACTION.idle,roll:COMBAT_ACTION.dodge,jump:COMBAT_ACTION.jump};
function run(clip){
 if(!Object.hasOwn(valid,clip))throw new RangeError("Invalid source clip");
 if(renderer.loaded().length!==5)throw new Error("One or more first-party atlases missing");
 activeDraws=[];
 ctx.fillStyle="#9aad9e";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle="#23382f";ctx.fillRect(0,0,canvas.width,55);
 ctx.font="bold 22px system-ui";ctx.fillStyle="#fff0d6";
 ctx.fillText("ORIGINAL SILVER / "+clip.toUpperCase()+" / eight directions",16,35);
 const observed=[];
 for(let d=0;d<8;d++){
  const facing=Math.PI/2+d*Math.PI/4, cx=79+d*154;
  ctx.save();ctx.translate(cx,210);ctx.fillStyle="#365346";ctx.font="14px system-ui";
  ctx.fillText(String(d),-6,-90);ctx.rotate(facing);
  const base={netId:1000+d+Object.keys(valid).indexOf(clip)*8,x:0,y:0,facing,
    action:COMBAT_ACTION.idle};
  const initial=10000+(d+1)*100;
  if(clip==="walk"||clip==="sprint"){
    renderer.draw(ctx,base,{actorKind:"player",remote:true,rotation:facing,nowMs:initial});
    // Real renderer computes speed from visual positions (no server authority here).
    activeDraws=[];
    base.x=clip==="sprint"?40:16;
    base.action=COMBAT_ACTION.idle;
  } else {
    base.action=valid[clip];
  }
  const before=activeDraws.length;
  const drew=renderer.draw(ctx,base,{actorKind:"player",remote:true,rotation:facing,nowMs:initial+100});
  const added=activeDraws.slice(before);
  ctx.restore();
  observed.push({d,drew,draws:added});
 }
 const report={clip,atlasLoaded:renderer.loaded(),trueServer:false,
  authenticatedPlayers:false,realGreyhaven:false,sourceDirections:8,observed};
 qa.textContent=clip+": all eight original source cells (mock player roles; no real server)";
 return report;
}
function unsupported(action,actorKind="player"){
 activeDraws=[];
 const ok=renderer.draw(ctx,{netId:6001,x:0,y:0,facing:Math.PI/2,action},
  {actorKind,remote:true,nowMs:26000+action});
 return {ok,draws:activeDraws};
}
window.__GRAPHICS3A_PREALPHA_SOURCE_QA__={
 ready:()=>renderer.loaded().length===5,run,unsupported,
 clips:Object.keys(valid),expectedOnlySource:true};
const waiter=setInterval(()=>{
 if(renderer.loaded().length!==5)return;
 clearInterval(waiter);run("idle");
},30);
