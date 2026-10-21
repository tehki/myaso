// Standalone deterministic visual acceptance; original first-party WebP atlases.
// The actual PR #326 renderer is used unchanged for both scales.
import {COMBAT_ACTION} from "../src/browser/combat-readability.mjs";
import {createKnightSpriteRenderer, KNIGHT_PRESENTATION_SCALE,
  knightPresentationRect} from "./knight-sprites.mjs";

const $=id=>document.getElementById(id);
const renderers={
  old:createKnightSpriteRenderer({presentationScale:1}),
  new:createKnightSpriteRenderer({presentationScale:KNIGHT_PRESENTATION_SCALE})
};
const pos={x:240,y:220}; // artificial review origin, same for both canvases
const readout=$("ready");
const options=new Set(["idle","silver_roll","t1_roll"]);
let current=null, draws=0;
function artBackground(ctx){
  ctx.fillStyle="#263d43";ctx.fillRect(0,0,480,400);
  ctx.strokeStyle="rgba(226,235,225,.12)";
  ctx.lineWidth=1;
  for(let x=0;x<=480;x+=32){
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,400);ctx.stroke();
  }
  for(let y=0;y<=400;y+=32){
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(480,y);ctx.stroke();
  }
}
function fighterDraw(ctx,renderer,fighter,remote,ms){
  ctx.save();ctx.translate(pos.x,pos.y);
  const success=renderer.draw(ctx,fighter,{remote,actorKind:fighter.previewActorKind,nowMs:ms,rotation:0});
  ctx.restore();
  if(!success)throw new Error("Expected real knight atlas to be decoded");
}
function crosshair(ctx){
  ctx.lineWidth=2;ctx.strokeStyle="#fcd27f";
  ctx.beginPath();
  ctx.moveTo(pos.x-8,pos.y);ctx.lineTo(pos.x+8,pos.y);
  ctx.moveTo(pos.x,pos.y-8);ctx.lineTo(pos.x,pos.y+8);
  ctx.stroke();
}
function view(kind,pose){
  const ctx=$(kind).getContext("2d",{alpha:false});
  artBackground(ctx);
  const remote=pose==="t1_roll";
  const rolling=pose!=="idle";
  const fighter={x:200,y:180,facing:Math.PI/2,
    action:rolling?COMBAT_ACTION.dodge:COMBAT_ACTION.idle,
    previewActorKind:pose==="t1_roll"?"npc":"player",
    ...(remote?{netId:15}:{})};
  if(rolling){
    // Prime the real renderer's roll state on a disposable surface;
    // draw only the exact same 160ms mid-roll frame in both comparisons.
    const scratch=document.createElement("canvas");
    scratch.width=480;scratch.height=400;
    fighterDraw(scratch.getContext("2d"),renderers[kind],fighter,remote,1000);
    fighter.action=COMBAT_ACTION.dodgeRecovery;
    fighterDraw(ctx,renderers[kind],fighter,remote,1160);
  }else fighterDraw(ctx,renderers[kind],fighter,remote,1000);
  crosshair(ctx);
  const rect=knightPresentationRect(rolling,kind==="old"?1:1.2);
  $(kind+"-size").textContent=rect.width+" × "+rect.height+" px";
  ctx.font="14px system-ui";ctx.fillStyle="#e5e4d7";
  ctx.fillText(kind==="old"?"BASELINE 100%":"APPROVED 120%",18,30);
  ctx.font="12px system-ui";ctx.fillStyle="#c7d4d1";
  ctx.fillText("A3 presentation 350ms · fighter center unchanged",18,48);
  return rect;
}
function paint(){
  if(!options.has($("pose").value))throw Error("Unknown pose");
  const pose=$("pose").value;
  const old=view("old",pose),approved=view("new",pose);
  draws++;
  readout.dataset.state="ready";
  readout.textContent="Source atlases ready · "+pose+" · "+old.width+" → "+approved.width+
    " px; +20% approved · both world origins unchanged";
  current={pose,baseline:old,approved,loadedAtlases:{
    baseline:renderers.old.loaded().length,approved:renderers.new.loaded().length
  },draws,gameplayAltered:false,anatomicalFootPivotVerified:false};
}
$("pose").addEventListener("change",paint);
window.__knightA211Preview=()=>({state:readout.dataset.state,...current,
  visualScaleApproved:1.2,rollDurationMs:350,
  serverAuthorityChanged:false,hitboxesChanged:false});
let tries=0;
function ready(){
  if(renderers.old.loaded().length===9 && renderers.new.loaded().length===9){
    try{paint();}catch(e){readout.textContent=e.message;readout.dataset.state="error";}
    return;
  }
  if(++tries>300){readout.dataset.state="error";readout.textContent="Atlas decode timeout";return;}
  requestAnimationFrame(ready);
}
ready();
