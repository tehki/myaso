// Blood & Iron A2.29: authenticity-preserving crop QA, not a gameplay renderer.
const root="../assets/environment/greyhaven/";
const $=id=>document.getElementById(id);
const json=async path=>{const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status+" "+path);return r.json();};
const img=async path=>{const image=new Image();image.src=new URL(path,import.meta.url).href;await image.decode();return image;};
const regions=[
 {name:"Entrance joinery and iron",id:"door",rect:[291,249,350,331]},
 {name:"Western mullions and glazing",id:"windowWest",rect:[242,249,281,291]},
 {name:"Eastern mullions and glazing",id:"windowEast",rect:[352,249,393,291]},
 {name:"Stone plinth and mortar",id:"plinth",rect:[213,311,428,344]}
];
let state=null;
window.__a229Review=()=>state;
try{
 const meta=await json(root+"a228-review/greyhaven_a228_facade_report.json");
 const manifest=await json(root+"red-lion-a225-architecture-handoff.json");
 const zoom=manifest.projection.cameraZoom;
 if(zoom!==0.84||manifest.projection.metersPerWorldUnit!==0.025||
    !meta.roofBinaryIdenticalToA226||meta.productionApproved!==false||
    JSON.stringify(meta.visualDoorCanvasPx)!=="[320,320]")throw Error("Authored source/XY provenance mismatch");
 const fileMap={
  source:manifest.rasterLayers.base.file,
  day:"assets/environment/greyhaven/a228-review/"+meta.variants.day.file,
  dusk:"assets/environment/greyhaven/a228-review/"+meta.variants.dusk.file
 };
 const canvases={},raws={},images={};
 for(const [name,path] of Object.entries(fileMap)){
  images[name]=await img(root+path.slice("assets/environment/greyhaven/".length));
  if(images[name].naturalWidth!==228||images[name].naturalHeight!==297)throw Error("Altered source crop "+name);
  const canvas=document.createElement("canvas");canvas.width=640;canvas.height=640;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(images[name],206,51);
  const data=ctx.getImageData(0,0,640,640);
  canvases[name]=canvas;raws[name]=data.data;
 }
 const stats={};
 for(const region of regions){
  const [x0,y0,x1,y1]=region.rect;
  const perRegion={bbox:region.rect,variants:{}};
  for(const variant of ["day","dusk"]){
   let changed=0,alphaDiff=0,sourceL=0,candidateL=0,visible=0,lightened=0;
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const at=(y*640+x)*4,src=raws.source,other=raws[variant];
    if(src[at+3]!==other[at+3])alphaDiff++;
    if(src[at+3]===0)continue;
    visible++;
    let br=0,cr=0;
    for(let c=0;c<3;c++){
     const weight=[0.2126,0.7152,0.0722][c];
     br+=src[at+c]*weight;cr+=other[at+c]*weight;
    }
    sourceL+=br;candidateL+=cr;
    if(cr>br+3)lightened++;
    if(src[at]!==other[at]||src[at+1]!==other[at+1]||src[at+2]!==other[at+2])changed++;
   }
   perRegion.variants[variant]={visibleSourcePixels:visible,changedVisibleRGB:changed,
     alphaDifferences:alphaDiff,sourceMeanLuma:Number((sourceL/visible).toFixed(3)),
     candidateMeanLuma:Number((candidateL/visible).toFixed(3)),stronglyLightened:lightened};
   if(alphaDiff!==0||visible===0)throw Error("Original source alpha violation "+region.id+"/"+variant);
  }
  stats[region.id]=perRegion;
  for(const variant of ["source","day","dusk"]){
   const node=document.createElement("figure");
   const title=document.createElement("figcaption");
   title.innerHTML='<span class="slot"></span>';
   title.querySelector("span").textContent=region.name+" · "+variant.toUpperCase();
   const cv=document.createElement("canvas");cv.width=450;cv.height=260;
   const c=cv.getContext("2d",{alpha:false});
   c.fillStyle="#50685b";c.fillRect(0,0,450,260);
   const sw=x1-x0,sh=y1-y0,scale=Math.min(448/sw,258/sh);
   const w=sw*scale,h=sh*scale;
   c.imageSmoothingEnabled=true;c.imageSmoothingQuality="high";
   c.drawImage(canvases[variant],x0,y0,sw,sh,(450-w)/2,(260-h)/2,w,h);
   const footer=document.createElement("figcaption");
   footer.textContent="Authentic "+sw+"×"+sh+" source pixels enlarged "+scale.toFixed(2)+"×";
   node.append(title,cv,footer);
   $("matrix").append(node);
  }
 }
 $("status").textContent="Source coordinates and alpha preserved. 12 actual facade crops ready; detail quality needs art review.";
 $("status").dataset.state="ready";
 state={ready:true,sourceHead:"6d40942b82b24d8596ed55af2850454d00a9165b",
  sourceArtBlenderEdited:false,gameZoom:zoom,metersPerWorldUnit:manifest.projection.metersPerWorldUnit,
  originalDoor:manifest.proposedWorldPlacement.door,
  roofBytesChanged:false,visibleVariants:["source","day","dusk"],regions:stats,
  dynamicLightingEngine:false,runtimeIntegrated:false,productionApproved:false};
}catch(error){$("status").textContent="A2.29 blocked: "+error.message;$("status").dataset.state="error";console.error(error);}
