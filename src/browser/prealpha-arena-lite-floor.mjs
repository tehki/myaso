/**
 * Graphics 3C / Pre-Alpha Arena Lite — optional original floor art.
 * Original preview source, optionally imported only by the explicit live game arenaLite=1 visual gate.
 * World/gameplay collision, arena projection, fighter/server state and input
 * remain unchanged. Paint ONCE into an opaque 960x540 review canvas.
 */
export const ARENA_LITE_WIDTH=960;
export const ARENA_LITE_HEIGHT=540;
export const ARENA_LITE_SEED=0x3C202610;

function randomSource(seed) {
  let state=seed>>>0;
  return ()=>{
    state^=state<<13;
    state^=state>>>17;
    state^=state<<5;
    return (state>>>0)/4294967296;
  };
}
function ellipse(ctx,x,y,rx,ry,fill,rotation=0) {
  ctx.beginPath();
  ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);
  ctx.fillStyle=fill;
  ctx.fill();
}
function stone(ctx,x,y,w,h,shade,jitter=0){
  ctx.beginPath();
  ctx.moveTo(x+3,y+jitter);
  ctx.lineTo(x+w-3,y+1-jitter);
  ctx.lineTo(x+w,y+h*.31);
  ctx.lineTo(x+w-4,y+h-1);
  ctx.lineTo(x+4,y+h);
  ctx.lineTo(x,y+h*.55);
  ctx.closePath();
  ctx.fillStyle=shade;ctx.fill();
  ctx.strokeStyle="rgba(16,15,12,.31)";
  ctx.lineWidth=1.2;ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x+4,y+2);
  ctx.lineTo(x+w-5,y+3);
  ctx.strokeStyle="rgba(218,198,156,.17)";ctx.lineWidth=1;ctx.stroke();
}
// Seam-wrapped decorative marks for a repeating world-space ground tile.
// No perimeter walls: repeating the old frame would produce false barriers.
function wrappedGroundMark(ctx,x,y,rx,ry,color,angle,width,height){
  const r=Math.max(rx,ry)*1.5;
  for(const dx of [0, -width, width]){
    if(dx===-width && x+r<width)continue;
    if(dx===width && x-r>0)continue;
    for(const dy of [0, -height, height]){
      if(dy===-height && y+r<height)continue;
      if(dy===height && y-r>0)continue;
      ellipse(ctx,x+dx,y+dy,rx,ry,color,angle);
    }
  }
}
function paintRepeatingEarth(ctx,width,height,rng){
  ctx.fillStyle="#494032";
  ctx.fillRect(0,0,width,height);
  // Fine low-contrast variation without vertical gradients or image borders.
  // All crossing marks wrap to the opposite edge for seamless repetition.
  for(let i=0;i<140;i++){
    const x=rng()*width,y=rng()*height;
    wrappedGroundMark(ctx,x,y,8+rng()*36,2+rng()*9,
      ["rgba(205,182,139,.045)","rgba(28,26,21,.04)","rgba(170,149,111,.055)"][i%3],
      rng()*Math.PI,width,height);
  }
  // Sparse worn cobble patches. These are decoration, NEVER walls/colliders.
  for(let i=0;i<88;i++){
    const x=rng()*width,y=rng()*height,rad=5+rng()*8;
    wrappedGroundMark(ctx,x,y,rad,rad*.53,
      ["rgba(124,113,96,.19)","rgba(162,145,116,.15)","rgba(53,47,39,.22)"][i%3],
      rng()*Math.PI,width,height);
  }
  for(let i=0;i<390;i++){
    const x=rng()*width,y=rng()*height;
    wrappedGroundMark(ctx,x,y,.5+rng()*1.9,.32+rng()*.8,
      ["rgba(25,23,18,.29)","rgba(207,177,124,.15)","rgba(88,80,60,.41)"][i%3],
      rng()*Math.PI,width,height);
  }
}
export function paintArenaLiteFloor(ctx,{width=ARENA_LITE_WIDTH,height=ARENA_LITE_HEIGHT,seed=ARENA_LITE_SEED,tileable=false}={}){
  if(!ctx||typeof ctx.fillRect!=="function"||typeof ctx.createLinearGradient!=="function"||
      typeof ctx.beginPath!=="function"||typeof ctx.ellipse!=="function"||
      typeof ctx.save!=="function"||typeof ctx.restore!=="function"||
      !Number.isInteger(width)||!Number.isInteger(height)||width!==960||height!==540||
      !Number.isInteger(seed)||seed<0||seed>0xffffffff||
      typeof tileable!=="boolean")
    throw new TypeError("Arena Lite requires original 960x540 opaque Canvas and bounded seed");
  const rng=randomSource(seed);
  ctx.save();
  try{
    if(tileable){
      paintRepeatingEarth(ctx,width,height,rng);
      return;
    }
    // Only scenery. No gameplay walls, colliders, damage or lighting physics.
    const earth=ctx.createLinearGradient(0,0,0,height);
    earth.addColorStop(0,"#51483a");
    earth.addColorStop(.47,"#49402f");
    earth.addColorStop(1,"#383127");
    ctx.fillStyle=earth;ctx.fillRect(0,0,width,height);
    // Ground wear appears beneath fighters, avoids dense battle-center contrast.
    for(let i=0;i<104;i++){
      const x=35+rng()*890,y=30+rng()*482;
      const center=Math.hypot((x-width*.5)/(width*.51),(y-height*.5)/(height*.54));
      const a=center<.58?.025:.045;
      ellipse(ctx,x,y,8+rng()*43,2+rng()*12,
        `rgba(215,190,145,${a.toFixed(3)})`,rng()*Math.PI);
    }
    // Irregular cobble only at perimeter — playable combat footprint unobstructed.
    for(let row=0;row<4;row++){
      const y=row*23-9;
      for(let col=0;col<31;col++){
        const x=col*33+(row%2)*14-15;
        stone(ctx,x,y,30,19,["#645b4c","#685e4d","#5e574b","#716551"][(row+col)%4],(rng()-.5)*2);
        stone(ctx,x,height-y-19,30,19,["#5d5345","#5f5848","#615649","#564e42"][(row+col)%4],(rng()-.5)*2);
      }
    }
    for(let col=0;col<3;col++){
      const x=col*25-4;
      for(let row=4;row<20;row++){
        const y=row*24-1;
        stone(ctx,x,y,21,20,["#5c5244","#685e4e","#61594a"][(row+col)%3],(rng()-.5)*2);
        stone(ctx,width-x-21,y,21,20,["#5c5144","#625849","#6b604e"][(row+col)%3],(rng()-.5)*2);
      }
    }
    // Small stable gravel points. No animated particles, sound or gameplay masks.
    for(let i=0;i<240;i++){
      const x=78+rng()*804,y=96+rng()*350;
      const c=i%4;
      ellipse(ctx,x,y,.45+rng()*1.4,.3+rng()*.7,
        ["rgba(25,23,18,.25)","rgba(198,175,128,.16)","rgba(88,80,60,.4)","rgba(171,150,118,.15)"][c]);
    }
    // Faint trampled arcs: no heavy fighting-target markers or shadow effects.
    ctx.beginPath();
    ctx.ellipse(width*.5,height*.53,width*.33,height*.32,-.09,.14,2.9);
    ctx.strokeStyle="rgba(186,155,104,.12)";
    ctx.lineWidth=3;
    ctx.stroke();
    // Very restrained frame edge: visual only; not a barrier/hitbox.
    ctx.strokeStyle="rgba(23,21,17,.63)";ctx.lineWidth=8;
    ctx.strokeRect(5,5,width-10,height-10);
    ctx.strokeStyle="rgba(196,174,125,.24)";ctx.lineWidth=1.2;
    ctx.strokeRect(12,12,width-24,height-24);
  }finally{
    ctx.restore();
  }
}
export function createArenaLiteLayer(makeCanvas){
  if(typeof makeCanvas!=="function")throw new TypeError("Canvas factory required");
  const canvas=makeCanvas();
  if(!canvas||canvas.width!==ARENA_LITE_WIDTH||canvas.height!==ARENA_LITE_HEIGHT||
     typeof canvas.getContext!=="function")
    throw new TypeError("Original arena size required");
  const ctx=canvas.getContext("2d",{alpha:false});
  if(!ctx)throw new Error("Opaque 2D canvas required");
  paintArenaLiteFloor(ctx);
  return canvas;
}
