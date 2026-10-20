// Standalone A2.14 source-only visual QA: never imported by online-game.mjs.
const $=id=>document.getElementById(id);
let original=null,draws=0;
const feetControl=$("feet"),switchControl=$("switches");
const color={LeftFoot:"#84e3be",RightFoot:"#edba78"};
function renderGraph(entry){
  const canvas=$(entry.clip),ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.fillStyle="#24343a";ctx.fillRect(0,0,w,h);
  const border={left:62,right:26,top:23,bottom:51};
  const innerW=w-border.left-border.right;
  const innerH=h-border.top-border.bottom;
  const xAt=i=>border.left+i*innerW/7;
  const topRange=.65; // label in source-model units only
  const yAt=v=>border.top+innerH*(1-v/topRange);
  ctx.font="13px system-ui";ctx.textAlign="right";
  ctx.strokeStyle="#4b6369";ctx.lineWidth=1;
  ctx.fillStyle="#b8c9c7";
  for(let j=0;j<=5;j++){
    const v=j*topRange/5,y=yAt(v);
    ctx.beginPath();ctx.moveTo(border.left,y);ctx.lineTo(w-border.right,y);ctx.stroke();
    ctx.fillText(v.toFixed(2),border.left-8,y+5);
  }
  ctx.textAlign="center";
  entry.sourceFrames60fps.forEach((f,i)=>{
    ctx.fillText("f"+f,xAt(i),h-border.bottom+22);
  });
  ctx.font="11px system-ui";
  ctx.fillText("Original A3 source frame (60 fps)",w/2,h-12);
  let visible=0;
  const enabled=feetControl.value==="both"
    ?["LeftFoot","RightFoot"]:[feetControl.value];
  for(const side of enabled){
    const series=entry.feet[side];
    const ys=series.frame1ReferenceClearanceProxyUnits;
    ctx.strokeStyle=color[side];ctx.fillStyle=color[side];ctx.lineWidth=3;
    ctx.beginPath();
    ys.forEach((v,i)=>{
      if(i===0)ctx.moveTo(xAt(i),yAt(v));
      else ctx.lineTo(xAt(i),yAt(v));
    });
    ctx.stroke();
    ys.forEach((v,i)=>{
      ctx.beginPath();ctx.arc(xAt(i),yAt(v),4.2,0,Math.PI*2);ctx.fill();
      const switched=i>0&&series.minimumSourceVertexIndices[i]!==
        series.minimumSourceVertexIndices[i-1];
      if(switchControl.checked&&switched){
        visible++;
        ctx.strokeStyle="#fff0d7";ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(xAt(i)-7,yAt(v)-10);ctx.lineTo(xAt(i)+7,yAt(v)+10);
        ctx.moveTo(xAt(i)+7,yAt(v)-10);ctx.lineTo(xAt(i)-7,yAt(v)+10);ctx.stroke();
      }
    });
  }
  canvas.dataset.visibleSwitchMarkers=String(visible);
  canvas.dataset.sourceClip=entry.clip;
  return visible;
}
function draw(){
  if(!original)return;
  let count=0;
  for(const model of original.models)count+=renderGraph(model);
  const totals=original.models.map(model=>model.clip+": "+
    Object.entries(model.feet).map(([side,foot])=>
      (side==="LeftFoot"?"L":"R")+" "+foot.uniqueMinimumVertexCount+
      " unique / "+foot.minimumVertexSwitchCount+" switches").join(", ")).join(" · ");
  $("report").textContent=totals+
    " · all original foot minima return to their starting vertex by frame 22"+
    " · "+count+" switch markers currently plotted";
  $("report").dataset.state="ready";
  draws++;
}
feetControl.addEventListener("change",draw);
switchControl.addEventListener("change",draw);
window.__a214Review=()=>({
  ready:$("report").dataset.state==="ready",
  feet:feetControl.value,showSwitches:switchControl.checked,
  draws,
  models:original?.models?.map(m=>({clip:m.clip,
    sourceGLBSHA256:m.sourceGLBSHA256,
    leftUnique:m.feet.LeftFoot.uniqueMinimumVertexCount,
    rightUnique:m.feet.RightFoot.uniqueMinimumVertexCount,
    leftSwitches:m.feet.LeftFoot.minimumVertexSwitchCount,
    rightSwitches:m.feet.RightFoot.minimumVertexSwitchCount,
    leftMidroll:m.feet.LeftFoot.midRollFrame7ClearanceProxyUnits,
    rightMidroll:m.feet.RightFoot.midRollFrame7ClearanceProxyUnits,
    visibleSwitchMarkers:Number($(m.clip).dataset.visibleSwitchMarkers)})),
  gameChanged:false,groundContactValidated:false,physicalBootSoleValidated:false
});
try{
 const response=await fetch("./assets/knights/a214-review/knight_a214_anchor_stability.json",{cache:"no-store"});
 if(!response.ok)throw Error("Missing source analysis report: "+response.status);
 original=await response.json();
 if(original.visualScale!==1.2||original.authorizesGameplayFootPivot!==false||
   original.authoritativeFloorContact!==false||original.sourceAssetsChanged!==false||
   original.models.length!==2)throw Error("Invalid source safety contract");
 for(const m of original.models){
  if(!["silver_roll","t1_roll"].includes(m.clip)||m.sourceFrames60fps.length!==8||
    m.feet.LeftFoot.stableSingleVertexAcrossA3!==false||
    m.feet.RightFoot.stableSingleVertexAcrossA3!==false)
    throw Error("Foot anchor stability source unexpectedly changed");
 }
 draw();
}catch(e){$("report").textContent="Cannot load A2.14 source measurements: "+e.message;
 $("report").dataset.state="error";}
