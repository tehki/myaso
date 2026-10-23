"""Patch only original Silver review HTML presentation grounding.
The ground circle is cosmetic, never a gameplay/world-authority assertion.
Source alpha is scanned per authentic frame+direction+selected original WebP.
"""
def anchor_ground(html: str) -> str:
    a=''' const obj={c,ctx,canvas,img:new Image(),ready:false,label,count:card.querySelector(".counter"),bar:card.querySelector(".bar span")};'''
    b=''' const obj={c,ctx,canvas,img:new Image(),ready:false,label,count:card.querySelector(".counter"),bar:card.querySelector(".bar span"),footCache:new Map()};'''
    assert html.count(a)==1,"original gallery renderer moved (cache)"
    html=html.replace(a,b,1)
    a='''   obj.ready=true;label.textContent="ORIGINAL SOURCE · OFFLINE";paint(obj);'''
    b='''   obj.footCache.clear(); // source change: old, Roll-studio and game-scale have different opaque footprints.
   obj.ready=true;label.textContent="ORIGINAL SOURCE · OFFLINE";paint(obj);'''
    assert html.count(a)==1,"original gallery renderer moved (onload)"
    html=html.replace(a,b,1)
    a='''function draw(obj,frame,face,x,y,scale){
 const s=SIZE*scale;
 const row=oldSource&&["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;
 obj.ctx.drawImage(obj.img,frame*SIZE,row*SIZE,SIZE,SIZE,x-s/2,y-s/2,s,s);
}
function paint(obj){'''
    b='''// Visual review ONLY. The source WebPs do not contain world ground coordinates,
// physics height, or authority. Anchor the preview circle to visible RGBA bounds
// instead of a hard-coded disconnected y=265 beneath a center-y=146 actor.
const footProbe=document.createElement("canvas");
footProbe.width=SIZE;footProbe.height=SIZE;
const footProbeCtx=footProbe.getContext("2d",{willReadFrequently:true});
function atlasRow(obj,face){
 return oldSource&&["idle","walk","sprint","jump"].includes(obj.c.id) ? (8-face)%8 : face;
}
function visibleSourceBottom(obj,frame,face){
 const row=atlasRow(obj,face);
 const key=row+":"+frame;
 if(obj.footCache.has(key))return obj.footCache.get(key);
 footProbeCtx.clearRect(0,0,SIZE,SIZE);
 footProbeCtx.drawImage(obj.img,frame*SIZE,row*SIZE,SIZE,SIZE,0,0,SIZE,SIZE);
 const pixels=footProbeCtx.getImageData(0,0,SIZE,SIZE).data;
 // Ignore near-transparent antialias fringe; source pixel bounds, not gait physics.
 for(let y=SIZE-1;y>=0;y--){
   for(let x=0;x<SIZE;x++){
     if(pixels[(y*SIZE+x)*4+3]>=64){
       obj.footCache.set(key,y+1);
       return y+1;
     }
   }
 }
 throw new Error("Silver source frame has no visible pixels: "+obj.c.id+" row "+row+" frame "+frame);
}
function draw(obj,frame,face,x,y,scale){
 const s=SIZE*scale, row=atlasRow(obj,face);
 obj.ctx.drawImage(obj.img,frame*SIZE,row*SIZE,SIZE,SIZE,x-s/2,y-s/2,s,s);
}
function groundAlignedCenterY(obj,frame,face,groundY,scale){
 // Jump is intentionally airborne in this visual pose-only reference. The
 // gap is illustrative, NOT a simulated jump height or engine validation.
 const airborneGap=obj.c.id==="jump"?18*scale:0;
 return groundY-(visibleSourceBottom(obj,frame,face)-SIZE/2)*scale-airborneGap;
}
function drawAtPreviewGround(obj,frame,face,x,groundY,scale){
 const {ctx}=obj;
 ctx.save();
 ctx.fillStyle=obj.c.id==="jump"?"rgba(132,153,179,.19)":"rgba(132,153,179,.28)";
 ctx.beginPath();
 ctx.ellipse(x,groundY,36*scale,6*scale,0,0,Math.PI*2);
 ctx.fill();
 ctx.restore();
 draw(obj,frame,face,x,groundAlignedCenterY(obj,frame,face,groundY,scale),scale);
}
function paint(obj){'''
    assert html.count(a)==1,"original gallery renderer moved (draw/paint)"
    html=html.replace(a,b,1)
    a='''     const x=80+(i%4)*160,y=73+Math.floor(i/4)*162;
     draw(obj,frame,i,x,y,.73);
     ctx.font="13px ui-monospace,Consolas,monospace";ctx.fillStyle="#d1dce5";ctx.textAlign="center";ctx.fillText(DIRS[i],x,y+72);'''
    b='''     const x=80+(i%4)*160,groundY=Math.floor(i/4)===0?117:279;
     drawAtPreviewGround(obj,frame,i,x,groundY,.73);
     ctx.font="13px ui-monospace,Consolas,monospace";ctx.fillStyle="#d1dce5";ctx.textAlign="center";ctx.fillText(DIRS[i],x,groundY+27);'''
    assert html.count(a)==1,"original gallery renderer moved (all)"
    html=html.replace(a,b,1)
    a='''   ctx.fillStyle="#a1b4c944";ctx.beginPath();ctx.ellipse(320,265,77,12,0,0,Math.PI*2);ctx.fill();
   draw(obj,frame,Number(dir),320,146,1.52);'''
    b='''   drawAtPreviewGround(obj,frame,Number(dir),320,260,1.52);'''
    assert html.count(a)==1,"original gallery renderer moved (single)"
    html=html.replace(a,b,1)
    # Explicitly warn that this is not ground-height or contact physics evidence.
    a='''<footer class="note">'''
    b='''<footer class="note">
<p><strong>Ground reference:</strong> the circles are cosmetic review markers
aligned to each source frame's lowest visible nontransparent pixels, not
authoritative arena ground or physical foot-contact tests. Jump intentionally
shows an illustrative airborne gap, not the game's jump trajectory. Sprite
placement and arena physics must be validated in a genuine multiplayer build.</p>'''
    assert html.count(a)==1,"original gallery footer moved"
    html=html.replace(a,b,1)
    return html
