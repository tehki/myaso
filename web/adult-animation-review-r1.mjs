// Graphics 3A R1 — deliberately offline *review-only* visual inspection.
// Greyhaven is genuine PR #350 art rendered with actual 0.84 game XY projection,
// but this page is NOT web/online-game.mjs, multiplayer, physics or server data.
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
import {ADULT_ROLL_SOURCE_FRAMES} from "../src/browser/adult-body-roll-a2.mjs";
const $=id=>document.getElementById(id);
const control={clip:$("clip"),direction:$("direction"),scrub:$("scrub"),
 toggle:$("toggle"),prev:$("prev"),next:$("next"),speed:$("speed"),roof:$("roof")};
const names=["adult-masculine","adult-feminine","Silver Knight"];
const directions=["S","SW","W","NW","N","NE","E","SE"];
const motion={
 idle:{frames:4,totalMs:1120,adultFrames:4,knightClip:"silver_idle",knightFrames:4},
 walk:{frames:4,totalMs:880,adultFrames:4,knightClip:"silver_walk",knightFrames:8},
 run:{frames:4,totalMs:500,adultFrames:4,knightClip:"silver_sprint",knightFrames:8},
 roll:{frames:8,totalMs:350,adultFrames:8,knightClip:"silver_roll",knightFrames:8},
};
const adultFiles=["adult-masculine","adult-feminine"].flatMap(body=>
 Object.keys(motion).map(clip=>({key:body+":"+clip,
  path:"./assets/adults/"+body+"_"+clip+".webp",
  width:160*motion[clip].adultFrames,height:1280})));
const knightFiles=Object.keys(motion).map(clip=>({key:"Knight:"+clip,
 path:"./assets/review-r1/knight_"+motion[clip].knightClip+".webp",
 width:160*motion[clip].knightFrames,height:1280}));
