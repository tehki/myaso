import assert from "node:assert/strict";
import {COMBAT} from "../src/combat/model.mjs";
import {verifyM173WorldJumpSpend} from "./m173-world-stamina-proof.mjs";

// Genuine W3C input, original game/QUIC/World, read-only DOM/replica evidence.
// This supplements the legacy M173 fixture with the selected typed-LMB profile.
export async function runNativeJumpStamina({actor,evaluate,request,waitFor,readAuthoritativeWorld}) {
 const session=actor.s,id=actor.actor.id;
 const read=()=>evaluate(session,String.raw`return {
  proof:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null,
  status:document.querySelector('#event-text')?.textContent??'',
  physical:window.__COMBAT4_STAMINA_NATIVE__?.physical??[],
  feedback:window.__COMBAT4_STAMINA_NATIVE__?.feedback??[]};`);
 const own=p=>p?.proof?.replicatedFighters?.find(f=>f.netId===id);
 const command=actions=>request(session.base,"POST","/session/"+session.id+"/actions",{actions});
 const coord=await evaluate(session,String.raw`
  const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();
  const b=c.getBoundingClientRect(),state={physical:[],feedback:[]};
  window.__COMBAT4_STAMINA_NATIVE__=state;
  for(const type of ['keydown','keyup','pointerdown','pointerup'])window.addEventListener(type,e=>{
   if(type.startsWith('key')&&e.code!=='Space')return;
   if(type.startsWith('pointer')&&e.button!==0)return;
   if(state.physical.length<100)state.physical.push({type,trusted:e.isTrusted,epochMs:Date.now()});
  },true);
  const stage=document.querySelector('.arena-stage');
  new MutationObserver(()=>{
   const cue=stage?.dataset.combatFeedback;
   if(cue&&state.feedback.length<100)state.feedback.push({cue,epochMs:Date.now(),
    status:document.querySelector('#event-text')?.textContent??''});
  }).observe(stage,{attributes:true,attributeFilter:['data-combat-feedback']});
  return {focused:document.activeElement===c,x:Math.round(b.left+b.width*.3),y:Math.round(b.top+b.height*.5)};`);
 assert.equal(coord.focused,true);
 await command([{type:"pointer",id:"stamina-pointer",parameters:{pointerType:"mouse"},
  actions:[{type:"pointerMove",origin:"viewport",x:coord.x,y:coord.y,duration:0}]}]);
 const drain=[];
 let ready;
 for(let n=0;n<10;n++) {
  const state=await read(),fighter=own(state);
  assert.equal(state.proof?.transportState,"granted");
  assert.equal(fighter?.hp,100);assert.equal(fighter?.guard,100);
  if(fighter.action===0&&fighter.stamina>=16&&fighter.stamina<=24){ready=state;break;}
  if(fighter.stamina<16) {
   await waitFor(async()=>{const p=await read();return own(p)?.stamina>=18&&p;},1800);
   continue;
  }
  const hold=Math.round(Math.max(300,Math.min(1200,(fighter.stamina-20)*1000/COMBAT.stamina.runDrainPerSecond)));
  drain.push({before:fighter.stamina,hold});
  await command([
   {type:"key",id:"stamina-movement",actions:[{type:"keyDown",value:"a"},{type:"pause",duration:hold},{type:"keyUp",value:"a"}]},
   {type:"pointer",id:"stamina-pointer",parameters:{pointerType:"mouse"},actions:[
    {type:"pointerDown",button:2},{type:"pause",duration:hold},{type:"pointerUp",button:2}]},
  ]);
 }
 assert.ok(ready,"genuine RMB+WASD must establish a server-owned jump-only stamina budget");
 const before=readAuthoritativeWorld().length;
 await command([
  {type:"key",id:"stamina-space",actions:[{type:"keyDown",value:" "},
   {type:"pause",duration:90},{type:"pause",duration:0},{type:"keyUp",value:" "}]},
  {type:"pointer",id:"stamina-pointer",parameters:{pointerType:"mouse"},actions:[
   {type:"pointerDown",button:0},{type:"pause",duration:90},{type:"pointerUp",button:0},{type:"pause",duration:0}]},
 ]);
 await waitFor(async()=>{
  const log=readAuthoritativeWorld().slice(before);
  return new RegExp(`^M201_AUTH_ACTION tick=\\d+ fighter=${id} from=15 to=0$`,"m").test(log);
 },1800);
 const after=await read(),journal=readAuthoritativeWorld().slice(before);
 const spend=verifyM173WorldJumpSpend(journal,id,COMBAT.jump.staminaCost);
 assert.ok(spend.before>=14&&spend.before<26,"actual World budget only affords Jump");
 assert.equal(spend.cost,14,"original Jump spends exactly14, not26");
 assert.ok(!new RegExp(`^M201_AUTH_ACTION tick=\\d+ fighter=${id} from=\\d+ to=(?:1|2|3|16|17|18|21|22|23)$`,"m").test(journal),
  "denied chord cannot become Light, RunningStrike or JumpAttack");
 assert.ok(!/^M201_AUTH_HIT /m.test(journal),"denied chord never produces any World HIT");
 const rows=after.proof.acknowledged.filter(e=>e.source===0&&e.status===1);
 assert.deepEqual(rows.map(e=>e.action),[5,3],"one real typed JumpAttack gesture and its release");
 assert.equal(rows[0].gestureId,rows[1].gestureId);
 assert.deepEqual(after.physical.map(e=>e.type),["keydown","pointerdown","pointerup","keyup"]);
 assert.ok(after.physical.every(e=>e.trusted));
 assert.ok(after.physical[1].epochMs-after.physical[0].epochMs>=0
  &&after.physical[1].epochMs-after.physical[0].epochMs<=60,"genuine approved key-first chord within60ms");
 assert.equal(own(after)?.hp,100);assert.equal(own(after)?.guard,100);
 assert.equal(after.proof.failed,false);assert.equal(after.proof.closed,false);
 // Separately prove a new LMB on an already airborne, exhausted actor.
 // Its 12-stamina denial must not be mislabeled as a new 26-stamina chord.
 const airborneReady=await waitFor(async()=>{
  const p=await read(),f=own(p);return f?.action===0&&f.stamina>=18&&f.stamina<=24&&p;
 },2500);
 const airStart=readAuthoritativeWorld().length;
 const airPhysicalOffset=airborneReady.physical.length,airFeedbackOffset=airborneReady.feedback.length;
 await command([{type:"key",id:"stamina-space",actions:[{type:"keyDown",value:" "},
  {type:"pause",duration:90},{type:"keyUp",value:" "}]}]);
 await waitFor(async()=>{const p=await read();return own(p)?.action===15&&p;},300);
 await command([{type:"pointer",id:"stamina-pointer",parameters:{pointerType:"mouse"},actions:[
  {type:"pointerDown",button:0},{type:"pause",duration:35},{type:"pointerUp",button:0}]}]);
 await waitFor(async()=>new RegExp(`^M201_AUTH_ACTION tick=\\d+ fighter=${id} from=15 to=0$`,"m")
  .test(readAuthoritativeWorld().slice(airStart)),1800);
 const afterAir=await read(),airLog=readAuthoritativeWorld().slice(airStart);
 const airSpend=verifyM173WorldJumpSpend(airLog,id,14);
 assert.equal(airSpend.cost,14);
 assert.ok(new RegExp(`^M201_AUTH_GESTURE_ACTION tick=\\d+ fighter=${id} source=0 gesture=\\d+ sequence=\\d+ eventAction=5 status=1 from=15 to=15$`,"m").test(airLog),
  "new physical LMB must actually reach original World Jump before denial");
 assert.ok(!new RegExp(`^M201_AUTH_ACTION tick=\\d+ fighter=${id} from=\\d+ to=(?:1|2|3|16|17|18|21|22|23)$`,"m").test(airLog));
 assert.ok(!/^M201_AUTH_HIT /m.test(airLog));
 const airRows=afterAir.proof.acknowledged.filter(e=>e.source===0&&e.status===1).slice(rows.length);
 assert.deepEqual(airRows.map(e=>e.action),[5,3]);
 assert.equal(airRows[0].gestureId,airRows[1].gestureId);
 assert.notEqual(airRows[0].gestureId,rows[0].gestureId);
 const airPhysical=afterAir.physical.slice(airPhysicalOffset);
 assert.deepEqual(airPhysical.map(e=>e.type),["keydown","keyup","pointerdown","pointerup"]);
 assert.ok(airPhysical.every(e=>e.trusted));
 assert.ok(airPhysical[2].epochMs-airPhysical[0].epochMs>60,"airborne LMB is a distinct physical attempt");
 assert.equal(own(afterAir)?.hp,100);assert.equal(own(afterAir)?.guard,100);
 const airFeedback=afterAir.feedback.slice(airFeedbackOffset);
 const airborneDenial=airFeedback.filter(e=>e.cue==="stamina-denied");
 return {drain,startingStamina:own(ready).stamina,worldSpend:spend,
  confirmedDenial:after.feedback.filter(e=>e.cue==="stamina-denied").length===1
   &&after.feedback.some(e=>e.cue==="stamina-denied"&&e.status.includes("Low stamina — jump attack needs 26.")),
  after,originalWorldLog:journal,airborne:{worldSpend:airSpend,after:afterAir,
   originalWorldLog:airLog,feedback:airborneDenial,confirmedDenial:airborneDenial.length===1
    &&airborneDenial[0].status.includes("Low stamina — jump attack needs 12.")},
  limitation:"one native actor; no independent human or WAN qualification"};
}
