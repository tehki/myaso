// Graphics 3A: genuine non-production eight-way sprite comparison.
// Snapshot controls are local and never equip / move an authoritative player.
const el=(id)=>document.getElementById(id);
const cvs=el("comparison"),ctx=cvs.getContext("2d");
const paths=[
 ["Legacy masculine","./assets/adults/adult-masculine_roll.webp"],
 ["Legacy feminine","./assets/adults/adult-feminine_roll.webp"],
 ["Anatomical masculine R4","./assets/adults-review-r4/adult-masculine_roll.webp"],
 ["Anatomical feminine R4","./assets/adults-review-r4/adult-feminine_roll.webp"],
 ["Silver Knight comparison","./assets/review-r1/knight_silver_roll.webp"],
];
const sprites=[],errors=[];
for(const [label,path] of paths){
 const image=new Image();
 image.src=path;
 try{
  await image.decode();
  if(image.naturalWidth!==1280||image.naturalHeight!==1280)throw Error("wrong dimensions");
 }catch(e){errors.push(label+": "+e.message);}
 sprites.push({label,path,image});
}
const sampleMs=[40,40,50,40,40,50,40,50],totalMs=350;
const marks=["S","SW","W","NW","N","NE","E","SE"];
let playback=true,elapsed=0,frame=0,last=null,rendered=0;
const UI=document.createElement("section");
UI.style.cssText="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:14px 0;padding:10px;background:#293b38;";
UI.innerHTML='<button id="r4-toggle">Pause</button><button id="r4-prev">Previous frame</button><button id="r4-next">Next frame</button><label>Frame <input id="r4-frame" type="range" min="0" max="7" value="0" step="1"></label><output id="r4-label">1/8</output><label>Direction <select id="r4-dir"><option value="-1">All 8</option><option value="0">S</option><option value="1">SW</option><option value="2" selected>W / side</option><option value="3">NW</option><option value="4">N</option><option value="5">NE</option><option value="6">E / side</option><option value="7">SE</option></select></label>';
const text=document.createElement("p");
text.textContent="The source roll was authored as a 350ms candidate. This is a neutral sprite animation, not the actual game renderer. Greyhaven ground contact, authoritative movement, timing and human approval are NOT verified.";
cvs.parentNode.insertBefore(UI,cvs);
cvs.parentNode.insertBefore(text,UI);
const gif=document.createElement("p");
gif.innerHTML='<a href="../docs/art/adult-roll-review-r4/adult-roll-r4-both-bodies-all-8.gif">R4 animated eight-direction loop</a> — <a href="../docs/art/adult-roll-review-r4/adult-roll-a2-versus-r4-all-8.gif">Before/after animated loop</a>';
cvs.parentNode.insertBefore(gif,cvs.nextSibling);
function pause(){playback=false;el("r4-toggle").textContent="Play";}
el("r4-toggle").onclick=()=>{playback=!playback;el("r4-toggle").textContent=playback?"Pause":"Play";};
el("r4-prev").onclick=()=>{pause();frame=(frame+7)%8;el("r4-frame").value=frame;};
el("r4-next").onclick=()=>{pause();frame=(frame+1)%8;el("r4-frame").value=frame;};
el("r4-frame").oninput=()=>{pause();frame=Number(el("r4-frame").value);};
function draw(){
 ctx.fillStyle="#29383b";ctx.fillRect(0,0,1280,930);
 ctx.fillStyle="#f1dab1";ctx.font="bold 20px system-ui";
 ctx.fillText("Forward Roll · Visual Review R4 · 350 ms · source only",18,27);
 ctx.font="13px system-ui";
 ctx.fillText("Orange cross = sprite-origin guide, NOT validated collision or foot contact",18,47);
 for(let direction=0;direction<8;direction++){
  const x=76+direction*149;
  ctx.fillStyle="#f1c88b";ctx.fillText(marks[direction],x+25,72);
  const selected=Number(el("r4-dir").value);
  if(selected===direction){
   ctx.strokeStyle="#e3b76b";ctx.lineWidth=2;
   ctx.strokeRect(direction*149+6,77,145,790);
  }
  for(let i=0;i<sprites.length;i++){
   const baseY=90+i*154, image=sprites[i].image;
   ctx.fillStyle=i===2||i===3?"#40564c":"#37464a";
   ctx.fillRect(direction*149+9,baseY,139,145);
   ctx.fillStyle="rgba(232,229,207,.18)";
   ctx.fillRect(direction*149+9,baseY+129,139,2);
   if(image.complete&&image.naturalWidth===1280){
    // Full first-party 160px alpha atlas cells, 126px in inspection view.
    ctx.drawImage(image,frame*160,direction*160,160,160,
      direction*149+18,baseY+3,122,122);
   }
   ctx.strokeStyle="#ef9a70";ctx.lineWidth=1;
   const originX=direction*149+79,originY=baseY+122;
   ctx.beginPath();ctx.moveTo(originX-5,originY);ctx.lineTo(originX+5,originY);
   ctx.moveTo(originX,originY-5);ctx.lineTo(originX,originY+5);ctx.stroke();
  }
 }
 for(let i=0;i<sprites.length;i++){
  ctx.font="12px system-ui";ctx.fillStyle=i>1&&i<4?"#e3c799":"#d1e0d8";
  ctx.fillText(sprites[i].label,17,90+i*154+143);
 }
 ctx.fillStyle="#f2d9a9";ctx.font="13px system-ui";
 ctx.fillText("REVIEW HOLD: NOT integrated, NOT visually approved. Ground contact and multiplayer movement still require live QA.",14,913);
}
function tick(now){
 if(last==null)last=now;
 if(playback){
  elapsed=(elapsed+Math.max(0,Math.min(100,now-last)))%totalMs;
  let running=0;
  for(let i=0;i<8;i++){running+=sampleMs[i];if(elapsed<running){frame=i;break;}}
  el("r4-frame").value=String(frame);
 }
 last=now;el("r4-label").textContent=(frame+1)+"/8";
 if(!errors.length)draw();
 rendered++;
 requestAnimationFrame(tick);
}
window.__GRAPHICS3A_R4__=()=>({
  ready:errors.length===0&&sprites.every(s=>s.image.naturalWidth===1280),
  files:sprites.length,errors,frame,loopMs:totalMs,rendered,
  bodies:["adult-masculine","adult-feminine"],directions:8,
  originalSilverKnightReference:true,compositeOnly:true,
  authoritativeGameplay:false,groundContactVerified:false,
  humanVisualApproval:false,integrationReady:false,
});
document.body.style.cssText="font:16px/1.5 system-ui;background:#172429;color:#f0e9dc;margin:18px";
cvs.width=1280;cvs.height=930;cvs.style.cssText="max-width:100%;height:auto;border:1px solid #63766a";
if(errors.length){document.body.append("Asset load blocked: "+errors.join("; "));}
requestAnimationFrame(tick);
