import { COMBAT_ACTION } from "../src/browser/combat-readability.mjs";
import { KNIGHT_CLIPS,createKnightSpriteRenderer } from "./knight-sprites.mjs";
const $=id=>document.getElementById(id);
const canvas=$("source"),ctx=canvas.getContext("2d");
const sprites=createKnightSpriteRenderer();
const expected=Object.keys(KNIGHT_CLIPS);
const scenarios={
 idle:COMBAT_ACTION.idle,
 roll:COMBAT_ACTION.dodge,
 attack:COMBAT_ACTION.attackActive,
 block:COMBAT_ACTION.block,
 stun:COMBAT_ACTION.stunned,
 dead:COMBAT_ACTION.dead,
};
const actors=[
 {name:"Human 1 LOCAL",kind:"player",remote:false,netId:1},
 {name:"Human 2 REMOTE",kind:"player",remote:true,netId:2},
 {name:"Human 3 REMOTE",kind:"player",remote:true,netId:3},
 {name:"NPC TYPE FIXTURE",kind:"npc",remote:true,netId:4},
 {name:"Human unavailable clip",kind:"player",remote:true,netId:5,forced:COMBAT_ACTION.attackActive},
 {name:"UNKNOWN ROLE FALLBACK",kind:null,remote:true,netId:6},
];
let ready=false,drawn=[],renders=0;
const nativeDraw=ctx.drawImage.bind(ctx);
ctx.drawImage=(image,...args)=>{
 drawn.push({actor:currentActor,filename:new URL(image.src).pathname.split("/").at(-1),
  sourceX:args[0],sourceY:args[1]});
 return nativeDraw(image,...args);
};
let currentActor="";
function draw(){
 const facing=Number($("facing").value);
 const scenario=$("scenario").value;
 ctx.fillStyle="#89958c";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.font="bold 17px system-ui";ctx.fillStyle="#23342d";
 ctx.fillText("QA visual roles: 3 humans = SILVER; only explicit NPC-type QA fixture = T1",15,30);
 ctx.font="14px system-ui";ctx.fillStyle="#394b40";
 ctx.fillText("This is NOT an authenticated multiplayer flight, nor an inventory/equipment state",15,54);
 drawn=[];
 const results=[];
 for(let i=0;i<actors.length;i++){
  const a=actors[i],x=185+i%3*365,y=i<3?192:405;
  const fighter={netId:a.netId,x:200+a.netId,y:120,
    facing:Math.PI/2+facing*Math.PI/4,
    action:a.forced??scenarios[scenario]};
  const before=drawn.length;
  ctx.save();ctx.translate(x,y);
  currentActor=a.name;
  const did=sprites.draw(ctx,fighter,{
    remote:a.remote,actorKind:a.kind,rotation:0,nowMs:1000});
  if(!did){
   ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);
   ctx.fillStyle="#dcab7b";ctx.fill();
   ctx.fillStyle="#412e28";ctx.fillRect(8,-2,30,4);
  }
  ctx.restore();
  results.push({name:a.name,kind:a.kind,remote:a.remote,
    drawn:did,assets:drawn.slice(before).map(z=>z.filename)});
  ctx.fillStyle="#24372e";ctx.textAlign="center";
  ctx.font="14px system-ui";ctx.fillText(a.name,x,y+53);
  ctx.textAlign="left";
 }
 ctx.fillStyle="#283e32";ctx.font="14px system-ui";
 ctx.fillText("Human fighter roles are explicit QA fixtures; remote/local is never used as actor kind.",15,502);
 renders++;
 window.__ALPHA_ROLE_QA__=()=>({
  ready,decoded:sprites.loaded(),scenario,direction:facing,
  drawCount:drawn.length,drawn:[...drawn],results,
  humanRoles:["player","player","player"],npcPilotEnabled:false,
  realServerConnected:false,authoritativeInventory:false,
  activeGameRenderer:false,approved:false,renders,
 });
}
await new Promise((resolve,reject)=>{
 let count=0;
 const tick=()=>{
  const decoded=sprites.loaded();
  if(expected.every(name=>decoded.includes(name))){ready=true;resolve();return;}
  if(++count>200){reject(new Error("Missing original knight sprite WebP decode"));return;}
  setTimeout(tick,50);
 };
 tick();
});
$("status").textContent="9/9 original WebPs decoded - source roster preview ready";
for(const id of ["facing","scenario"])$(id).addEventListener("change",draw);
draw();
