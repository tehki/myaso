// Genuine W3C input and original server stdout only. Never step/edit World.
import assert from "node:assert/strict";
import {COMBAT} from "../src/combat/model.mjs";
import {awaitNativeWorldPhase} from "./native-world-phase-guard.mjs";

export async function runNativeRecoveryBuffer({actors,evaluate,request,readAuthoritativeWorld,waitFor,sleep,save,jumpChord=false}) {
 const a=actors[0],target=actors[1],s=a.s,id=a.actor.id,victim=target.actor.id;
 const proof=()=>evaluate(s,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
 const own=(p,actor)=>p?.replicatedFighters?.find(f=>f.netId===actor);
 const stage=[];
 for(let attempt=0;attempt<8;attempt++) {
  const p=await proof(),f=own(p,id),t=own(p,victim);
  assert.ok(f&&t&&f.action===0&&t.action===0&&Math.abs(f.y-t.y)<8,"real idle horizontal pair required");
  const delta=t.x-f.x-(jumpChord?36:52);
  if(Math.abs(delta)<=5)break;
  assert.equal(await evaluate(s,"const c=document.querySelector('#arena');c.focus();return document.activeElement===c;"),true);
  const key=delta>0?"d":"a",duration=Math.max(20,Math.min(180,Math.round(Math.abs(delta)*1000/COMBAT.moveSpeed)));
  await request(s.base,"POST","/session/"+s.id+"/actions",{actions:[{type:"key",id:"buffer-stage",actions:[
   {type:"keyDown",value:key},{type:"pause",duration},{type:"keyUp",value:key}]}]});
  stage.push({beforeX:f.x,targetX:t.x,key,duration});
  await sleep(320);
 }
 const staged=await proof(),f=own(staged,id),t=own(staged,victim);
 assert.ok(t.x-f.x>=(jumpChord?30:45)&&t.x-f.x<=(jumpChord?42:60),"actual replicas must establish genuine buffered attack reach");
 const pointer=await evaluate(s,`const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();
  const b=c.getBoundingClientRect(),events=[];
  for(const type of ['pointerdown','pointerup','pointercancel','keydown','keyup'])window.addEventListener(type,e=>{
   if((type.startsWith('pointer')&&e.button===0)||e.code==='Space')events.push({type,trusted:e.isTrusted,pointerId:e.pointerId,code:e.code??null,at:performance.now()});},true);
  window.__MYASO_RECOVERY_NATIVE_EDGES__=()=>events.map(e=>({...e}));
  return {x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.5)};`);
 const worldStart=readAuthoritativeWorld().length;
 const lines=()=>readAuthoritativeWorld().slice(worldStart).split(/\r?\n/);
 const actions=()=>lines().flatMap(line=>{
  const m=/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)$/.exec(line);
  return m&&+m[2]===id?[{tick:+m[1],from:+m[3],to:+m[4]}]:[];
 });
 const admissions=()=>lines().flatMap(line=>{
  const m=/^M201_AUTH_GESTURE_ACTION tick=(\d+) fighter=(\d+) source=(\d+) gesture=(\d+) sequence=(\d+) eventAction=(\d+) status=(\d+) from=(\d+) to=(\d+)$/.exec(line);
  return m&&+m[2]===id?[{tick:+m[1],gesture:+m[4],sequence:+m[5],event:+m[6],status:+m[7],from:+m[8],to:+m[9]}]:[];
 });
 const hits=()=>lines().flatMap(line=>{
  const m=/^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)$/.exec(line);
  return m?[{tick:+m[1],attacker:+m[2],target:+m[3],damage:+m[4],hp:+m[5]}]:[];
 });
 const click=()=>request(s.base,"POST","/session/"+s.id+"/actions",{actions:[{type:"pointer",id:"buffer-native",
  parameters:{pointerType:"mouse"},actions:[{type:"pointerDown",button:0},{type:"pointerUp",button:0}]}]});
 await request(s.base,"POST","/session/"+s.id+"/actions",{actions:[{type:"pointer",id:"buffer-native",parameters:{pointerType:"mouse"},
  actions:[{type:"pointerMove",origin:"viewport",x:pointer.x,y:pointer.y,duration:0}]}]});
 try {
  await click();
  // The general 110ms acceptance poll can skip this entire 90ms window.
  // Observe the CURRENT World recovery at 2ms intervals, then issue one click.
  const phase=await awaitNativeWorldPhase({readOutput:readAuthoritativeWorld,
   afterOffset:worldStart,fighterId:id,action:3,minElapsedMs:166.7,sleep,requireEntry:true});
  let jumpStamina=null;
  if(jumpChord) {
   // Space DOWN precedes LMB DOWN within one real W3C request. Keep Space
   // physically held until the original World has consumed its sampled input.
   await request(s.base,"POST","/session/"+s.id+"/actions",{actions:[
    {type:"key",id:"buffer-space",actions:[{type:"keyDown",value:"\uE00D"},{type:"pause",duration:0},{type:"pause",duration:0}]},
    {type:"pointer",id:"buffer-native",parameters:{pointerType:"mouse"},actions:[{type:"pause",duration:0},{type:"pointerDown",button:0},{type:"pointerUp",button:0}]},
   ]});
   jumpStamina=await waitFor(async()=>{
    const p=await proof(),f=own(p,id);
    return f&&[16,17,18].includes(f.action)&&f.stamina===74?{serverTick:p.serverTick,actor:f}:false;
   },5000);
   await request(s.base,"POST","/session/"+s.id+"/actions",{actions:[{type:"key",id:"buffer-space",actions:[{type:"keyUp",value:"\uE00D"}]}]});
  } else { await click(); }
  const accepted=await waitFor(()=>{
   const rows=admissions().filter(e=>e.status===1);
   return rows.length>=4?rows:false;
  },5000);
  const presses=accepted.filter(e=>e.event===1||e.event===5);
  assert.equal(presses.length,2);
  assert.deepEqual([presses[0].from,presses[0].to],[0,1]);
  assert.deepEqual([presses[1].from,presses[1].to],[3,3],"second genuine press must enter the ORIGINAL recovery buffer");
  assert.equal(presses[1].event,jumpChord?5:1);
  assert.notEqual(presses[0].gesture,presses[1].gesture);
  await waitFor(()=>hits().filter(h=>h.attacker===id).length===2,5000);
  await waitFor(()=>actions().some(e=>e.from===(jumpChord?18:3)&&e.to===0&&e.tick>presses[1].tick),5000);
  await sleep(250);
  const recovery=actions().find(e=>e.to===3),next=actions().find(e=>e.from===3&&e.to===(jumpChord?16:1));
  assert.ok(recovery&&next&&next.tick-recovery.tick>=16,"original 255ms recovery cannot be shortened");
  if(jumpChord) {
   const jumpRecovery=actions().find(e=>e.from===17&&e.to===18),jumpExit=actions().find(e=>e.from===18&&e.to===0);
   assert.ok(jumpRecovery&&jumpExit);
   assert.equal(jumpExit.tick-jumpRecovery.tick,27,"owner's full450ms JumpAttack recovery remains27 real World ticks");
  }
  assert.deepEqual(hits().map(h=>[h.attacker,h.target,h.damage,h.hp]),[[id,victim,34,66],[id,victim,jumpChord?42:34,jumpChord?24:32]],"exactly two original hits; no Heavy, duplicate or collateral");
  assert.equal(actions().filter(e=>e.to===2).length,jumpChord?1:2);
  if(jumpChord)assert.equal(actions().filter(e=>e.to===17).length,1);
  assert.equal(accepted.filter(e=>e.event===2).length,0,"a tap cannot acquire a Heavy upgrade");
  const physical=await evaluate(s,"return window.__MYASO_RECOVERY_NATIVE_EDGES__();");
  assert.deepEqual(physical.map(e=>e.type),jumpChord?['pointerdown','pointerup','keydown','pointerdown','pointerup','keyup']:['pointerdown','pointerup','pointerdown','pointerup']);
  assert.ok(physical.every(e=>e.trusted));
  assert.ok(physical.filter(e=>e.type.startsWith('pointer')).every(e=>e.pointerId===physical[0].pointerId));
  const replicas=await waitFor(async()=>{
   const rows=await Promise.all(actors.map(async a=>({id:a.actor.id,browser:a.s.engine,...await evaluate(a.s,
    "return {hp:Number(document.querySelector('#player-hp-value')?.textContent),roster:document.querySelectorAll('#scoreboard-list li').length,proof:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null};")})));
   return rows.every(r=>r.hp===(r.id===victim?(jumpChord?24:32):100)&&r.roster===4&&!r.proof?.failed&&!r.proof?.closed)?rows:false;
  },8000);
  const evidence={sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||'local',attackerBrowser:s.engine,
   id,victim,stage,phase,jumpChord,jumpStamina,physical,admissions:accepted,actions:actions(),hits:hits(),replicas,
   originalWorld:true,originalGame:true,independentHumanHosts:false};
  await save(jumpChord?'combat4-native-recovery-jump.json':'combat4-native-recovery-buffer.json',evidence);
  console.log(jumpChord?'COMBAT4_NATIVE_RECOVERY_JUMP_PASS':'COMBAT4_NATIVE_RECOVERY_BUFFER_PASS',JSON.stringify({browser:s.engine,id,victim,hits:hits(),recovery,next,jumpStamina}));
 } catch(error) {
  await save('combat4-native-recovery-buffer-FIRST-RED.json',{error:String(error),world:lines(),proof:await proof().catch(()=>null)});
  throw error;
 }
}
