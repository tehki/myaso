import {knightPresentationRect,KNIGHT_FRAME_PX} from "./knight-sprites.mjs";
const $=id=>document.getElementById(id),canvas=$("sheet"),ctx=canvas.getContext("2d");
const ART="../docs/art/silver-kick-dash-p0/";
const config={
 silver_kick_p0:{ms:380,timings:[20,40,50,40,50,65,70,45],baseline:"silver_idle",baselineFrames:4},
 silver_dash_p0:{ms:140,timings:[20,20,20,20,20,20,10,10],baseline:"silver_sprint",baselineFrames:8}
};
const frames=new Map();
for(const key of ["silver_kick_p0","silver_dash_p0","silver_idle","silver_sprint"]){
 const img=new Image();
 img.src=key.startsWith("silver_")&&!(key in config)?"./assets/knights/"+key+".webp":ART+key+".webp";
 await img.decode();
 const expected=(key in config?8:config.silver_kick_p0.baseline===key?4:8)*160;
 if(img.naturalWidth!==expected||img.naturalHeight!==1280)
  throw Error("First-party eight-facing atlas geometry mismatch: "+key);
 frames.set(key,img);
}
let playing=true,lastTime=null,elapsed=0,activeFrame=0,renders=0;
const names=["S","SW","W","NW","N","NE","E","SE"];
function elapsedToFrame(t,clip){
 let sum=0;const times=config[clip].timings;
 for(let i=0;i<times.length;i++){sum+=times[i];if(t<sum)return i;}
 return 7;
}
function phaseLabel(clip,frame){
 if(clip==="silver_dash_p0")return "DASH / 140ms server action";
 const t=config[clip].timings.slice(0,frame).reduce((a,b)=>a+b,0);
 return t<90?"KICK WINDUP (server 90 ms)":t<160?"KICK ACTIVE (server 70 ms)":"KICK RECOVERY (server 220 ms)";
}
function render(){
 const clip=$("clip").value, cfg=config[clip], atlas=frames.get(clip);
 const original=frames.get(cfg.baseline);
 const r=knightPresentationRect(false,1.2);
 ctx.fillStyle="#98aaa0";ctx.fillRect(0,0,1340,535);
 ctx.fillStyle="#203c32";ctx.textAlign="left";ctx.font="bold 17px system-ui";
 ctx.fillText("Eight directions • source 160px • original vs new Blender-authored action • neutral presentation",14,28);
 ctx.font="13px system-ui";ctx.fillText("Standing approved 120% = 96px; no movement, floor or server equipment is simulated",14,46);
 for(let d=0;d<8;d++){
  const x=82+d*166;
  ctx.font="bold 17px system-ui";ctx.textAlign="center";ctx.fillStyle="#294437";ctx.fillText(names[d],x,74);
  const oldF=activeFrame%cfg.baselineFrames;
  for(const [row,img,idx,total] of [[0,original,oldF,cfg.baselineFrames],[1,atlas,activeFrame,8]]){
   const py=86+row*162;
   ctx.fillStyle=row?"#b2c4b6":"#a8b9ae";
   ctx.fillRect(d*166+3,py,161,158);
   ctx.fillStyle="#768d80";ctx.fillRect(d*166+4,py+133,158,1);
   ctx.drawImage(img,idx*160,d*160,160,160,d*166+3,py,160,151);
   ctx.fillStyle="#213c30";ctx.font="12px system-ui";ctx.fillText(row?"NEW AUTHORED":"ORIGINAL "+cfg.baseline,x,py+152);
  }
  const py=416;
  ctx.fillStyle="#c2c7ba";ctx.fillRect(d*166+3,py-6,161,112);
  ctx.strokeStyle="#86978b";ctx.beginPath();ctx.moveTo(d*166+8,py+62);ctx.lineTo(d*166+158,py+62);ctx.stroke();
  ctx.drawImage(atlas,activeFrame*160,d*160,160,160,
    x+r.x,py+37+r.y,r.width,r.height);
  ctx.fillStyle="#294036";ctx.font="11px system-ui";ctx.fillText("120% / QA SCALE",x,py+105);
 }
 $("readout").textContent=(activeFrame+1)+"/8";
 $("report").textContent=phaseLabel(clip,activeFrame)+"  |  loop "+cfg.ms+" ms  |  actor: human Silver  |  AUTHORED SOURCE (not server-accepted action)";
 renders++;
}
function pause(){playing=false;$("toggle").textContent="Play";}
function pickFrame(v){activeFrame=((v%8)+8)%8;$("frame").value=String(activeFrame);render();}
$("clip").onchange=()=>{pause();elapsed=0;pickFrame(0);};
$("toggle").onclick=()=>{playing=!playing;$("toggle").textContent=playing?"Pause":"Play";lastTime=null;};
$("back").onclick=()=>{pause();pickFrame(activeFrame-1);};
$("forward").onclick=()=>{pause();pickFrame(activeFrame+1);};
$("frame").oninput=()=>{pause();pickFrame(Number($("frame").value));};
function animate(now){
 if(lastTime===null)lastTime=now;
 if(playing){
  const cfg=config[$("clip").value];
  elapsed=(elapsed+Math.min(120,Math.max(0,now-lastTime))*Number($("speed").value))%cfg.ms;
  const f=elapsedToFrame(elapsed,$("clip").value);
  if(f!==activeFrame)pickFrame(f);
 }
 lastTime=now;
 requestAnimationFrame(animate);
}
window.__GRAPHICS3A_KICK_DASH_QA__=()=>({
 ready:true,clip:$("clip").value,frame:activeFrame,renders,
 atlases:[...frames].map(([name,img])=>({name,pixels:[img.naturalWidth,img.naturalHeight]})),
 originalSourcePreserved:true,hasRealItemReceipt:false,
 realGame:false,originalGround:false,visualApproved:false,
 loopMs:config[$("clip").value].ms
});
pickFrame(0);requestAnimationFrame(animate);