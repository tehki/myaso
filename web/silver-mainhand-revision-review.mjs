import {KNIGHT_CLIPS,knightPresentationRect} from "./knight-sprites.mjs";
import {createSilverMainHandRevisionGuard} from "../src/browser/silver-mainhand-revision-guard.mjs";
import {drawSilverCommittedSword} from "../src/browser/silver-committed-mainhand-visual.mjs";
const $=id=>document.getElementById(id),canvas=$("source"),ctx=canvas.getContext("2d");
const images=new Map();
for(const clip of ["silver_idle","silver_walk","silver_sprint","silver_roll","silver_jump"]){
 const i=new Image();i.src="./assets/knights/"+clip+".webp";await i.decode();
 if(i.naturalWidth!==KNIGHT_CLIPS[clip]*160||i.naturalHeight!==1280)throw Error("Not original Silver source: "+clip);
 images.set(clip,i);
}
const sword=new Image();
sword.src="../docs/art/silver-mainhand-review/armory_sword_original_3b.webp";
await sword.decode();
if(sword.naturalWidth!==42||sword.naturalHeight!==115)throw Error("Not original 3B sword dimensions");
const reply=await fetch("./assets/knights/silver_hand_anchors_p0.json");
if(!reply.ok)throw Error("Unavailable original owner-rig wrist coordinates");
const anchors=await reply.json();
const actorKey="QA-CHARACTER-202-NOT-A-REAL-LOGIN";
const snapshot=(revision,mainHand,epoch=1,tick=revision*10)=>({
 provenance:"core-items-committed-snapshot",actorKey,
 snapshotRevision:revision,serverTick:tick,sessionEpoch:epoch,mainHand
});
const hand=(id,revision)=>({slot:"MainHand",location:"equipped",visualKind:"sword",
 itemId:id,ownerActorKey:actorKey,revision,committedSequence:revision});
function fixture(name){
 const first=snapshot(10,hand("ART-ONLY-SWORD-A",10),1,200);
 const empty=snapshot(11,null,1,210);
 const newer=snapshot(12,hand("ART-ONLY-SWORD-B",12),1,220);
 const different=snapshot(10,hand("ART-ONLY-SWORD-B",10),1,201);
 const oldWriter=snapshot(999,hand("ART-ONLY-SWORD-A",999),1,9999);
 const newEpoch=snapshot(11,null,2,230);
 const cache=createSilverMainHandRevisionGuard(),inbound=[];
 let latest;
 const take=s=>{const status=cache.ingest(s,actorKey);inbound.push({
   revision:s.snapshotRevision,epoch:s.sessionEpoch,reason:status.reason,
   accepted:status.accepted});latest=s;return status};
 switch(name){
 case "equip":take(first);break;
 case "drop":take(first);take(empty);break;
 case "late":take(first);take(empty);take(first);break;
 case "reEquip":take(first);take(empty);take(newer);break;
 case "conflict":take(first);take(different);break;
 case "oldEpoch":take(first);take(newEpoch);take(oldWriter);break;
 default:throw Error("Unknown QA scenario");
 }
 return {cache,latest,inbound};
}
let latestReport;
function render(){
 const chosen=$("scenario").value,clip=$("clip").value,
   {cache,latest,inbound}=fixture(chosen);
 const rect=knightPresentationRect(clip==="silver_roll",1.2);
 const image=images.get(clip),plans=[];
 ctx.fillStyle="#9aaba3";ctx.fillRect(0,0,1280,395);
 ctx.fillStyle="#1d392f";ctx.font="bold 18px system-ui";
 ctx.fillText("8 original Silver directions · fake Core-shaped data · real 3B sword · stale message rejection",14,34);
 const directions=["S","SW","W","NW","N","NE","E","SE"];
 for(let d=0;d<8;d++){
  const x=79+d*160,y=205;
  const plan=cache.plan({actorKind:"player",actorKey,equipmentSnapshot:latest,
    clip,frame:0,direction:d,anchors});
  plans.push({direction:d,hasSword:Boolean(plan),itemId:plan?.itemId??null});
  ctx.fillStyle="#b5c3b9";ctx.fillRect(d*160+2,91,156,238);
  ctx.fillStyle="#204533";ctx.font="16px system-ui";ctx.textAlign="center";
  ctx.fillText(directions[d],x,112);
  ctx.fillStyle="#82978c";ctx.fillRect(d*160+2,y+6,156,2);
  ctx.save();ctx.translate(x,y);
  if(plan?.drawOrder==="behind-knight")drawSilverCommittedSword(ctx,sword,plan);
  ctx.drawImage(image,0,d*160,160,160,rect.x,rect.y,rect.width,rect.height);
  if(plan?.drawOrder==="in-front-of-knight")drawSilverCommittedSword(ctx,sword,plan);
  ctx.restore();
  ctx.fillStyle="#243d30";ctx.font="12px system-ui";ctx.fillText(plan?"QA ACK / sword":"UNARMED",x,289);
 }
 ctx.fillStyle="#243d2f";ctx.textAlign="left";ctx.font="13px system-ui";
 ctx.fillText("NO REAL WEBTRANSPORT · drop does NOT change equipment here; all received packets are simulated fixtures",12,378);
 const visible=plans.filter(x=>x.hasSword).length;
 const report={scenario:chosen,clip,received:inbound,visible,
  directions:plans,latest:cache.audit(actorKey),originalAtlases:images.size,
  originalSwordPx:[sword.naturalWidth,sword.naturalHeight],
  realGame:false,realReceipts:false,productionEnabled:false};
 latestReport=report;
 $("report").textContent="QA arrival order: "+inbound.map(i=>"rev"+i.revision+"/e"+i.epoch+" "+i.reason).join(" → ")+
  "\nFinal visible sword slots (8 facings): "+visible+" | Render high-water: "+JSON.stringify(report.latest)+
  "\nApproved? NO. Original asset source and gameplay rules unchanged.";
}
$("scenario").addEventListener("change",render);
$("clip").addEventListener("change",render);
window.__GRAPHICS3A_REVISION_QA__=()=>structuredClone(latestReport);
render();