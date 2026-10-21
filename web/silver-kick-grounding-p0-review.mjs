const $=id=>document.getElementById(id),cvs=$("compare"),ctx=cvs.getContext("2d");
const sources={before:"../docs/art/silver-kick-dash-p0/silver_kick_p0.webp",
 after:"../docs/art/silver-kick-grounding-p0/silver_kick_planted_p0.webp"};
const assets={};
for(const [k,url] of Object.entries(sources)){
 const a=new Image();a.src=url;await a.decode();
 if(a.naturalWidth!==1280||a.naturalHeight!==1280)throw Error("Wrong source atlas "+k);
 assets[k]=a;
}
const durations=[20,40,50,40,50,65,70,45],TOTAL=380;
const labels=["S","SW","W","NW","N","NE","E","SE"];
let play=true,current=0,elapsed=0,previousTime=null,renders=0;
function pause(){play=false;$("play").textContent="Play 380ms loop";}
function draw(){
 ctx.fillStyle="#9cafa2";ctx.fillRect(0,0,1340,461);
 ctx.fillStyle="#2b4737";ctx.font="bold 17px system-ui";ctx.textAlign="left";
 ctx.fillText("Real original Silver 22-bone KICK action • all 8 directions • BEFORE vs foot-contact candidate",14,25);
 ctx.font="13px system-ui";
 ctx.fillText("Source-only: Blender toe joint anchor is NOT verified world terrain / actual foot force or hitbox",14,44);
 for(let d=0;d<8;d++){
  const x=82+d*166;
  ctx.textAlign="center";ctx.font="bold 17px system-ui";ctx.fillText(labels[d],x,68);
  for(const [row,kind] of [[0,"before"],[1,"after"]]){
   const y=80+row*171;
   ctx.fillStyle=row?"#bdcbbd":"#b0c1b3";
   ctx.fillRect(d*166+3,y,160,166);
   ctx.fillStyle="#83968b";ctx.fillRect(d*166+5,y+139,157,1);
   ctx.drawImage(assets[kind],current*160,d*160,160,160,d*166+3,y,160,151);
   ctx.font="12px system-ui";ctx.fillStyle="#213f30";ctx.fillText(row?"CONTACT v2":"BEFORE · #558",x,y+162);
  }
  ctx.strokeStyle="#6c877a";ctx.beginPath();ctx.moveTo(d*166+12,420);ctx.lineTo(d*166+157,420);ctx.stroke();
 }
 $("phase").textContent=(current+1)+"/8";
 const elapsedPhase=durations.slice(0,current).reduce((a,b)=>a+b,0);
 $("report").textContent="Source pose "+(current+1)+"/8; start t="+elapsedPhase+
 "ms of 380ms | "+(elapsedPhase<90?"kick windup":elapsedPhase<160?"kick active":"kick recovery")+
 " | No world foot-ground verification / no server-authoritative event";
 renders++;
}
function setFrame(x){current=(x+8)%8;$("frame").value=String(current);draw();}
$("play").onclick=()=>{play=!play;$("play").textContent=play?"Pause 380ms loop":"Play 380ms loop";previousTime=null;};
$("prev").onclick=()=>{pause();setFrame(current-1);};
$("next").onclick=()=>{pause();setFrame(current+1);};
$("frame").oninput=()=>{pause();setFrame(Number($("frame").value));};
function tick(now){
 if(previousTime===null)previousTime=now;
 if(play){
  elapsed=(elapsed+Math.max(0,Math.min(100,now-previousTime))*Number($("speed").value))%TOTAL;
  let sum=0,found=7;
  for(let i=0;i<8;i++){sum+=durations[i];if(elapsed<sum){found=i;break;}}
  if(found!==current)setFrame(found);
 }
 previousTime=now;requestAnimationFrame(tick);
}
function visibleCharacterPixels(facing,row){
 const x=facing*166+6,y=80+row*171+7;
 const pixels=ctx.getImageData(x,y,152,119).data;
 let dark=0;
 for(let n=0;n<pixels.length;n+=4){
  if(pixels[n]<115&&pixels[n+1]<127&&pixels[n+2]<137)dark++;
 }
 return dark;
}
window.__GRAPHICS3A_GROUNDED_KICK_QA__=()=>({
 ready:true,frame:current,renderedFrames:renders,directions:8,
 renderedCharacterPixelsByFacing:Array.from({length:8},(_,d)=>[
  visibleCharacterPixels(d,0),visibleCharacterPixels(d,1)]),
 atlasBytes:[assets.before.naturalWidth,assets.after.naturalWidth],
 sourceOnly:true,realGreyhaven:false,
 realCombat:false,humanApproved:false,rollout:false,durationMs:380
});
setFrame(0);requestAnimationFrame(tick);
