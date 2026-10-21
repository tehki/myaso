import {ARMORY_RACK_ART,createBlacksmithRackVisualPlan,hitTestVisibleSwordAlpha} from "../src/browser/armory-rack-visual.mjs";
const $=id=>document.getElementById(id);
const canvas=$("armory"),ctx=canvas.getContext("2d");
const images={};
async function img(path){const i=new Image();i.src=path;await i.decode();return i;}
let state=null,internal=null;
window.__armoryReview=()=>state;
try{
 [images.rack,images.sword]=await Promise.all([
  img(ARMORY_RACK_ART.rackSource),img(ARMORY_RACK_ART.swordSource)
 ]);
 if(images.rack.width!==240||images.rack.height!==166||
    images.sword.width!==42||images.sword.height!==115)throw Error("Source Blender sprite dimensions invalid");
 const alphaCanvas=document.createElement("canvas");
 alphaCanvas.width=42;alphaCanvas.height=115;
 const ac=alphaCanvas.getContext("2d",{willReadFrequently:true});
 ac.drawImage(images.sword,0,0);
 const pix=ac.getImageData(0,0,42,115).data;
 const alpha=(asset,u,v)=>asset===ARMORY_RACK_ART.swordSource&&u>=0&&v>=0&&u<42&&v<115?
  pix[(v*42+u)*4+3]:0;
 let high=null;
 for(let y=20;y<110&&!high;y++)for(let x=5;x<37;x++){
  if(alpha(ARMORY_RACK_ART.swordSource,x,y)>245){high={x,y};break;}
 }
 if(!high)throw Error("Sword has no opaque source pixels");
 // This fixture is deliberately confined to an art preview, never imported into
 // the production module, World map or gameplay. Four IDs explicitly NOT REAL.
 const building={id:"smith",x:3710,y:3850,w:182,h:162};
 const rack={buildingId:"smith",version:"ART-ONLY-NO-APPROVAL",
   zoneId:"ART-DEMO-NO-SERVER",origin:{x:4000,y:4000},
   sockets:[-72,-24,24,72].map((dx,i)=>({
     id:"PREVIEW-SOCKET-"+i,worldX:4000+dx,worldY:3956
   }))};
 let items=rack.sockets.map((s,i)=>({itemId:"DEMO-SWORD-NOT-SERVER-"+i,
   socketId:s.id,zoneId:rack.zoneId,visualKind:"sword",location:"rack",revision:0}));
 let hovered=null,clicks=0,attacks=0,pickups=0,logged=[];
 function render(){
  const plan=createBlacksmithRackVisualPlan({building,rack,committedWorldItems:items,camera:{x:4000,y:4000}});
  ctx.fillStyle="#536453";ctx.fillRect(0,0,640,640);
  ctx.fillStyle="#56665c";
  for(let i=0;i<640;i+=40){ctx.fillRect(i,382,1,240);ctx.fillRect(0,i,640,1);}
  ctx.fillStyle="#2a302b";ctx.fillRect(128,428,385,14);
  ctx.fillStyle="#d4b28a";ctx.font="15px system-ui";
  ctx.fillText("PREVIEW ONLY · BLACKSMITH / ARMORY",150,115);
  ctx.drawImage(images.rack,plan.rack.x,plan.rack.y,plan.rack.width,plan.rack.height);
  for(const sword of plan.swords){
   ctx.drawImage(images.sword,sword.x,sword.y,sword.width,sword.height);
   if(hovered===sword.id){
    ctx.save();ctx.strokeStyle="#fbe0a6";ctx.lineWidth=1.2;
    ctx.strokeRect(sword.x,sword.y,sword.width,sword.height);ctx.restore();
   }
  }
  ctx.fillStyle="#f0e2c0";ctx.font="13px monospace";
  ctx.fillText("Server ownership: NOT CONNECTED",134,475);
  ctx.fillText("World rack sockets: UNAPPROVED",134,496);
  internal=plan;
  state={ready:true,renderedSwordCount:plan.count,shownSwordIds:plan.swords.map(s=>s.id),
   swordRects:plan.swords.map(s=>({itemId:s.id,x:s.x,y:s.y,width:s.width,height:s.height})),
   rackAssetSource:ARMORY_RACK_ART.rackSource,swordAssetSource:ARMORY_RACK_ART.swordSource,
   swordAlphaTestPixel:high,worldSocketCoordinatesApproved:false,
   serverConnected:false,serverPickupCommitted:false,combatSuppressed:false,
   mockArtOnly:true,hoveredCandidate:hovered,clickCandidateCount:clicks,
   attackCount:attacks,pickupRequestCount:pickups,clickLog:[...logged],
   sourceImageAlphaHitsOnly:true,productionApproved:false};
 }
 function point(event){
  const rect=canvas.getBoundingClientRect();
  return {x:(event.clientX-rect.left)*640/rect.width,
    y:(event.clientY-rect.top)*640/rect.height};
 }
 const hit=event=>hitTestVisibleSwordAlpha(internal,point(event),alpha);
 canvas.addEventListener("pointermove",e=>{
  const candidate=hit(e),next=candidate?.itemId??null;
  if(hovered!==next){hovered=next;render();}
 });
 canvas.addEventListener("pointerleave",()=>{hovered=null;render();});
 canvas.addEventListener("click",e=>{
  const candidate=hit(e);
  if(candidate) {clicks++;logged.push({itemId:candidate.itemId,
    visualCandidateOnly:true,serverPickupCommitted:false,clientEquip:false});}
  $("status").textContent=candidate?
    "Opaque sword pixel detected. ART-ONLY candidate "+candidate.itemId+
    ". NO pickup sent; no Combat input changed.":
    "No sword alpha hit: rack/background/transparent pixel, no candidate.";
  render();
 });
 $("hideOne").addEventListener("click",()=>{items=items.slice(0,3);hovered=null;render();});
 $("showAll").addEventListener("click",()=>{
  items=rack.sockets.map((s,i)=>({itemId:"DEMO-SWORD-NOT-SERVER-"+i,
    socketId:s.id,zoneId:rack.zoneId,visualKind:"sword",location:"rack",revision:0}));
  hovered=null;render();
 });
 render();$("status").dataset.ready="1";
 $("status").textContent="Four independent original Blender sword sprites ready: hover real opaque pixels.";
}catch(e){$("status").textContent="Art QA blocked: "+e.message;console.error(e);}
