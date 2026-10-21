const $=id=>document.getElementById(id);
const cvs=$("compare"),ctx=cvs.getContext("2d");
const base="../docs/art/rig-gripped-sword/";
const images={};
for(const [kind,file] of [["old","silver_roll_unarmed_original_reference.webp"],
                           ["rig","silver_roll_original_bone_gripped_sword_review.webp"]]){
 const image=new Image();image.src=base+file;await image.decode();
 if(image.naturalWidth!==1792||image.naturalHeight!==1792)
  throw Error("Wrong original-source atlas dimensions: "+kind);
 images[kind]=image;
}
const timing=[40,40,50,40,40,50,40,50],total=350;
const labels=["S","SW","W","NW","N","NE","E","SE"];
let playing=true,elapsed=0,last=null,frame=0,renders=0;
function pause(){playing=false;$("toggle").textContent="Play 350 ms loop";}
$("toggle").onclick=()=>{playing=!playing;$("toggle").textContent=playing?"Pause 350 ms loop":"Play 350 ms loop";};
$("prev").onclick=()=>{pause();frame=(frame+7)%8;$("frame").value=String(frame);render();};
$("next").onclick=()=>{pause();frame=(frame+1)%8;$("frame").value=String(frame);render();};
$("frame").oninput=()=>{pause();frame=Number($("frame").value);render();};
$("facing").onchange=render;
function render(){
 ctx.fillStyle="#95a9a1";ctx.fillRect(0,0,1248,496);
 ctx.fillStyle="#283a31";ctx.font="bold 18px system-ui";
 ctx.fillText("Original unarmed A3 roll   ↓   Same pose + real Blender sword bound to right-hand bone",15,28);
 ctx.font="13px system-ui";
 ctx.fillText("ART-ONLY. No Core item writer. No in-game camera/grounding. Do not approve from code tests alone.",15,46);
 for(let d=0;d<8;d++){
  const cx=80+d*155,highlight=Number($("facing").value);
  ctx.fillStyle="#244436";ctx.font="bold 16px system-ui";
  ctx.fillText(labels[d],cx-7,70);
  if(d===highlight){ctx.strokeStyle="#e4bb7c";ctx.lineWidth=3;
    ctx.strokeRect(d*155+3,73,149,401);}
  for(let row=0;row<2;row++){
   const y=84+row*204;
   ctx.fillStyle=row?"#a6b5a8":"#b4c1b5";
   ctx.fillRect(d*155+5,y,146,192);
   const image=images[row===0?"old":"rig"];
   ctx.drawImage(image,frame*224,d*224,224,224,
    d*155+9,y+10,138,138);
   ctx.fillStyle="#34483a";ctx.fillRect(d*155+10,y+146,136,1);
   ctx.font="12px system-ui";
   ctx.fillText(row===0?"UNARMED source":"RIG-BOUND sword",d*155+10,y+171);
  }
 }
 $("readout").textContent=String(frame+1)+"/8";
 renders++;
}
function tick(now){
 if(last===null)last=now;
 if(playing){
  elapsed=(elapsed+Math.max(0,Math.min(100,now-last)))%total;
  let sum=0;
  for(let i=0;i<8;i++){sum+=timing[i];if(elapsed<sum){frame=i;break;}}
  $("frame").value=String(frame);
 }
 last=now;
 render();
 requestAnimationFrame(tick);
}
window.__GRAPHICS3A_GRIP_QA__=()=>({ready:true,frames:8,directions:8,
 imagePixels:[images.old.naturalWidth,images.rig.naturalWidth],
 visualRollMs:total,frame,renders,sourceOnly:true,humanApproved:false,
 realServer:false,realGameplay:false,alteredOwnerSource:false});
requestAnimationFrame(tick);