import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../src/browser/arena-viewport.mjs";
const root="../assets/environment/greyhaven/";
const $=name=>document.getElementById(name);
async function json(path){const r=await fetch(new URL(path,import.meta.url),{cache:"no-store"});if(!r.ok)throw Error("Fetch "+r.status+" "+path);return r.json();}
async function png(path){const i=new Image();i.src=new URL(path,import.meta.url).href;await i.decode();return i;}
window.__a230Review=()=>state;
let state;
try{
 const [report,verified,manifest,knights]=await Promise.all([
   json(root+"a230-review/greyhaven_a230_material_validation.json"),
   json(root+"a230-review/greyhaven_a230_original_source_integrity.json"),
   json(root+"red-lion-a225-architecture-handoff.json"),
   json("/__a230_knights__/asset-build-report.json")
 ]);
 if(ARENA_VIEW_ZOOM!==0.84||manifest.projection.cameraZoom!==ARENA_VIEW_ZOOM||
    manifest.projection.metersPerWorldUnit!==.025||
    !verified.allOriginalMeshCoordinatesAndMaterialsUnchanged||!verified.originalRoofMeshUnchanged||
    !report.roofWebp.copiedByteIdentical||report.productionApproved||
    JSON.stringify(report.sourceDoorPivotPx)!=="[320,320]"||
    report.newMeshCount!==35)throw Error("Source/model/XY integrity mismatch");
 const images={
  baseline:await png(root+"a230-review/"+report.baselineWebp.file),
  dimensional:await png(root+"a230-review/"+report.baseWebp.file),
  roof:await png(root+"a230-review/"+report.roofWebp.file),
  knight:await png("/__a230_knights__/silver_idle.webp")
 };
 if(images.baseline.naturalWidth!==228||images.dimensional.naturalWidth!==228||
    images.baseline.naturalHeight!==297||images.dimensional.naturalHeight!==297||
    images.roof.naturalWidth!==238||images.roof.naturalHeight!==197||
    images.knight.naturalWidth!==640||images.knight.naturalHeight!==1280||
    knights.silver_idle.outputFrameSize!==160||knights.silver_idle.frames!==4)
  throw Error("Actual model, roof or original Knight sheet dimensions incorrect");
 const door=manifest.proposedWorldPlacement.door;
 let pending=false;
 function draw(){
  pending=false;
  const east=Number($("east").value),south=Number($("south").value),opacity=Number($("roof").value)/100;
  const p=projectArenaPoint(door.x+east,door.y+south,door.x,door.y,640,640);
  const results={};
  for(const mode of ["baseline","dimensional"]){
   const c=$(mode).getContext("2d",{willReadFrequently:true});
   c.fillStyle="#677a6b";c.fillRect(0,0,640,640);
   c.strokeStyle="rgba(231,228,192,.17)";
   for(let n=0;n<640;n+=32){c.beginPath();c.moveTo(n,0);c.lineTo(n,640);c.moveTo(0,n);c.lineTo(640,n);c.stroke();}
   c.drawImage(images[mode],206,51);
   c.drawImage(images.knight,0,0,160,160,p.x-48,p.y-62.4,96,96);
   c.save();c.globalAlpha=opacity;c.drawImage(images.roof,201,37);c.restore();
   results[mode]=c.getImageData(0,0,640,640).data;
  }
  let changed=0,alpha=0;
  for(let i=0;i<results.baseline.length;i+=4){
   if(results.baseline[i+3]!==results.dimensional[i+3])alpha++;
   if([0,1,2].some(j=>results.baseline[i+j]!==results.dimensional[i+j]))changed++;
  }
  state={ready:true,dx:east,dy:south,roofOpacity:opacity,pointXY:[p.x,p.y],
   sourceHead:"e4d718be52a5ee3816704cdd5afbb2700c465ad9",
   originalBlenderSourceIntegrity:true,newSourceMeshes:verified.extraMeshCount,
   roofUnchanged:true,changedOnScreenRGBPixels:changed,
   onScreenAlphaDifferences:alpha,gameXYErrorPx:Math.hypot(p.x-(320+east*.84),p.y-(320+south*.84)),
   originalKnightSha256:"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4",
   actualGameRendererValidated:false,automaticOcclusionValidated:false,authoritativePortalValidated:false,
   productionApproved:false};
  $("eastVal").textContent=String(east);$("southVal").textContent=String(south);
  $("roofVal").textContent=(opacity*100).toFixed(0)+"%";
  $("status").textContent="Exact original source XY and 35 genuine added Blender meshes verified; unchanged historical roof.";
  $("status").dataset.state="ready";
 }
 for(const id of ["east","south","roof"])$(id).addEventListener("input",()=>{if(!pending){pending=true;requestAnimationFrame(draw);}});
 requestAnimationFrame(draw);
}catch(err){$("status").textContent="Blocked: "+err.message;$("status").dataset.state="error";console.error(err);}
