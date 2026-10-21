import {KNIGHT_CLIPS,knightPresentationRect} from "./knight-sprites.mjs";
import {planSilverCommittedSword,drawSilverCommittedSword,
 SILVER_MAINHAND_REVIEW} from "../src/browser/silver-committed-mainhand-visual.mjs";
const $=id=>document.getElementById(id);
const canvas=$("sheet"),ctx=canvas.getContext("2d");
const spriteNames=["silver_idle","silver_walk","silver_sprint","silver_jump","silver_roll"];
const art=new Map();
const load=async (name,url)=>{
 const img=new Image();
 img.src=url;await img.decode();
 return img;
};
for(const clip of spriteNames){
 const image=await load(clip,"./assets/knights/"+clip+".webp");
 if(image.naturalWidth!==KNIGHT_CLIPS[clip]*160||image.naturalHeight!==8*160)
  throw Error("Knight source dimensions mismatch "+clip);
 art.set(clip,image);
}
const sword=await load("sword","../docs/art/silver-mainhand-review/armory_sword_original_3b.webp");
if(sword.naturalWidth!==42||sword.naturalHeight!==115)throw Error("3B sword image dimensions wrong");
const response=await fetch("./assets/knights/silver_hand_anchors_p0.json");
if(!response.ok)throw Error("Missing source-wrist anchors");
const anchors=await response.json();
if(anchors.sourceBone!=="mixamorig:RightHand"||anchors.humanArtApproved!==false)
 throw Error("Unverified anchor source");
const actorKey="ART-QA-FAKE-ACTOR-NOT-REAL";
const committedFixture=Object.freeze({
 provenance:"core-items-committed-snapshot",actorKey,
 snapshotRevision:3,serverTick:321,
 mainHand:{slot:"MainHand",location:"equipped",visualKind:"sword",
  itemId:"ART-QA-ONLY-NO-CANONICAL-ID",ownerActorKey:actorKey,
  revision:1,committedSequence:1}
});
const pendingFixture={...committedFixture,provenance:"client-click-pending"};
const directions=["S","SW","W","NW","N","NE","E","SE"];
let renders=0,last=[],playing=false,started=0,lastSample=0;
function render(){
 const clip=$("clip").value,frame=Number($("frame").value),count=KNIGHT_CLIPS[clip];
 ctx.fillStyle="#879991";ctx.fillRect(0,0,1280,570);
 ctx.fillStyle="#1b3029";ctx.font="bold 19px system-ui";
 ctx.fillText("SOURCE ART ONLY — no authenticated item or true gameplay renderer",14,28);
 ctx.font="14px system-ui";
 ctx.fillText("Every column is an original 8-way view | top = empty MainHand | bottom = simulated equipment snapshot",14,49);
 const actorImage=art.get(clip);
 last=[];
 for(let dir=0;dir<8;dir++){
  const x=80+dir*160;
  ctx.fillStyle="#213e30";ctx.textAlign="center";ctx.font="bold 18px system-ui";
  ctx.fillText(directions[dir],x,83);
  for(let row=0;row<2;row++){
   const y=192+row*215;
   ctx.fillStyle=row?"#bccabe":"#acbcb2";
   ctx.fillRect(dir*160+3,y-94,155,172);
   ctx.strokeStyle="#718c81";ctx.strokeRect(dir*160+3,y-94,155,172);
   ctx.fillStyle="#718980";ctx.fillRect(dir*160+5,y+2,151,1);
   const snapshot=row?($("receipt").value==="committed"?committedFixture:pendingFixture)
                     :{...committedFixture,mainHand:null};
   const plan=planSilverCommittedSword({
    actorKind:"player",actorKey,equipmentSnapshot:snapshot,
    clip,frame,direction:dir,anchors});
   ctx.save();ctx.translate(x,y);
   const rect=knightPresentationRect(clip==="silver_roll",1.2);
   if(plan?.drawOrder==="behind-knight")
     drawSilverCommittedSword(ctx,sword,plan);
   ctx.drawImage(actorImage,frame*160,dir*160,160,160,
     rect.x,rect.y,rect.width,rect.height);
   if(plan?.drawOrder==="in-front-of-knight")
     drawSilverCommittedSword(ctx,sword,plan);
   ctx.restore();
   ctx.fillStyle="#21392c";ctx.textAlign="center";ctx.font="12px system-ui";
   ctx.fillText(row?(plan?"SYNTHETIC ACK":
     (snapshot.provenance==="core-items-committed-snapshot"?"POSE HOLD":"PENDING: NO SWORD"))
       :"EMPTY MAINHAND",x,y+84);
   last.push({direction:dir,row,heldSword:Boolean(plan),
     itemId:plan?.itemId||null,clip,frame});
  }
 }
 ctx.font="13px system-ui";ctx.fillStyle="#293e36";ctx.textAlign="left";
 ctx.fillText("VISUAL HOLD: source art only; jump and roll sword attachment intentionally disabled after failed visual inspection",10,560);
 $("readout").textContent=(frame+1)+"/"+count;
 renders++;
}
$("clip").addEventListener("change",()=>{
 const max=KNIGHT_CLIPS[$("clip").value]-1;
 $("frame").max=String(max);$("frame").value="0";
 render();
});
$("frame").addEventListener("input",render);
$("receipt").addEventListener("change",render);
$("play").addEventListener("click",()=>{
 playing=!playing;$("play").textContent=playing?"Pause source loop":"Play source loop";
 if(playing){started=performance.now();lastSample=Number($("frame").value);}
});
function animate(now){
 if(playing){
  const frames=KNIGHT_CLIPS[$("clip").value];
  const interval=$("clip").value==="silver_roll"?350/frames:110;
  const f=(lastSample+Math.floor((now-started)/interval))%frames;
  if(Number($("frame").value)!==f){$("frame").value=String(f);render();}
 }
 requestAnimationFrame(animate);
}
window.__GRAPHICS3A_HELD_SWORD_QA__=()=>({
 ready:true,sourceAtlases:art.size,swordSourcePx:[sword.naturalWidth,sword.naturalHeight],
 data:structuredClone(last),clip:$("clip").value,frame:Number($("frame").value),
 receipt:$("receipt").value,renders,sourceSha256:SILVER_MAINHAND_REVIEW.swordSourceSha256,
 realServer:false,authenticatedItems:false,realGameplay:false,
 humanVisualApproved:false,alteredCombat:false
});
$("ready").textContent="5 Silver atlases + original 3B sword + original rig anchors loaded";
render();
requestAnimationFrame(animate);