const worldFiles=[
 {key:"greyhaven:base",path:"./assets/review-r1/greyhaven_red_lion_base.webp",width:228,height:297},
 {key:"greyhaven:roof",path:"./assets/review-r1/greyhaven_red_lion_roof.webp",width:238,height:197},
];
const images=Object.create(null),errors=[];
let loaded=0,playing=true,frameManual=0,elapsedMs=0,lastAt=null,metrics=null;
let current=null,renderCount=0;
const load=async entry=>{
 const img=new Image();img.src=entry.path;images[entry.key]=img;
 try{
  await img.decode();
  if(img.naturalWidth!==entry.width||img.naturalHeight!==entry.height)
   throw Error("dimensions "+img.naturalWidth+"x"+img.naturalHeight);
  loaded++;
 }catch(e){errors.push(entry.key+": "+e.message);}
};
await Promise.all([...adultFiles,...knightFiles,...worldFiles].map(load));
try{
 const resp=await fetch("../docs/art/adult-animation-review-r1/motion-review-metrics.json");
 if(!resp.ok)throw Error("HTTP "+resp.status);
 metrics=await resp.json();
}catch(e){errors.push("metrics: "+e.message);}
$("ready").textContent=loaded+"/14 verified source images"+(errors.length?" · errors: "+errors.join("; "):"");
function frameIndex(name,clip,manual=false) {
 const info=motion[clip];
 const n=name==="Silver Knight"?info.knightFrames:info.adultFrames;
 if(manual)return name==="Silver Knight"
  ?Math.floor(frameManual/info.frames*n)%n:frameManual%n;
 if(clip==="roll")return Math.min(n-1,Math.floor((elapsedMs%350)/350*n));
 return Math.floor(elapsedMs/info.totalMs*n)%n;
}
function rectFor(clip,neutral=false){
 const roll=clip==="roll";
 const size=roll?134:96;
 const mul=neutral?1.35:1;
 return {x:-(size/2)*mul,y:(roll?-78:-62.4)*mul,width:size*mul,height:size*mul};
}
function chooseImage(name,clip){
 return name==="Silver Knight"?images["Knight:"+clip]:images[name+":"+clip];
}
function drawCharacter(ctx,name,clip,direction,frame,x,y,{
  neutral=false,shadow=true,origin=true,
}={}){
 const img=chooseImage(name,clip),info=motion[clip];
 if(!img?.complete||!img.naturalWidth)return false;
 const count=name==="Silver Knight"?info.knightFrames:info.adultFrames;
 const index=((frame%count)+count)%count,r=rectFor(clip,neutral);
 if(shadow){
  ctx.fillStyle="rgba(25,23,21,.26)";
  ctx.beginPath();ctx.ellipse(x,y+9,19*(neutral?1.35:1),7*(neutral?1.35:1),0,0,Math.PI*2);ctx.fill();
 }
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 ctx.drawImage(img,index*160,direction*160,160,160,x+r.x,y+r.y,r.width,r.height);
 if(origin){
  ctx.strokeStyle="#f1736e";ctx.lineWidth=1.5;ctx.beginPath();
  ctx.moveTo(x-6,y);ctx.lineTo(x+6,y);
  ctx.moveTo(x,y-6);ctx.lineTo(x,y+6);ctx.stroke();
 }
 return true;
}
function drawNeutral(clip,dir){
 const c=$("neutral"),ctx=c.getContext("2d"),w=c.width,h=c.height;
 ctx.fillStyle="#33443d";ctx.fillRect(0,0,w,h);
 ctx.fillStyle="#53645b";ctx.fillRect(0,336,w,124);
 ctx.fillStyle="#a69e8b";ctx.fillRect(0,335,w,2);
 ctx.fillStyle="#ebdcc1";ctx.font="bold 18px sans-serif";
 ctx.fillText("NEUTRAL / inspection enlarged x1.35",13,27);
 ctx.fillStyle="#eeb5a2";ctx.font="13px sans-serif";
 ctx.fillText("Cross = game fighter origin · not proved anatomical foot pivot",13,48);
 const xs=[108,335,562];
 for(let i=0;i<3;i++){
  const name=names[i],f=frameIndex(name,clip,!playing);
  drawCharacter(ctx,name,clip,dir,f,xs[i],314,{neutral:true});
  ctx.fillStyle="#f1e8d5";ctx.textAlign="center";ctx.font="15px sans-serif";
  ctx.fillText(name,xs[i],375);
 }
 ctx.textAlign="left";
}
function drawWorld(clip,dir){
 const cv=$("world"),ctx=cv.getContext("2d");const w=cv.width,h=cv.height;
 ctx.fillStyle="#617463";ctx.fillRect(0,0,w,h);
 // Source game world coordinates + approved presentation camera zoom=0.84.
 const door=[4365,4075],camera=door;
 const at=projectArenaPoint(...door,...camera,w,h);
 ctx.strokeStyle="rgba(208,232,198,.12)";ctx.lineWidth=1;
 for(let i=0;i<w;i+=33.6){
  ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,h);ctx.stroke();
 }
 for(let i=0;i<h;i+=33.6){
  ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(w,i);ctx.stroke();
 }
 // The actual unmerged PR350 A2.24 Red Lion art is baked into camera XY.
 ctx.drawImage(images["greyhaven:base"],at.x-114,at.y-269);
 const actors=[[-125,90],[0,90],[125,90]];
 for(let i=0;i<actors.length;i++){
  const [dx,dy]=actors[i];
  const projected=projectArenaPoint(door[0]+dx,door[1]+dy,...camera,w,h);
  const name=names[i],f=frameIndex(name,clip,!playing);
  drawCharacter(ctx,name,clip,dir,f,projected.x,projected.y);
  ctx.textAlign="center";ctx.font="13px sans-serif";ctx.fillStyle="#fff4dd";
  ctx.fillText(i===0?"Adult M":i===1?"Adult F":"Silver",projected.x,projected.y+65);
 }
 ctx.save();ctx.globalAlpha=Number(control.roof.value)/100;
 ctx.drawImage(images["greyhaven:roof"],at.x-119,at.y-283);ctx.restore();
 ctx.fillStyle="rgba(17,27,26,.91)";ctx.fillRect(9,8,w-18,55);
 ctx.fillStyle="#efbb7a";ctx.font="bold 15px sans-serif";ctx.textAlign="left";
 ctx.fillText("GREYHAVEN SOURCE-ART COMPOSITE - NOT LIVE GAME",18,29);
 ctx.fillStyle="#efdfcd";ctx.font="12px sans-serif";
 ctx.fillText("Real PR350 building WebPs + game XY 0.84; actual floor contact NOT verified",18,48);
}
function drawEight(clip){
 const cv=$("eight"),ctx=cv.getContext("2d"),w=cv.width,h=cv.height;
 ctx.fillStyle="#354541";ctx.fillRect(0,0,w,h);
 ctx.fillStyle="#f4e5ca";ctx.font="bold 16px sans-serif";
 ctx.fillText("ALL 8 FACINGS: ORIGINAL ADULTS vs SILVER KNIGHT",14,21);
 const cell=135;let drawn=0;
 for(let d=0;d<8;d++){
  ctx.font="14px monospace";ctx.textAlign="center";ctx.fillStyle="#eec68e";
  ctx.fillText(directions[d],d*cell+81,43);
  for(let i=0;i<3;i++){
   const name=names[i],yy=110+i*102,xx=80+d*cell;
   if(drawCharacter(ctx,name,clip,d,frameIndex(name,clip,!playing),xx,yy,
      {origin:false,shadow:false}))drawn++;
   if(d===0){ctx.save();ctx.translate(11,yy);
    ctx.rotate(-Math.PI/2);ctx.fillStyle="#e9dac4";ctx.font="11px sans-serif";
    ctx.fillText(i===0?"ADULT M":i===1?"ADULT F":"SILVER",0,0);ctx.restore();}
  }
 }
 ctx.textAlign="left";
 return drawn;
}
function drawComparison(dir){
 const cv=$("comparison"),ctx=cv.getContext("2d"),w=cv.width,h=cv.height;
 ctx.fillStyle="#364740";ctx.fillRect(0,0,w,h);
 const scenarios=[["idle",0,"IDLE"],["walk",1,"WALK"],["run",1,"RUN"],
  ["roll",0,"ROLL start"],["roll",3,"ROLL mid"],["roll",7,"ROLL end"]];
 const widths=w/scenarios.length;let drawn=0;
 for(let i=0;i<scenarios.length;i++){
  const [clip,fr,label]=scenarios[i],x=(i+.5)*widths;
  ctx.font="13px sans-serif";ctx.textAlign="center";ctx.fillStyle="#edc893";
  ctx.fillText(label,x,20);
  for(let b=0;b<2;b++){
   const yy=96+b*112;
   if(drawCharacter(ctx,names[b],clip,dir,fr,x,yy,{origin:false,shadow:false}))drawn++;
  }
 }
 ctx.textAlign="left";return drawn;
}
function render(now){
 if(!images["greyhaven:base"]?.complete)return;
 if(lastAt===null)lastAt=now;
 const delta=Math.max(0,Math.min(now-lastAt,90));lastAt=now;
 const clip=control.clip.value,info=motion[clip],dir=Number(control.direction.value);
 if(playing)elapsedMs=(elapsedMs+delta*Number(control.speed.value))%info.totalMs;
 const frame=frameIndex("adult-masculine",clip,!playing);
 control.scrub.max=String(info.frames-1);
 if(playing)control.scrub.value=String(frame);
 else frameManual=Math.min(frameManual,info.frames-1);
 $("frame-label").value=(playing?frame:frameManual)+1+" / "+info.frames;
 drawNeutral(clip,dir);
 drawWorld(clip,dir);
 const gridDraws=drawEight(clip),compareDraws=drawComparison(dir);
 renderCount++;
 let msg="SOURCE CLIP: "+clip.toUpperCase()+" · 8 directions · display "+
 (clip==="roll"?"134":"96")+"px · source 160px; playback loop "+
 info.totalMs+" ms (preview fixture, NOT server timing)\n";
 if(clip==="roll")msg+="Roll samples from Blender frames "+
 ADULT_ROLL_SOURCE_FRAMES.join(", ")+" (60 fps, source elapsed [0,33,67,100,133,167,233,350]ms); current legacy preview uses uniform 8 x 43.75ms sampling.\n";
 for(const body of names.slice(0,2)){
  const measure=metrics?.silhouetteBottomOffsetFromOriginPxByBodyClip?.[body+":"+clip];
  if(measure)msg+=body+": silhouette-bottom from fighter origin "+
   measure.min+".."+measure.max+"px; spread="+measure.spreadPx+"px. NOT foot-bone contact.\n";
 }
 msg+="Greyhaven reference: genuine PR350 A224 base/roof WebPs; "+
 "projection=projectArenaPoint/zoom "+ARENA_VIEW_ZOOM+
 "; camera/actor grounding not measured in live game.\n"+
 "In-game integration: NOT VERIFIED. Human visual review: REQUIRED.";
 $("stats").textContent=msg;
 current={ready:loaded===14&&errors.length===0,loaded,errors,
   clip,direction:dir,frame:playing?frame:frameManual,playing,renderCount,
   gridDraws,compareDraws,
   allDirections:8,bodyTypes:2,
   visualScale:{standing:96,roll:134},cameraZoom:ARENA_VIEW_ZOOM,
   actualWorldSpritesLoaded:Boolean(images["greyhaven:base"]?.naturalWidth===228),
   actualKnightAtlasesLoaded:Boolean(images["Knight:roll"]?.naturalWidth===1280),
   neutralPreview:true,worldReferenceComposite:true,
   actualNetworkedGame:false,gameplayFootContactProven:false,
   approvedForRelease:false,
 };
 requestAnimationFrame(render);
}
function pause(){
 playing=false;control.toggle.textContent="Play";
 frameManual=frameIndex("adult-masculine",control.clip.value,false);
}
control.toggle.addEventListener("click",()=>{
 if(playing)pause();
 else {playing=true;elapsedMs=frameManual/motion[control.clip.value].frames*
  motion[control.clip.value].totalMs;control.toggle.textContent="Pause";}
});
for(const input of [control.clip,control.direction]){
 input.addEventListener("change",()=>{elapsedMs=0;frameManual=0;control.scrub.value="0";});
}
control.scrub.addEventListener("input",()=>{if(playing)pause();frameManual=+control.scrub.value;});
for(const [id,delta] of [["prev",-1],["next",1]]){
 $(id).addEventListener("click",()=>{
  if(playing)pause();
  const n=motion[control.clip.value].frames;
  frameManual=(frameManual+delta+n)%n;
  control.scrub.value=String(frameManual);
 });
}
$("reset").addEventListener("click",()=>{control.clip.value="idle";control.direction.value="0";
 control.scrub.value="0";control.speed.value="1";elapsedMs=0;frameManual=0;
 playing=true;control.toggle.textContent="Pause";});
window.__ADULT_ANIMATION_REVIEW_R1__=()=>current;
if(loaded===14&&errors.length===0)requestAnimationFrame(render);
else $("stats").textContent="Missing authored preview sources; fail closed: "+errors.join("; ");
