// Main 0: original first-party Silver game PAGE + gestureLab real Chrome/Firefox to actual 60Hz Rust World (NONRELEASE).
// Original playable arena only. No fake actors, packets, Silver artwork or Combat authority.
import assert from "node:assert/strict";
import {spawn, spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve, join, extname, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
import {COMBAT} from "../../src/combat/model.mjs";
import {runNativeRecoveryBuffer} from "../../scripts/native-recovery-buffer.mjs";
import {hasOriginalWorldActionTransition as worldTransition, classifyOriginalWorldJumpAttackEntry} from "../../src/combat/original-world-action-trace.mjs";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const engines=(process.env.MYASO_LIVE_GESTURE_NATIVE_BROWSERS||"chrome,chrome,chrome,chrome").split(",");
const physicalMode=process.env.MYASO_LIVE_GESTURE_PHYSICAL_MODE||"original";
const chatC1=process.env.MYASO_LIVE_GESTURE_CHAT_C1==="1";
const instantLmb=process.env.MYASO_LIVE_GESTURE_INSTANT_LMB==="1";
assert.ok(!instantLmb||!["private-hit","space-guard"].includes(physicalMode),"select a release-profile Combat acceptance mode");
assert.ok(["original","held-lmb","recovery-buffer","four-combat-lifecycle","private-hit","space-guard","jump-review","jump-two-hit"].includes(physicalMode),"unknown physical gesture acceptance mode");
assert.equal(engines.length,4,"four distinct genuine browser sessions required");
assert.ok(engines.every(x=>x==="chrome"||x==="firefox"),"unknown W3C browser engine");
const output=resolve(process.env.MYASO_LIVE_GESTURE_NATIVE_OUT||join(root,".artifacts","main0-knights-combat-gesture"));
const sha=x=>createHash("sha256").update(x).digest("hex");
const sleeps=ms=>delay(ms);
const processes=[];
const sessions=[];
let http;
async function request(base,method,path,data,timeoutMs=15000){
 const res=await fetch(base+path,{method,headers:data===undefined?undefined:{"content-type":"application/json"},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(timeoutMs)});
 let result;try{result=await res.json();}catch{result=null;}
 if(!res.ok)throw Error(method+" "+path+" "+res.status+" "+JSON.stringify(result).slice(0,300));
 return result;
}
async function waitFor(test,deadlineMs=16000){
 const end=Date.now()+deadlineMs;let last;
 while(Date.now()<end){try{let result=await test();if(result)return result;}catch(e){last=String(e)}await sleeps(110)}
 throw Error("genuine native condition timeout "+String(last||""));
}
function driverBinary(engine){return engine==="chrome"?(process.env.CHROMEDRIVER_BINARY||"chromedriver"):(process.env.GECKODRIVER_BINARY||"geckodriver")}
async function freePort(){const x=createServer();await new Promise(ok=>x.listen(0,"127.0.0.1",ok));const p=x.address().port;await new Promise(ok=>x.close(ok));return p}
async function startW3C(engine,index){
 const port=await freePort(),binary=driverBinary(engine);
 const child=spawn(binary,engine==="chrome"?["--port="+port]:["--host","127.0.0.1","--port",String(port)],{cwd:root,stdio:"ignore"});
 processes.push(child);
 const base="http://127.0.0.1:"+port;
 await waitFor(async()=>{if(child.exitCode!==null)throw Error(binary+" exited "+child.exitCode);try{return (await request(base,"GET","/status")).value?.ready===true;}catch{return false}},15000);
 const options=engine==="chrome"?
  {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,720","--disable-background-timer-throttling"]}}:
  {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],prefs:{"layout.frame_rate":60}}};
 const created=await request(base,"POST","/session",{capabilities:{alwaysMatch:options}},engine==="firefox"?60000:30000);
 const id=created.value?.sessionId||created.sessionId;
 assert.ok(id,"genuine driver session required");
 const s={engine,index,id,base};sessions.push(s);
 await request(base,"POST","/session/"+id+"/timeouts",{script:15000,pageLoad:30000,implicit:0});
 return s;
}
async function evaluate(s,source){return (await request(s.base,"POST","/session/"+s.id+"/execute/sync",{script:source,args:[]})).value}
async function startOriginalRust(){
 const bin=join(root,"server","target","debug","myaso-server");
 const build=spawnSync("cargo",["build",...(physicalMode==="private-hit"?["--features","experimental-hit-delivery-lab"]:[]),...(process.env.MYASO_LIVE_GESTURE_CARGO_OFFLINE==="0"?[]:["--offline"]),"--locked","--manifest-path","server/Cargo.toml","--bin","myaso-server","--quiet"],{cwd:root,encoding:"utf8",timeout:150000});
 if(build.status!==0)throw Error("exact source local Rust build failed: "+String(build.stderr||build.error).slice(-1900));
 const child=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",MYASO_CHAT_C1_ENABLED:chatC1?"1":"0",MYASO_INSTANT_LMB_ENABLED:instantLmb?"1":"0",MYASO_EXPERIMENTAL_GESTURE_V2:instantLmb?"0":"1",MYASO_EXPERIMENTAL_JUMP_ATTACK_V2:!instantLmb&&["jump-review","jump-two-hit"].includes(physicalMode)?"1":"0",MYASO_FLIGHT_ACTION_PROOF:"1",...(physicalMode==="private-hit"?{MYASO_EXPERIMENTAL_HIT_DELIVERY_LAB:"1"}:{MYASO_EXPERIMENTAL_HIT_DELIVERY_LAB:"0"})},stdio:["ignore","pipe","pipe"]});
 processes.push(child);let buffer="",err="";
 child.stdout.on("data",d=>buffer+=d.toString());
 child.stderr.on("data",d=>err+=d.toString());
 const v=await waitFor(()=>{if(child.exitCode!==null)throw Error("Rust server exit "+err);const url=buffer.match(/listening on (https:\/\/[^\s]+)/)?.[1];const cert=buffer.match(/development certificate SHA-256:\s*([0-9a-fA-F:]+)/)?.[1]?.replaceAll(":","").toLowerCase();return url&&cert?.length===64?{url,cert}:null},30000);
 return {...v,readAuthoritativeWorld:()=>buffer};
}
const types={".html":"text/html;charset=utf-8",".mjs":"text/javascript;charset=utf-8",".js":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",".webp":"image/webp",".png":"image/png",".mp3":"audio/mpeg",".json":"application/json"};
async function startStatic(){
 http=createServer(async(req,res)=>{
  try{let pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
   if(pathname==="/")pathname="/web/index.html";
   const absolute=resolve(root,"."+pathname);
   if(!absolute.startsWith(root+sep))throw Error("outside root");
   const bytes=await readFile(absolute);
   res.writeHead(200,{"content-type":types[extname(absolute)]||"application/octet-stream","cache-control":"no-store"});res.end(bytes);
  }catch{res.writeHead(404);res.end("not found")}
 });
 await new Promise(ok=>http.listen(0,"127.0.0.1",ok));
 return "http://127.0.0.1:"+http.address().port;
}
const hook=String.raw`
const canvas=document.querySelector("#arena");if(!canvas)return false;
window.__arenaLiteNative={frames:[],last:null,knightWebPDraws:0,knightSources:{}};
const proto=CanvasRenderingContext2D.prototype,real=proto.drawImage;
proto.drawImage=function(...args){
 if(this.canvas===canvas&&args[0] instanceof HTMLCanvasElement&&args[0].width===960&&args[0].height===540){
   const obj=window.__arenaLiteNative;const t=performance.now();obj.frames.push(t);if(obj.frames.length>600)obj.frames.shift();
   if(!obj.last){
     const src=args[0],pixels=src.getContext("2d").getImageData(0,0,960,540).data;
     let sum=0,n=0;for(let y=135;y<405;y+=4)for(let x=240;x<720;x+=4){const i=(y*960+x)*4;sum+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;n++}
     obj.last={centerLuminance:sum/n,width:src.width,height:src.height,frame:obj.frames.length};
   }
 }
 if(this.canvas===canvas&&args[0] instanceof HTMLImageElement){
   const im=args[0],s=im.currentSrc||im.src||"";
   if(s.includes("/assets/knights/")&&s.includes("silver_")&&s.endsWith(".webp")&&im.naturalHeight===1280){
     const audit=window.__arenaLiteNative;audit.knightWebPDraws++;
     const key=s.split("/").pop();audit.knightSources[key]=(audit.knightSources[key]||0)+1;
   }
 }
 return real.apply(this,args);
};return true;`;
const stats=String.raw`
const x=window.__arenaLiteNative;if(!x?.last)return null;
const ms=x.frames.slice(1).map((v,i)=>v-x.frames[i]).filter(v=>v>=0);
ms.sort((a,b)=>a-b);
const p=q=>ms.length?ms[Math.min(ms.length-1,Math.floor((ms.length-1)*q))]:null;
return {floor:x.last,frames:x.frames.length,frameIntervalP50Ms:p(.5),frameIntervalP95Ms:p(.95),over33ms:ms.filter(v=>v>33).length,
knightWebPDraws:x.knightWebPDraws,knightSources:x.knightSources,
knightsFlag:new URLSearchParams(location.search).get("knights"),knightArt:new URLSearchParams(location.search).get("knightArt"),
roster:[...document.querySelectorAll("#scoreboard-list li")].map(li=>li.textContent?.trim()||""),
status:document.querySelector("#event-text")?.textContent||"",innerWidth:innerWidth,innerHeight:innerHeight,
canvasWidth:document.querySelector("#arena")?.width,canvasHeight:document.querySelector("#arena")?.height};`;
async function runFourCombatLifecycle(actors,{rustUrl,cert,host,readAuthoritativeWorld}){
 const start=readAuthoritativeWorld().length;
 const lines=()=>readAuthoritativeWorld().slice(start).split("\n");
 const actionRows=()=>lines().flatMap((line,index)=>{
  const m=line.match(/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)\s*$/);
  return m?[{line,index,tick:+m[1],fighter:+m[2],from:+m[3],to:+m[4]}]:[];
 });
 const admissionRows=()=>lines().flatMap((line,index)=>{
  const m=line.match(/^M201_AUTH_GESTURE_ACTION tick=(\d+) fighter=(\d+) source=(\d+) gesture=(\d+) sequence=(\d+) eventAction=(\d+) status=(\d+) from=(\d+) to=(\d+)\s*$/);
  return m?[{line,index,tick:+m[1],fighter:+m[2],source:+m[3],gesture:+m[4],sequence:+m[5],eventAction:+m[6],status:+m[7],from:+m[8],to:+m[9]}]:[];
 });
 const hitRows=()=>lines().flatMap((line,index)=>{
  const m=line.match(/^M201_AUTH_HIT tick=(\d+) attacker=(\d+) target=(\d+) damage=(\d+) hp=(\d+)\s*$/);
  return m?[{line,index,tick:+m[1],attacker:+m[2],target:+m[3],damage:+m[4],hp:+m[5]}]:[];
 });
 const proof=a=>evaluate(a.s,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
 const readAll=async()=>Promise.all(actors.map(async a=>({actorId:a.actor.id,browser:a.s.engine,
  ...await evaluate(a.s,String.raw`return {proof:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null,ownHud:{
   hp:Number(document.querySelector('#player-hp-value')?.textContent),
   guard:Number(document.querySelector('#player-guard-value')?.textContent),
   stamina:Number(document.querySelector('#player-stamina-value')?.textContent),
   roster:[...document.querySelectorAll('#scoreboard-list li')].map(li=>li.textContent||'')}};`)})));
 const own=(p,id)=>p?.replicatedFighters?.find(f=>f.netId===id);
 const pulse=async(a,key,ms)=>{
  // The original game listens for WASD keydown on #arena, NOT window.
  // Focusing the real canvas is required for genuine W3C keyboard events
  // to reach the existing game input owner. No synthetic event is emitted.
  const arenaFocused=await evaluate(a.s,String.raw`
   const c=document.querySelector('#arena');
   if(!c)return false;
   c.scrollIntoView({block:'center'});
   c.focus();
   return document.activeElement===c;`);
  assert.equal(arenaFocused,true,"native WASD staging requires original arena keyboard focus");
  return request(a.s.base,"POST","/session/"+a.s.id+"/actions",{
   actions:[{type:"key",id:"four-real-walk",actions:[{type:"keyDown",value:key},{type:"pause",duration:ms},{type:"keyUp",value:key}]}]
  });
 };
 const expectedHp=new Map([[1,100],[2,100],[3,100],[4,100]]);
 const waitReplicas=()=>waitFor(async()=>{
  const replicas=await readAll();
  return replicas.every(r=>r.proof?.ownPlayerNetId===r.actorId&&r.proof.failed===false&&r.proof.closed===false&&r.proof.replicatedFighters?.length===4
   &&r.ownHud.hp===expectedHp.get(r.actorId)&&r.ownHud.guard===100&&r.ownHud.stamina===100&&r.ownHud.roster.length===4
   &&r.proof.replicatedFighters.every(f=>expectedHp.has(f.netId)&&f.hp===expectedHp.get(f.netId)&&f.guard===100&&f.stamina===100))?replicas:false;
 },12000);
 async function stagePair(attackerId,targetId){
  const a=actors.find(a=>a.actor.id===attackerId);
  // W3C key presses go to the currently focused element. The original
  // gameplay canvas owns WASD; unlike an aimed mouse move it is not focused
  // automatically by a keyboard action. Preserve genuine native key events.
  const focused=await evaluate(a.s,"const c=document.querySelector('#arena');if(!c)return false;c.scrollIntoView({block:'center'});c.focus();return document.activeElement===c;");
  assert.equal(focused,true,"real WASD staging requires original arena keyboard focus");
  const attempts=[];
  for(let move=0;move<6;move++){
   const p=await proof(a),f=own(p,attackerId),t=own(p,targetId);
   assert(f&&t&&f.action===0&&t.action===0,"only real idle replicas may authorize native staging");
   assert.ok(Math.abs(f.y-t.y)<=8,"native pair must share actual horizontal lane");
   const desired=COMBAT.attack.reach-4,delta=t.x-f.x-desired;
   if(Math.abs(delta)<=5){
    assert.ok(t.x-f.x>COMBAT.fighterRadius*2&&t.x-f.x<COMBAT.attack.reach+COMBAT.fighterRadius-10,
     "actual replica positions, not held duration, establish light reach");
    await sleeps(110);
    const stable=await proof(a),next=own(stable,attackerId),nextTarget=own(stable,targetId);
    if(stable.serverTick>p.serverTick&&Math.abs(next.x-f.x)<=2&&Math.abs(nextTarget.x-t.x)<=2)
     return {attackerId,targetId,proof:stable,attempts};
   }else{
    const key=delta>0?"d":"a",durationMs=Math.max(20,Math.min(180,Math.ceil(Math.abs(delta)*1000/COMBAT.moveSpeed)));
    await pulse(a,key,durationMs);
    await sleeps(310); // allow genuine accepted input to reach the original 60Hz World
    const after=await proof(a),next=own(after,attackerId);
    attempts.push({key,durationMs,beforeTick:p.serverTick,afterTick:after.serverTick,
     beforeX:f.x,afterX:next?.x,targetX:t.x});
    continue;
   }
   await sleeps(310); // do not accidentally double-tap the original native dash gesture
  }
  throw Error("real WASD could not establish stable authoritative pair geometry: "+JSON.stringify({attackerId,targetId,attempts}));
 }
 async function prepareClick(a,targetId){
  const p=await proof(a),f=own(p,a.actor.id),target=own(p,targetId);
  assert(f&&target&&f.action===0&&target.action===0,"all native click preparation requires actual recovered idle fighters");
  const before=await evaluate(a.s,"return window.__MYASO_FOUR_PHYSICAL_LMB__?.length??0;");
  const xy=await evaluate(a.s,"const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();const b=c.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,scaleX:b.width/c.width,scaleY:b.height/c.height};");
  const angle=Math.atan2(target.y-f.y,target.x-f.x);
  await request(a.s.base,"POST","/session/"+a.s.id+"/actions",{
   actions:[{type:"pointer",id:"four-real-lmb",parameters:{pointerType:"mouse"},actions:[
    {type:"pointerMove",origin:"viewport",x:Math.round(xy.x+Math.cos(angle)*190*xy.scaleX),y:Math.round(xy.y+Math.sin(angle)*190*xy.scaleY),duration:0},
   ]}]
  });
  return {a,targetId,before};
 }
 function dispatchPreparedClick({a}){
  // Critical simultaneous phase: no browser reads, aim moves or down-ACK
  // barriers between dispatching these genuine native button sequences.
  return request(a.s.base,"POST","/session/"+a.s.id+"/actions",{
   actions:[{type:"pointer",id:"four-real-lmb",parameters:{pointerType:"mouse"},actions:[
    // The Firefox W3C 25ms pause can expand to a 142-150ms *real* physical
    // hold under four-browser contention (original CI first red). This
    // inserts no pause tick: true trusted DOWN/UP still originate from the
    // same native W3C request. Keep the strict measured <135ms Light gate.
    {type:"pointerDown",button:0},{type:"pointerUp",button:0},
   ]}]
  });
 }
 async function collectPreparedClick({a,targetId,before}){
  const edges=await evaluate(a.s,"return window.__MYASO_FOUR_PHYSICAL_LMB__?.map(e=>({...e}))??[];");
  const delivered=edges.slice(before);
  assert.equal(delivered.length,2,"exactly one actual native physical down/up per round");
  assert.equal(delivered[0].type,"pointerdown");assert.equal(delivered[1].type,"pointerup");
  assert.ok(delivered.every(e=>e.trusted&&e.pointerType==="mouse"),"all four fighters use genuine trusted native mouse events");
  assert.equal(delivered[0].pointerId,delivered[1].pointerId);
  return {actorId:a.actor.id,targetId,edges:delivered};
 }
 async function click(a,targetId){
  const prepared=await prepareClick(a,targetId);
  await dispatchPreparedClick(prepared);
  return collectPreparedClick(prepared);
 }
 async function round(pairs){
  // Every true pointerMove ACK and eligibility read finishes for ALL actors
  // before any native PRESS is dispatched. Preserve the strict concurrent
  // World-admission-before-first-active requirement below without read jitter.
  const prepared=await Promise.all(pairs.map(([id,target])=>prepareClick(actors.find(a=>a.actor.id===id),target)));
  const beforeLines=lines(),offset=beforeLines.length-(beforeLines.at(-1)===""?1:0);
  await Promise.all(prepared.map(dispatchPreparedClick));
  const physicalClicks=await Promise.all(prepared.map(collectPreparedClick));
  const roundRows=()=>admissionRows().filter(e=>e.index>=offset&&e.source===0&&e.status===1);
  const presses=await waitFor(()=>{
   const found=pairs.map(([id])=>roundRows().filter(e=>e.fighter===id&&e.eventAction===1&&e.from===0&&e.to===1));
   return found.every(x=>x.length===1)?found.map(x=>x[0]):false;
  },5000);
  const hits=await waitFor(()=>{
   const found=hitRows().filter(h=>h.index>=offset);
   return found.length>=pairs.length?found:false;
  },5000);
  assert.equal(hits.length,pairs.length,"exactly one real World contact per independent gesture");
  for(const [id,target] of pairs){
   const h=hits.filter(h=>h.attacker===id&&h.target===target);
   assert.equal(h.length,1,"real light hits only its paired independent fighter once");
   assert.equal(h[0].damage,34,"physical short LMB cannot silently become heavy");
   expectedHp.set(target,Math.max(0,expectedHp.get(target)-h[0].damage));
   assert.equal(h[0].hp,expectedHp.get(target),"World HP derives exactly from original hit damage");
   const press=presses.find(p=>p.fighter===id);
   assert.ok(h[0].tick>=press.tick&&h[0].index>press.index,"actual same-actor light follows real gesture admission");
   const releases=roundRows().filter(e=>e.fighter===id&&e.eventAction===3&&e.gesture===press.gesture);
   assert.equal(releases.length,1,"one matching canonical physical release per light");
   // A genuine sub-135ms physical Firefox click can cross the early source0
   // upgrade threshold. Its undercharged release must resume original LIGHT,
   // not commit HeavyReady, a heavy hit or a second hit.
   const physical=physicalClicks.find(c=>c.actorId===id)?.edges;
   assert.equal(physical?.length,2,"one original W3C down/up per short gesture");
   const heldMs=physical[1].epochMs-physical[0].epochMs;
   assert.ok(heldMs>=0&&heldMs<COMBAT.attack.windupMs,
    "short source0 LMB must release before 135ms light windup");
   const upgrades=roundRows().filter(e=>e.fighter===id&&e.eventAction===2);
   assert.ok(upgrades.length<=1,"short source0 LMB cannot send duplicate upgrades");
   if(upgrades.length){
    const upgrade=upgrades[0];
    assert.equal(upgrade.gesture,press.gesture,"early upgrade must retain true actor gesture");
    assert.equal(upgrade.from,1,"early upgrade only originates in admitted LightWindup");
    assert.equal(upgrade.to,9,"undercharged upgrade enters held windup, not World heavy HIT");
    assert.ok(upgrade.sequence>press.sequence&&upgrade.sequence<releases[0].sequence,
     "early upgrade is strictly between original PRESS and matching RELEASE");
    assert.equal(releases[0].from,9,"undercharged release retires same held windup");
    assert.equal(releases[0].to,1,"undercharged release must resume original LightWindup");
   }
   assert.ok(!actionRows().some(e=>e.index>=offset&&e.fighter===id&&e.to===10),
    "physical short LMB must never enter HeavyActive");
  }
  const active=actionRows().filter(e=>e.index>=offset&&e.to===2);
  assert.equal(active.length,pairs.length,"all real independent players reach original LightActive exactly once");
  if(pairs.length===4){
   assert.ok(Math.max(...presses.map(p=>p.tick))-Math.min(...presses.map(p=>p.tick))<COMBAT.attack.windupMs*60/1000,
    "all four native PRESS admissions overlap before first light windup can finish");
   assert.ok(Math.max(...presses.map(p=>p.index))<Math.min(...active.map(p=>p.index)),"all four real PRESSes precede first active strike");
  }
  await waitFor(async()=>{
   const p=await proof(actors[0]);
   return pairs.every(([id])=>own(p,id)?.action===0);
  },5000);
  assert.equal(hitRows().filter(h=>h.index>=offset).length,pairs.length,"completed recoveries cannot produce double hits");
  return {physicalClicks,presses,hits,active,admissions:roundRows()};
 }
 const rounds=[],staging=[];
 try{
  await waitReplicas();
  await Promise.all(actors.map(a=>evaluate(a.s,String.raw`
   const edges=[];window.__MYASO_FOUR_PHYSICAL_LMB__=edges;
   for(const type of ['pointerdown','pointerup'])window.addEventListener(type,e=>{
    if(e.button===0){edges.push({type,trusted:e.isTrusted,pointerType:e.pointerType,pointerId:e.pointerId,epochMs:Date.now()});
     if(edges.length>64)edges.shift();}
   },true);return true;`)));
  if(physicalMode==="private-hit"){
   const privateProof=a=>evaluate(a.s,"return window.__MYASO_PRIVATE_HIT_PROOF__?.()??null;");
   await waitFor(async()=>{
    const all=await Promise.all(actors.map(privateProof));
    return all.every(p=>p?.closed===false&&p.status==="granted"&&p.expected===0&&p.delivered.length===0);
   },12000).catch(async error=>{
    const participants=await Promise.all(actors.map(async a=>({
     actorId:a.actor.id,engine:a.s.engine,privateScope:await privateProof(a),
     failure:await evaluate(a.s,"return window.__MYASO_PRIVATE_HIT_FAILURE__??null;"),
     status:await evaluate(a.s,"return document.querySelector('#event-text')?.textContent||'';"),
     actor:await evaluate(a.s,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()?.ownPlayerNetId??null;"),
    })));
    const server=lines().filter(x=>/session |private HIT|M201/.test(x)).slice(-70);
    await writeFile(join(output,"core8-private-native-grant-failure.json"),
      JSON.stringify({error:String(error),participants,server},null,2)+"\n");
    console.error("CORE8_PRIVATE_NATIVE_GRANT_FAILURE",JSON.stringify({participants,server}));
    throw error;
   });
   // Passive DOM mutation history retains actual first-party feedback even
   // when the driver reads after the presentation animation has expired.
   await Promise.all(actors.map(a=>evaluate(a.s,String.raw`
    const history=[];const observe=()=>{
     const event=document.querySelector('#event-text')?.textContent||'';
     const feedback=document.querySelector('[data-combat-feedback]')?.dataset.combatFeedback||'';
     history.push({event,feedback});if(history.length>256)history.shift();
    };
    new MutationObserver(observe).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
    window.__MYASO_PRIVATE_NATIVE_HUD__=history;observe();return true;`)));
   staging.push(await stagePair(1,2));
   rounds.push(await round([[1,2]]));
   const worldHit=rounds[0].hits[0];
   assert.deepEqual([worldHit.attacker,worldHit.target,worldHit.damage,worldHit.hp],[1,2,34,66]);
   const replicas=await waitReplicas();
   const delivery=await waitFor(async()=>{
    const all=await Promise.all(actors.map(async a=>({actorId:a.actor.id,browser:a.s.engine,
     proof:await privateProof(a),hud:await evaluate(a.s,"return window.__MYASO_PRIVATE_NATIVE_HUD__.map(x=>({...x}));")})));
    return all.every(r=>r.proof?.closed===false&&r.proof.status==="granted"
     &&r.proof.delivered.length===(r.actorId<=2?1:0)
     &&(r.actorId>2||r.proof.controlsWritten.some(c=>c.op===3&&c.cursor===1)))?all:false;
   },12000);
   for(const r of delivery){
    if(r.actorId>2){
     assert.equal(r.proof.expected,0,"spectators consume no participant delivery sequence");
     assert.ok(!r.proof.controlsWritten.some(c=>c.op===3&&c.cursor>0),"spectator cannot ACK somebody else's HIT");
     assert.ok(!r.hud.some(h=>h.event==="Opponent hit - 34 HP."||h.event==="Hit taken - 34 HP."),"spectator never receives own hit attribution");
     continue;
    }
    const receipt=r.proof.delivered[0];
    assert.deepEqual([receipt.sequence,receipt.serverTick,receipt.attacker,receipt.target,receipt.damage,receipt.targetHp],
     [0,worldHit.tick,1,2,34,66],"private reliable receipt must exactly match original World HIT, never HP-inferred ownership");
    const text=r.actorId===1?"Opponent hit - 34 HP.":"Hit taken - 34 HP.";
    const feedback=r.actorId===1?"hit-confirm":"damage-taken";
    assert.equal(receipt.presentation.text,text);assert.equal(receipt.presentation.feedback,feedback);
    assert.ok(r.hud.some(h=>h.event===text),"actual first-party HUD presents authenticated role-specific receipt");
    assert.ok(r.hud.some(h=>h.feedback===feedback),"actual first-party HUD feedback matches receipt role");
    assert.equal(r.proof.expected,1,"one contiguous receipt processed");
    for(const ack of r.proof.controlsWritten.filter(c=>c.op===3)){
     assert.ok(ack.cursor<=r.proof.delivered.length,"application ACK cannot exceed presented receipt count");
     assert.ok(Number.isInteger(ack.presentedCount)&&ack.presentedCount>=ack.cursor,"presentation was completed before actual ACK write");
     assert.ok(Number.isFinite(ack.writtenAtEpochMs),"actual successful control write has local ordering evidence");
     for(const shown of r.proof.delivered.filter(h=>h.sequence<ack.cursor)){
      assert.ok(Number.isFinite(shown.presentedAtEpochMs)&&shown.presentedAtEpochMs<=ack.writtenAtEpochMs,
       "same-page synchronous HUD presentation precedes actual application ACK completion");
     }
    }
   }
   await sleeps(COMBAT.attack.windupMs+COMBAT.attack.activeMs+COMBAT.attack.recoveryMs+150);
   assert.equal(hitRows().length,1,"one physical gesture cannot create a second World HIT");
   for(const a of actors)assert.equal((await privateProof(a)).delivered.length,a.actor.id<=2?1:0);
   const evidence={sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"set-from-commit",mode:physicalMode,
    developerLoopbackOnly:true,publicNamespaceActivated:false,independentPhysicalHumanHosts:false,
    staging,rounds,replicas,delivery,originalWorld:lines()};
   await writeFile(join(output,"combat4-private-hit-four-native-world.json"),JSON.stringify(evidence,null,2)+"\n");
   console.log("COMBAT4_PRIVATE_HIT_FOUR_NATIVE_WORLD_PASS",JSON.stringify(evidence));
   return;
  }
  staging.push(await stagePair(1,2),await stagePair(3,4));
  rounds.push(await round([[1,2],[2,1],[3,4],[4,3]]));
  const afterJoint=await waitReplicas();
  for(let lethal=0;lethal<2;lethal++){
   staging.push(await stagePair(1,2));
   rounds.push(await round([[1,2]]));
   if(lethal===0)await waitReplicas();
  }
  const death=await waitFor(()=>actionRows().find(e=>e.fighter===2&&e.to===8),5000);
  const respawn=await waitFor(()=>actionRows().find(e=>e.fighter===2&&e.from===8&&e.to===0&&e.index>death.index),6000);
  expectedHp.set(2,100);
  const afterRespawn=await waitReplicas();
  const old=actors.find(a=>a.actor.id===2);
  // The original native page still owns the pre-death negotiated lease.
  // A genuine post-respawn click must fail closed, never acquire authority
  // from the player's returned HP or silently grant a new actor incarnation.
  const beforeStaleProof=await proof(old),staleLines=lines();
  assert.equal(beforeStaleProof.failed,false,"native death-fence failure must follow the new physical stale click");
  assert.equal(beforeStaleProof.closed,false,"the real pre-death page remains connected before stale click");
  const staleOffset=staleLines.length-(staleLines.at(-1)===""?1:0);
  const stalePhysical=await click(old,1);
  const staleProof=await waitFor(async()=>{
   const p=await proof(old);
   return p?.failed===true&&p.closed===true?p:false;
  },5000);
  const oldSequences=new Set((beforeStaleProof.acknowledged??[]).map(r=>r.sequence));
  const staleReceipts=(staleProof.acknowledged??[]).filter(r=>!oldSequences.has(r.sequence));
  assert.ok(staleReceipts.every(r=>r.status!==1),"dead-generation physical gesture cannot receive accepted authority");
  await sleeps(COMBAT.attack.windupMs+COMBAT.attack.activeMs+COMBAT.attack.recoveryMs+150);
  const staleActions=actionRows().filter(e=>e.index>=staleOffset&&e.fighter===2);
  const staleHits=hitRows().filter(e=>e.index>=staleOffset&&e.attacker===2);
  const staleAdmissions=admissionRows().filter(e=>e.index>=staleOffset&&e.fighter===2);
  assert.ok(!staleActions.some(e=>e.to===1||e.to===2||e.to===9||e.to===10),"real old-generation click cannot start any light or heavy World attack");
  assert.equal(staleHits.length,0,"real retired native actor cannot damage another player");
  assert.ok(!staleAdmissions.some(e=>e.status===1),"old-generation source edge never gains accepted World admission");
  const deathFence={before:beforeStaleProof,physical:stalePhysical,after:staleProof,receipts:staleReceipts,
   originalWorldAfterPhysicalClick:lines().slice(staleOffset),staleActions,staleHits,staleAdmissions};
  await request(old.s.base,"DELETE","/session/"+old.s.id);
  actors.splice(actors.indexOf(old),1);
  await waitFor(async()=>{const all=await readAll();return all.every(r=>r.proof.replicatedFighters.length===3&&!own(r.proof,2));},12000);
  const s=await startW3C(old.s.engine,4),u=new URL(host+"/web/index.html");
  for(const [k,v] of Object.entries({server:rustUrl,cert,knights:"1",knightArt:"relit",arenaGrid:"1",...(instantLmb?{instantLmbPreview:"1"}:{gestureLab:"1"})}))u.searchParams.set(k,v);
  if(chatC1)u.searchParams.set("chatC1Preview","1");
  await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
  const joined=await waitFor(async()=>{const p=await evaluate(s,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");return p?.ownPlayerNetId===5&&p.transportState==="granted"?p:false;},16000);
  assert.equal(joined.ownPlayerNetId,5,"fresh native QUIC connection owns new server actor and lease");
  const fresh={s,actor:{id:5}},survivors=actors.map(a=>a.actor.id);actors.push(fresh);
  expectedHp.delete(2);expectedHp.set(5,100);
  const afterRejoin=await waitReplicas(),before=own(await proof(fresh),5);
  await pulse(fresh,"d",180);
  const moved=await waitFor(async()=>{
   const all=await readAll();
   return all.every(r=>{const f=own(r.proof,5);return f&&f.x>before.x+8&&!own(r.proof,2);})?all:false;
  },10000);
  const retiredAfter=actionRows().filter(e=>e.fighter===2&&e.index>respawn.index);
  assert.ok(!retiredAfter.some(e=>e.to===1||e.to===2||e.to===9||e.to===10),"retired old actor emits no further World combat action");
  const evidence={sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"set-from-commit",mode:physicalMode,
   fourRealNativeActiveFighters:true,staging,rounds,afterJoint,death,respawn,afterRespawn,deathFence,afterRejoin,moved,
   freshActorId:5,survivors,oldActorId:2,oldNativeSessionDeleted:true,
   forgedOldGenerationAttempted:false,genuineNativeOldGenerationClickRejected:true,
   publicListener:false,independentPhysicalHumanHosts:false,originalWorld:lines()};
  await writeFile(join(output,"combat4-four-native-combat-lifecycle-world.json"),JSON.stringify(evidence,null,2)+"\n");
  console.log("COMBAT4_FOUR_NATIVE_COMBAT_LIFECYCLE_WORLD_PASS",JSON.stringify(evidence));
 }catch(error){
  // Retain REAL W3C pointer provenance on failure: the four-browser load can
  // occasionally stretch an intended short click beyond READY320. Never
  // reclassify it as a valid light or waive the original World 34HP invariant.
  // Physical evidence distinguishes native driver scheduling from ingress.
  const physicalEvents=await Promise.all(actors.map(async a=>({
   actorId:a.actor.id,browser:a.s.engine,
   events:await evaluate(a.s,"return (window.__MYASO_FOUR_PHYSICAL_LMB__??[]).map(e=>({...e}));")
    .catch(e=>({error:String(e)}))
  })));
  const evidence={error:String(error),rounds,staging,physicalEvents,
   replicas:await readAll().catch(e=>({error:String(e)})),originalWorld:lines()};
  await writeFile(join(output,"combat4-four-native-combat-lifecycle-failure.json"),JSON.stringify(evidence,null,2)+"\n");
  console.error("COMBAT4_FOUR_NATIVE_COMBAT_LIFECYCLE_FAILURE",JSON.stringify(evidence));throw error;
 }
}
await mkdir(output,{recursive:true});
try{
 const {url:rustUrl,cert,readAuthoritativeWorld}=await startOriginalRust(),host=await startStatic();
 const actors=[];
 // This single-source0 negative test requires ONE actual browser/actor.
 // Preserve the full four-seat standard/held/lifecycle/private qualifications.
 const seatCount=["space-guard","jump-review"].includes(physicalMode)?1:physicalMode==="jump-two-hit"?2:4;
 for(let i=0;i<seatCount;i++){
  const s=await startW3C(engines[i],i);const flag="0";
  const u=new URL(host+"/web/index.html");u.searchParams.set("server",rustUrl);u.searchParams.set("cert",cert);u.searchParams.set("knights","1");u.searchParams.set("knightArt","relit");u.searchParams.set("arenaGrid","1");u.searchParams.set(instantLmb?"instantLmbPreview":"gestureLab","1");if(physicalMode==="private-hit")u.searchParams.set("hitDeliveryLab","1");if(!instantLmb&&["jump-review","jump-two-hit"].includes(physicalMode))u.searchParams.set("jumpCombatReview","1");
  if(chatC1)u.searchParams.set("chatC1Preview","1");
  await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
  const actor=await waitFor(async()=>{let t=await evaluate(s,"return document.querySelector('#event-text')?.textContent||'';");const m=t?.match(/Online - player #(\d+) - server tick (\d+)/);return m?{id:Number(m[1]),tick:Number(m[2])}:null},16000).catch(async error=>{
   if(physicalMode==="jump-two-hit"){
    const browser=await evaluate(s,
     "return {state:document.readyState,status:document.querySelector('#event-text')?.textContent||'',"
     +"url:location.href,proof:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null}").catch(e=>({error:String(e)}));
    const evidence={error:String(error),whichSeat:i+1,browser,
      originalWorld:readAuthoritativeWorld().split("\n")
       .filter(line=>/session |M201_|listening on|admission cap/.test(line)).slice(-45),
      startedActorIds:actors.map(a=>a.actor.id),
      limitation:"browser/bootstrap failure; no combat inference"};
    await writeFile(join(output,"combat4-two-native-bootstrap-FIRST-RED.json"),
      JSON.stringify(evidence,null,2)+"\n");
    console.error("COMBAT4_TWO_NATIVE_BOOTSTRAP_FIRST_RED",JSON.stringify(evidence));
   }
   if(physicalMode==="private-hit"){
    // Read-only evidence from the actual first-party page and authoritative
    // server. Never grant an actor, synthesize online state or waive failure.
    const browser=await evaluate(s,String.raw`return {
      pageReady:document.readyState,status:document.querySelector('#event-text')?.textContent||'',
      actor:window.__MYASO_LOCAL_GESTURE_PROOF__?.()?.ownPlayerNetId??null,
      transport:window.__MYASO_LOCAL_GESTURE_PROOF__?.()?.transportState??null,
      privateReceipt:window.__MYASO_PRIVATE_HIT_PROOF__?.()??null,
      privateFailure:window.__MYASO_PRIVATE_HIT_FAILURE__??null,
    };`).catch(e=>({error:String(e)}));
    const originalWorld=readAuthoritativeWorld().split("\n")
     .filter(line=>/session |private HIT|M201_AUTH_|listening on|admission cap/.test(line)).slice(-80);
    const evidence={error:String(error),browser,originalWorld,requestedUrl:u.toString().replace(/cert=[^&]*/,"cert=[redacted]")};
    await writeFile(join(output,"core8-private-native-bootstrap-failure.json"),JSON.stringify(evidence,null,2)+"\n");
    console.error("CORE8_PRIVATE_NATIVE_BOOTSTRAP_FAILURE",JSON.stringify({browser,originalWorld}));
   }
   throw error;
  });
  assert.equal(actor.id,i+1,"genuine sequential Rust actor IDs required");
  assert.ok(await evaluate(s,hook),"read-only original Canvas image observer");
  actors.push({s,actor,flag});
 }
 await sleeps(2400);
 const trial=[];
 for(const {s,actor,flag} of actors){
  const data=await evaluate(s,stats);
  assert.ok(data&&data.frames>=12,"original real gameplay Canvas frames required");
  assert.equal(data.knightsFlag,"1","all four must use original authenticated source Silver renderer");
  assert.equal(data.knightArt,"relit","all four opt into original Blender 3A relit reference");
  assert.ok(data.knightWebPDraws>=8,"all real players must paint nonplaceholder Silver source WebP frames");
  assert.ok(Object.keys(data.knightSources).some(k=>k.startsWith("silver_")&&k.endsWith("_relit.webp")),
    "require actual original Blender relit Silver WebP drawImage calls, not a fallback Combat circle");
  assert.ok(data.roster.length>=seatCount,`genuine admitted native roster must be visible: ${JSON.stringify({browser:s.engine,actorId:actor.id,status:data.status,roster:data.roster,expectedActors:actors.map(x=>x.actor.id),privateLab:physicalMode==="private-hit"?await evaluate(s,"return window.__MYASO_PRIVATE_HIT_PROOF__?.()??null;"):null,privateFailure:physicalMode==="private-hit"?await evaluate(s,"return window.__MYASO_PRIVATE_HIT_FAILURE__??null;"):null,serverSessions:readAuthoritativeWorld().split("\\n").filter(x=>/session |private HIT/.test(x)).slice(-24)})}`);
  assert.equal(data.canvasWidth,960);assert.equal(data.canvasHeight,540);
  assert.ok(data.floor.centerLuminance>(flag==="1"?38:15));
  assert.ok(data.floor.centerLuminance<(flag==="1"?155:39));
  assert.match(data.status,/Online - player #/);
  const image=(await request(s.base,"GET","/session/"+s.id+"/screenshot")).value;
  const bytes=Buffer.from(image,"base64");assert.ok(bytes.length>1000&&bytes.subarray(0,4).equals(Buffer.from([137,80,78,71])),"genuine W3C PNG");
  const name=s.engine+"-"+s.index+"-"+(flag==="1"?"lite":"grid")+".png";
  await writeFile(join(output,name),bytes);
  trial.push({browser:s.engine,actorId:actor.id,mode:flag==="1"?"lite":"grid",data,screenshot:name,pngSha256:sha(bytes)});
 }
 assert.equal(trial.length,seatCount,"required real native fighter sessions must all start");
 assert.ok(trial.every(x=>x.mode==="grid"),"release slice must use original grid on every browser, never optional terrain");

 async function nativeChatRound(message) {
  const sender=actors[1].s,recipient=actors[0].s;
  for(const {s} of actors)await waitFor(()=>evaluate(s,"return document.querySelector('[data-local-chat]')?.dataset.connected==='true';"));
  const keys=async values=>request(sender.base,"POST","/session/"+sender.id+"/actions",{actions:[{
   type:"key",id:"actual-combat-chat-keyboard",actions:values.flatMap(value=>[{type:"keyDown",value},{type:"keyUp",value}]),
  }]});
  await evaluate(sender,"document.querySelector('#arena').focus();return true;");
  await keys(["\uE007"]);
  assert.equal(await evaluate(sender,"return document.activeElement?.matches('.local-chat-input');"),true);
  await keys([...message]);
  await keys(["\uE007"]);
  assert.equal(await evaluate(sender,"return document.activeElement?.id==='arena'&&document.querySelector('[data-local-chat]').dataset.open==='false';"),true);
  await waitFor(()=>evaluate(recipient,"return [...document.querySelectorAll('.local-chat-text')].filter(x=>x.textContent==="+JSON.stringify(message)+").length===1;"));
  await waitFor(()=>evaluate(sender,"return document.querySelector('.local-chat-status')?.textContent.includes('Server accepted');"));
  console.log("COMBAT4_TYPED_NATIVE_CHAT_ROUND_PASS",JSON.stringify({message,sender:actors[1].actor.id,recipient:actors[0].actor.id}));
 }
 if(chatC1)await nativeChatRound("Before physical Light and Heavy");

 // First-party unchanged /web/index.html game page, not a synthetic QA UI.
 // True WebDriver key/pointer actions run against a fresh admitted original
 // Rust QUIC actor. M201 prints are read-only World mutation events, not HUD.
 if(physicalMode==="four-combat-lifecycle"||physicalMode==="private-hit"){
  await runFourCombatLifecycle(actors,{rustUrl,cert,host,readAuthoritativeWorld});
 }else if(physicalMode==="recovery-buffer"){
  await runNativeRecoveryBuffer({actors,evaluate,request,readAuthoritativeWorld,waitFor,sleep:sleeps,
   save:(name,evidence)=>writeFile(join(output,name),JSON.stringify(evidence,null,2)+"\n")});
  if(chatC1)await nativeChatRound("After buffered physical Light");
 }else if(physicalMode==="jump-two-hit"){
 // P0 nonrelease genuine TWO browser clients, same authenticated Rust World.
 const attacker=actors[0].s,victim=actors[1].s;
 const proof=s=>evaluate(s,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
 const own=(p,id)=>p?.replicatedFighters?.find(f=>f.netId===id);
 const before=await waitFor(async()=>{
  const both=await Promise.all([proof(attacker),proof(victim)]);
  return both.every((p,i)=>p?.transportState==="granted"
   && p.ownPlayerNetId===i+1 && p.failed===false && p.closed===false
   && own(p,1)?.action===0 && own(p,2)?.action===0
   && own(p,1)?.hp===100 && own(p,2)?.hp===100
   && p.replicatedFighters?.length===2)?both:false;
 },15000);
 const a0=own(before[0],1),t0=own(before[0],2);
 assert.ok(Math.abs(a0.y-t0.y)<=3,"two actual World actors share a horizontal lane");
 assert.ok(t0.x-a0.x>70,"two genuine actors start outside JumpAttack reach");
 const focused=await evaluate(attacker,
  "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();return document.activeElement===c;");
 assert.equal(focused,true,"original gameplay canvas must own native WASD");
 // Stage by ORIGINAL server positions, not an assumed WebDriver movement time.
 // Every correction is actual W3C D/A with a full release + 320ms between
 // presses, preventing accidental double-tap Dash in the game controller.
 const movementAttempts=[];
 let staged=null;
 for(let n=0;n<5;n++){
  const both=await Promise.all([proof(attacker),proof(victim)]);
  const a=own(both[0],1),t=own(both[0],2),gap=t?.x-a?.x;
  if(a?.action===0&&t?.action===0&&t.hp===100
      && Math.abs(a.y-t.y)<=5&&gap>=38&&gap<=62
      &&a.x>a0.x+20){staged=both;break;}
  if(!a||!t||a.action!==0||t.action!==0)break;
  const desired=54,delta=gap-desired,key=delta>0?"d":"a";
  const duration=Math.max(35,Math.min(180,Math.round(Math.abs(delta)*1000/215)));
  await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
   actions:[{type:"key",id:"jump-two-stage-"+n,actions:[
    {type:"keyDown",value:key},{type:"pause",duration},{type:"keyUp",value:key}]}]});
  await sleeps(330);
  const after=await proof(attacker);
  movementAttempts.push({n,key,duration,before:{x:a.x,y:a.y,gap},
    after:{x:own(after,1)?.x,y:own(after,1)?.y,gap:own(after,2)?.x-own(after,1)?.x}});
 }
 if(!staged){
  const diagnostic={error:"five genuine W3C movement corrections could not establish original World JumpAttack reach",
   movementAttempts,initial:before[0],attacker:await proof(attacker),victim:await proof(victim),
   originalWorld:readAuthoritativeWorld().split("\n").filter(x=>/M201_AUTH_|session /.test(x)).slice(-65)};
  await writeFile(join(output,"combat4-two-native-staging-FIRST-RED.json"),
   JSON.stringify(diagnostic,null,2)+"\n");
  console.error("COMBAT4_TWO_NATIVE_STAGING_FIRST_RED",JSON.stringify(diagnostic));
  throw Error("real server-owned 2-player positioning incomplete; no JumpAttack was attempted");
 }
 await sleeps(180);
 const ready=await Promise.all([proof(attacker),proof(victim)]);
 const a1=own(ready[0],1),t1=own(ready[0],2),range=t1.x-a1.x;
 assert.ok(range>=38&&range<=62,"real server replicas prove JumpAttack range");
 assert.equal(own(ready[1],1)?.x,a1.x,"second browser observes same original World");
 const pointer=await evaluate(attacker,
  "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();"
  +"const b=c.getBoundingClientRect(),events=[];"
  +"for(const type of ['keydown','keyup','pointerdown','pointerup'])window.addEventListener(type,e=>{"
  +"if(type.startsWith('key')&&e.code!=='Space')return;"
  +"if(type.startsWith('pointer')&&e.button!==0)return;"
  +"events.push({type,trusted:e.isTrusted,at:performance.now(),code:e.code||null,pointerId:e.pointerId??null})"
  +"},true);window.__COMBAT4_JUMP_TWO_PHYSICAL__=()=>events.map(x=>({...x}));"
  +"return {focus:document.activeElement===c,x:Math.round(b.left+b.width/2+190*b.width/c.width),y:Math.round(b.top+b.height/2)};");
 assert.equal(pointer.focus,true);
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[{type:"pointer",id:"two-jump-pointer",parameters:{pointerType:"mouse"},
   actions:[{type:"pointerMove",origin:"viewport",x:pointer.x,y:pointer.y,duration:0}]}]});
 await sleeps(100);
 const start=readAuthoritativeWorld().length,prior=await proof(attacker);
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[
   {type:"key",id:"two-jump-space",actions:[
    {type:"keyDown",value:" "},{type:"pause",duration:40},
    {type:"pause",duration:30},{type:"keyUp",value:" "}]},
   {type:"pointer",id:"two-jump-pointer",parameters:{pointerType:"mouse"},actions:[
    {type:"pointerMove",origin:"viewport",x:pointer.x,y:pointer.y,duration:0},
    {type:"pointerDown",button:0},{type:"pointerUp",button:0},{type:"pause",duration:0}]}
  ]});
 const hit=await waitFor(async()=>{
  const world=readAuthoritativeWorld().slice(start);
  const line=world.match(/^M201_AUTH_HIT tick=(\d+) attacker=1 target=2 damage=42 hp=58$/m)?.[0];
  if(!line)return false;
  const both=await Promise.all([proof(attacker),proof(victim)]);
  if(!both.every(p=>own(p,2)?.hp===58&&p.failed===false&&p.closed===false
      &&p.transportState==="granted"))return false;
  const added=both[0].acknowledged.slice(prior.acknowledged.length);
  if(added.filter(x=>x.source===0&&x.action===5&&x.status===1).length!==1
    ||added.filter(x=>x.source===0&&x.action===3&&x.status===1).length!==1)return false;
  return {line,world,both,added};
 },9000).catch(async error=>{
  const diagnostic={error:String(error),world:readAuthoritativeWorld().slice(start),
   attacker:await proof(attacker).catch(e=>String(e)),
   victim:await proof(victim).catch(e=>String(e)),
   native:await evaluate(attacker,"return window.__COMBAT4_JUMP_TWO_PHYSICAL__?.()??[]").catch(e=>String(e))};
  await writeFile(join(output,"combat4-two-native-jump-FIRST-RED.json"),
   JSON.stringify(diagnostic,null,2)+"\n");
  console.error("COMBAT4_TWO_NATIVE_JUMP_FIRST_RED",JSON.stringify(diagnostic));
  throw error;
 });
 await sleeps(380); // no duplicate hit during remaining original World recovery
 const journal=readAuthoritativeWorld().slice(start);
 const hits=journal.split("\n").filter(line=>/^M201_AUTH_HIT tick=\d+ attacker=1 target=2 /.test(line));
 assert.deepEqual(hits,[hit.line],"exactly one authoritative 42 HP hit; no double strike");
 const actualStaminaBefore=own(ready[0],1)?.stamina;
 const actualStaminaAfter=own(hit.both[0],1)?.stamina;
 const worldJumpEntry=classifyOriginalWorldJumpAttackEntry(journal,1,{
  startingStamina:actualStaminaBefore,observedStamina:actualStaminaAfter,
 });
 const remainingWorldTransitions=[[16,17],[17,18]].map(([from,to])=>({
  from,to,observed:worldTransition(journal,1,from,to)
 }));
 if(!worldJumpEntry||remainingWorldTransitions.some(x=>!x.observed)){
  const evidence={entryClassification:worldJumpEntry,stamina:{
    before:actualStaminaBefore,after:actualStaminaAfter},
   missing:remainingWorldTransitions.filter(x=>!x.observed),worldJournal:journal,
   receipt:hit.added,attackerReplica:hit.both[0],victimReplica:hit.both[1]};
  await writeFile(join(output,"combat4-two-native-action-FIRST-RED.json"),JSON.stringify(evidence,null,2)+"\n");
  console.error("COMBAT4_TWO_NATIVE_ACTION_FIRST_RED",JSON.stringify(evidence));
 }
 assert.ok(worldJumpEntry&&remainingWorldTransitions.every(x=>x.observed),
  "real World Jump→Windup (separate ticks OR authenticated same-observer 0→16), then Active→Recovery required");
 assert.equal(worldTransition(journal,1,0,1),false,
  "no competing ordinary Light attack");
 const physical=await evaluate(attacker,"return window.__COMBAT4_JUMP_TWO_PHYSICAL__?.()??[]");
 assert.deepEqual(physical.map(x=>x.type),
  ["keydown","pointerdown","pointerup","keyup"],"genuine W3C physical Space+LMB");
 assert.ok(physical.every(x=>x.trusted),"no untrusted/synthetic DOM edges");
 assert.equal(hit.added[0].gestureId,hit.added[1].gestureId,
  "one source0 gesture for actual JumpAttack and release");
 const evidence={mode:physicalMode,
  sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"local",
  originalWorld:true,originalAuthenticatedQUIC:true,
  distinctNativeBrowserProcesses:2,independentHumanWAN:false,
  actualActorIds:actors.map(x=>x.actor.id),
  staging:{before:before[0],staged:staged[0],ready:ready[0],range,movementAttempts},
  nativePhysical:physical,typedReceipts:hit.added,authoritativeHit:hit.line,
  worldJumpEntry,originalWorldStamina:{before:actualStaminaBefore,after:actualStaminaAfter},
  worldJournal:journal,attackerReplica:hit.both[0],victimReplica:hit.both[1],
  limitation:"two genuine browsers one local host; not WAN or two independent humans"};
 await writeFile(join(output,"combat4-two-native-jump-world-hit.json"),
  JSON.stringify(evidence,null,2)+"\n");
 console.log("COMBAT4_TWO_NATIVE_JUMP_WORLD_42HP_PASS",JSON.stringify(evidence));
}else if(physicalMode==="jump-review"){
 // Experimental extra opt-in: original first-party game, genuine native
 // key/pointer, same authenticated original QUIC stream and 60Hz Rust World.
 // This one-seat test proves a true World JumpAttack action and stamina,
 // NOT 42HP victim hit or two-person WAN gameplay.
 const attacker=actors[0].s;
 const coord=await evaluate(attacker,
  "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();"
  +"const b=c.getBoundingClientRect();const seen=[];"
  +"for(const type of ['keydown','keyup','pointerdown','pointerup'])window.addEventListener(type,e=>{"
  +"if((type.startsWith('key')&&e.code!=='Space')||(type.startsWith('pointer')&&e.button!==0))return;"
  +"seen.push({type,trusted:e.isTrusted,pointerId:e.pointerId??null,code:e.code??null,at:performance.now()});"
  +"},true);window.__COMBAT4_JUMP_NATIVE__=()=>seen.map(x=>({...x}));"
  +"return {focused:document.activeElement===c,x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.5)};");
 assert(coord.focused,"real game canvas must own native Space chord");
 const prior=await evaluate(attacker,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null");
 assert.equal(prior.transportState,"granted","real QUIC source0 lease required");
 const before=readAuthoritativeWorld().length;
 // One native WebDriver ticks request coordinates TWO real input sources.
 // Separate HTTP requests previously delayed physical LMB 2240ms after
 // Space: original World Jump(430ms) had already expired. Never change
 // World duration, deadlines or test assertions to conceal this W3C delay.
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[
   {type:"key",id:"jump-review-space",actions:[
    {type:"keyDown",value:" "},{type:"pause",duration:40},
    {type:"pause",duration:30},{type:"keyUp",value:" "}
   ]},
   {type:"pointer",id:"jump-review-lmb",parameters:{pointerType:"mouse"},actions:[
    {type:"pointerMove",origin:"viewport",x:coord.x,y:coord.y,duration:0},
    {type:"pointerDown",button:0},{type:"pointerUp",button:0},
    {type:"pause",duration:0}
   ]}
  ]
 });
 const result=await waitFor(async()=>{
  const log=readAuthoritativeWorld().slice(before),p=await evaluate(attacker,
   "return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null");
  if(!p)return false;
  const a=p.acknowledged||[];
  if(!a.some(e=>e.source===0&&e.action===5&&e.status===1)
     || !a.some(e=>e.source===0&&e.action===3&&e.status===1)
     || !worldTransition(log,1,15,16)
     || !worldTransition(log,1,16,17))return false;
  return {log,p};
 },12000).catch(async error=>{
  const diag={error:String(error),world:readAuthoritativeWorld().slice(before),
    browser:await evaluate(attacker,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null").catch(e=>String(e)),
    native:await evaluate(attacker,"return window.__COMBAT4_JUMP_NATIVE__?.()??[]").catch(e=>String(e))};
  console.error("COMBAT4_JUMP_NATIVE_FIRST_RED",JSON.stringify(diag));
  throw error;
 });
 const live=await evaluate(attacker,"return window.__COMBAT4_JUMP_NATIVE__?.()??[]");
 assert.deepEqual(live.map(e=>e.type),
  ["keydown","pointerdown","pointerup","keyup"],"genuine physical Space+LMB order");
 assert.ok(live.every(e=>e.trusted),"all native chord edges must be isTrusted");
 const rows=result.p.acknowledged.filter(e=>e.source===0&&e.status===1);
 assert.deepEqual(rows.map(e=>e.action),[5,3],"exact one gesture, no separate Light/Heavy");
 assert.equal(rows[0].gestureId,rows[1].gestureId);
 assert.ok(worldTransition(result.log,1,0,15),
  "original World must first grant and spend for real Jump");
 assert.ok(/M201_AUTH_GESTURE_ACTION tick=\d+ fighter=1 source=0 gesture=\d+ sequence=\d+ eventAction=5 status=1/.test(result.log),
  "original authenticated World-lock receipt proves one typed JumpAttack action5");
 console.log("COMBAT4_JUMP_NATIVE_FULL_WORLD_TRACE",JSON.stringify({world:result.log,receipts:rows,native:live}));
 assert.ok(!worldTransition(result.log,1,0,1),
  "no parallel sampled ordinary Light attack");
 assert.equal(result.p.failed,false,"original QUIC lease still valid");
 assert.equal(result.p.closed,false,"no fatal source0 reject");
 const evidence={mode:physicalMode,sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"local",
  originalGamePage:true,originalAuthenticatedQUIC:true,originalWorld:true,
  native:live,typedReceipts:rows,originalWorldLog:result.log,
  authoritativeReplica:result.p,independentHumanWAN:false,
  limitation:"single-actor true JumpAttack action, no opponent 42HP victim proof"};
 await writeFile(join(output,"combat4-jump-review-original-world.json"),
  JSON.stringify(evidence,null,2)+"\n");
 console.log("COMBAT4_NATIVE_JUMP_WORLD_ACTION_PASS",JSON.stringify(evidence));
}else if(physicalMode==="space-guard"){
 // Nonrelease real native W3C / original QUIC / original 60Hz Rust World.
 // This proves ONLY that v2 never misroutes Space+LMB into ordinary Light.
 // JumpAttack gameplay remains unimplemented until reviewed server authority.
 const attacker=actors[0].s,actorId=actors[0].actor.id;
 const page=await evaluate(attacker,String.raw`
  const c=document.querySelector("#arena");c.scrollIntoView({block:"center"});c.focus();
  const b=c.getBoundingClientRect(),events=[];
  for(const type of ["keydown","keyup","pointerdown","pointerup"]){
   window.addEventListener(type,e=>{
    if((type.startsWith("pointer")&&e.button!==0) ||
       (type.startsWith("key")&&e.code!=="Space"))return;
    events.push({type,trusted:e.isTrusted,code:e.code||null,
      pointerId:e.pointerId??null,at:performance.now()});
   },true);
  }
  window.__COMBAT4_SPACE_NATIVE_EDGES__=()=>events.map(e=>({...e}));
  return {focused:document.activeElement===c,
   x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.50)};
 `);
 assert(page.focused,"native Space chord requires original focused game canvas");
 const proof=()=>evaluate(attacker,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null");
 const edges=()=>evaluate(attacker,"return window.__COMBAT4_SPACE_NATIVE_EDGES__?.()??[]");
 const sendKeys=async(actions)=>request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[{type:"key",id:"native-space-chord-keyboard",actions}]
 });
 const sendPointer=async(actions)=>request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[{type:"pointer",id:"native-space-chord-pointer",parameters:{pointerType:"mouse"},actions}]
 });
 const click=async()=>sendPointer([
  {type:"pointerMove",origin:"viewport",x:page.x,y:page.y,duration:0},
  {type:"pointerDown",button:0},{type:"pause",duration:30},{type:"pointerUp",button:0}
 ]);
 const baseline=await proof();
 assert.equal(baseline.transportState,"granted","native actor must own real 0x11 lease");
 const beforeReceipts=baseline.acknowledged.length;
 const beforeWorld=readAuthoritativeWorld().length;
 let spaceDown=false;
 try {
  await sendKeys([{type:"keyDown",value:" "}]);spaceDown=true;
  await click();
  await sleeps(500);
 } finally {
  if(spaceDown)await sendKeys([{type:"keyUp",value:" "}]).catch(()=>{});
 }
 const afterSpace=await proof();
 const noLightReceipts=afterSpace.acknowledged.slice(beforeReceipts);
 const firstWorld=readAuthoritativeWorld().slice(beforeWorld);
 const witnessed=await edges();
 assert.deepEqual(witnessed.slice(0,4).map(e=>e.type),
  ["keydown","pointerdown","pointerup","keyup"],
  "native W3C must dispatch genuine Space+LMB DOWN/UP, no missing events");
 assert.ok(witnessed.slice(0,4).every(e=>e.trusted),"native Space events must be trusted");
 assert.equal(noLightReceipts.filter(e=>e.source===0&&e.action===1).length,0,
  "Space-held LMB must NOT author ordinary typed Light PRESS");
 assert.ok(!/M201_AUTH_GESTURE_ACTION tick=\d+ fighter=1 source=0 .*eventAction=1 status=1/.test(firstWorld),
  "original World cannot admit a fabricated ordinary LMB Light during Space");
 assert.ok(!/M201_AUTH_HIT tick=\d+ attacker=1 /.test(firstWorld),
  "Space-held LMB must not cause original World Light/Heavy damage");
 assert.equal(afterSpace.failed,false,"Space chord must not retire authenticated v2 QUIC");
 assert.equal(afterSpace.closed,false,"Space chord keeps original actor connection open");
 // A previously blocked chord must not poison subsequent ordinary source0.
 await waitFor(async()=>{
  const p=await proof();return p.replicatedFighters?.find(f=>f.netId===actorId)?.action===0?p:false;
 },8000);
 const beforeNormal=(await proof()).acknowledged.length;
 await click();
 const afterNormal=await waitFor(async()=>{
  const p=await proof(),later=p.acknowledged.slice(beforeNormal);
  return [1,3].every(action=>later.some(e=>e.source===0&&e.action===action&&e.status===1))?p:false;
 },9000);
 const normal=afterNormal.acknowledged.slice(beforeNormal);
 assert.deepEqual(normal.filter(e=>e.source===0&&e.status===1).map(e=>e.action),[1,3],
  "ordinary post-Space LMB still commits one valid pressed/released gesture");
 assert.equal(afterNormal.failed,false,"normal source0 must not disconnect");
 // Second genuine W3C order: LMB down BEFORE Space, then actual physical
 // keydown must send one same-lease CANCEL, never a synthetic RELEASE.
 // A slow driver may legitimately let early Light contact happen before
 // cancellation; the original World cannot retroactively erase that HIT.
 await waitFor(async()=>{
  const p=await proof();
  return p.replicatedFighters?.find(f=>f.netId===actorId)?.action===0?p:false;
 },9000);
 const beforeCancelReceipts=(await proof()).acknowledged.length;
 const beforeCancelWorld=readAuthoritativeWorld().length;
 let pointerHeld=false, spaceHeld=false;
 try{
  await sendPointer([
   {type:"pointerMove",origin:"viewport",x:page.x,y:page.y,duration:0},
   {type:"pointerDown",button:0}
  ]);pointerHeld=true;
  await sendKeys([{type:"keyDown",value:" "}]);spaceHeld=true;
 }finally{
  if(pointerHeld)await sendPointer([{type:"pointerUp",button:0}]).catch(()=>{});
  if(spaceHeld)await sendKeys([{type:"keyUp",value:" "}]).catch(()=>{});
 }
 const cancelProof=await waitFor(async()=>{
  const p=await proof(),newReceipts=p.acknowledged.slice(beforeCancelReceipts);
  return newReceipts.some(e=>e.source===0&&e.action===4&&e.status===1)?p:false;
 },8000);
 const cancelled=cancelProof.acknowledged.slice(beforeCancelReceipts);
 const firstPress=cancelled.filter(e=>e.source===0&&e.action===1&&e.status===1);
 const terminals=cancelled.filter(e=>e.source===0&&(e.action===3||e.action===4));
 assert.equal(firstPress.length,1,"one real first-pressed source0 gesture");
 assert.deepEqual(terminals.map(e=>e.action),[4],
  "Space after LMB must CANCEL without an extra typed RELEASE");
 assert.equal(firstPress[0].gestureId,terminals[0].gestureId,
  "cancel belongs to original authenticated physical LMB gesture");
 assert.equal(cancelProof.failed,false,"late Space cancel must keep QUIC lease alive");
 assert.equal(cancelProof.closed,false,"late Space cancel must not disconnect player");
 const cancelWorld=readAuthoritativeWorld().slice(beforeCancelWorld);
 const damaging=cancelWorld.split("\n").filter(e=>
  new RegExp("M201_AUTH_HIT tick=\\d+ attacker="+actorId+" ").test(e));
 assert.ok(damaging.length<=1,"mid-hold Space may not produce double Light/Heavy World HIT");
 const evidence={sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"local",
  mode:physicalMode,originalFirstPartyPage:true,originalQUIC:true,
  genuineChromeOrFirefox:true,independentPhysicalHumanHosts:false,
  physicalSpaceAndLmb:witnessed,spaceChordReceipts:noLightReceipts,
  ordinaryAfterSpaceReceipts:normal,worldAfterSpace:firstWorld,
  midHoldSpaceCancelReceipts:cancelled,midHoldWorld:cancelWorld,
  nativePhysicalAll:await edges(),
  before:baseline,afterSpace,afterNormal,afterCancel:cancelProof,
  limitation:"NO actual v2 JumpAttack demonstrated or released"};
 await writeFile(join(output,"combat4-space-chord-real-native-original-world.json"),
  JSON.stringify(evidence,null,2)+"\n");
 console.log("COMBAT4_NATIVE_SPACE_CHORD_NO_FALSE_LIGHT_PASS",JSON.stringify(evidence));
}else if(physicalMode==="held-lmb"){
  // A separate fresh World preserves the original held-LMB and short-LMB acceptance
  // below. The real game page owns every canonical source0 edge and ACK.
  const attacker=actors[0].s,attackerId=actors[0].actor.id,targetId=actors[1].actor.id;
  const worldStart=readAuthoritativeWorld().length;
  const worldLines=()=>readAuthoritativeWorld().slice(worldStart).split("\n");
  const actions=()=>worldLines().flatMap(line=>{
   const m=line.match(/^M201_AUTH_ACTION tick=(\d+) fighter=(\d+) from=(\d+) to=(\d+)\s*$/);
   return m&&Number(m[2])===attackerId?[{line,tick:Number(m[1]),from:Number(m[3]),to:Number(m[4])}]:[];
  });
  // Exact under-lock mutations prove transient PRESS/UPGRADE even if both
  // arrive before the next 60Hz sampled action print. Never infer 0->1->9
  // from a sampled 0->9 or from transport ACKs alone.
  const admissions=()=>worldLines().flatMap((line,index)=>{
   const m=line.match(/^M201_AUTH_GESTURE_ACTION tick=(\d+) fighter=(\d+) source=(\d+) gesture=(\d+) sequence=(\d+) eventAction=(\d+) status=(\d+) from=(\d+) to=(\d+)\s*$/);
   return m&&Number(m[2])===attackerId?[{line,index,tick:Number(m[1]),fighter:Number(m[2]),source:Number(m[3]),
    gesture:Number(m[4]),sequence:Number(m[5]),eventAction:Number(m[6]),status:Number(m[7]),from:Number(m[8]),to:Number(m[9])}]:[];
  });
  const hits=()=>worldLines().filter(line=>new RegExp("^M201_AUTH_HIT tick=\\d+ attacker="+attackerId+" target=\\d+ damage=").test(line));
  const pointer=await evaluate(attacker,String.raw`
   const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();
   const b=c.getBoundingClientRect(),events=[];
   for(const type of ['pointerdown','pointerup','pointercancel']){
    window.addEventListener(type,e=>{if(e.button===0){events.push({type,trusted:e.isTrusted,
     pointerId:e.pointerId,pointerType:e.pointerType,at:performance.now(),epochMs:Date.now()});
     if(events.length>12)events.shift();}},true);
   }
   window.__MYASO_COMBAT4_HELD_LMB_TRACE__=()=>events.map(e=>({...e}));
   return {x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.50),focused:document.activeElement===c};`);
  assert(pointer.focused,"actual original canvas owns held LMB");
  const physical=()=>evaluate(attacker,"return {events:window.__MYASO_COMBAT4_HELD_LMB_TRACE__(),gesture:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null};");
  let physicalUpCompleted=false;
  try{
   await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
    actions:[{type:"pointer",id:"real-held-lmb",parameters:{pointerType:"mouse"},actions:[
     {type:"pointerMove",origin:"viewport",x:pointer.x,y:pointer.y,duration:0},
     {type:"pointerDown",button:0},
    ]}]
   });
   const upgrade=await waitFor(()=>{
    const a=admissions().filter(e=>e.source===0&&e.status===1);
    const light=a.find(e=>e.eventAction===1&&e.from===0&&e.to===1);
    const heavy=a.find(e=>e.eventAction===2&&e.from===1&&e.to===9);
    return light&&heavy?{light,heavy}:false;
   },5000);
   assert.ok(upgrade.heavy.index>upgrade.light.index,"actual under-lock PRESS mutation precedes UPGRADE, including same-tick delivery");
   assert.equal(upgrade.heavy.gesture,upgrade.light.gesture,"actual PRESS and UPGRADE own one gesture");
   assert.ok(upgrade.heavy.sequence>upgrade.light.sequence,"actual UPGRADE sequence follows physical PRESS");
   assert.ok(upgrade.heavy.tick>=upgrade.light.tick,"World upgrade follows original light windup");
   assert.ok((upgrade.heavy.tick-upgrade.light.tick)*1000/60<135,
    "genuine held LMB must upgrade in original World BEFORE 135ms light active deadline");
   await sleeps(460); // authentic browser remains physically held beyond READY320ms
   const held=await physical();
   assert.equal(held.events.length,1,"physical UP/cancel must not occur while held");
   assert.equal(held.events[0].type,"pointerdown");
   assert.equal(held.events[0].trusted,true);
   assert.equal(held.events[0].pointerType,"mouse");
   assert.ok(!actions().some(e=>e.to===2||e.to===10),"neither light nor heavy may become Active while physically held");
   assert.equal(hits().length,0,"held LMB must never auto-hit any World fighter");
   await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
    actions:[{type:"pointer",id:"real-held-lmb",parameters:{pointerType:"mouse"},actions:[{type:"pointerUp",button:0}]}]
   });
   physicalUpCompleted=true;
   const heavyActive=await waitFor(()=>actions().find(e=>e.from===9&&e.to===10),5000);
   await waitFor(()=>hits().length>0,5000);
   await waitFor(()=>actions().find(e=>e.from===11&&e.to===0),5000);
   await sleeps(250); // observe entire completed World commitment, including duplicate-hit negatives
   const released=await physical();
   assert.equal(released.events.length,2,"exactly one physical down/up pair, no cancellation or second click");
   const [down,up]=released.events;
   assert.equal(up.type,"pointerup");assert.equal(up.trusted,true);
   assert.equal(up.pointerId,down.pointerId,"matching physical pointer owns release");
   assert.ok(up.at-down.at>320,"actual physical LMB hold exceeds server heavy READY duration");
   const admitted=admissions().filter(e=>e.source===0&&e.status===1);
   assert.equal(admitted.filter(e=>e.eventAction===1&&e.from===0&&e.to===1).length,1,
    "exactly one actual under-lock World light windup, independent of sampled observations");
   assert.equal(admitted.filter(e=>e.eventAction===2&&e.from===1&&e.to===9).length,1,
    "exactly one actual under-lock World light-to-heavy upgrade, independent of sampled observations");
   assert.equal(actions().filter(e=>e.to===2).length,0,"upgraded hold cannot produce a double light active");
   assert.equal(actions().filter(e=>e.to===10).length,1,"physical release commits heavy exactly once");
   assert.equal(hits().length,1,"exactly one World HIT from physical held LMB");
   assert.match(hits()[0],new RegExp("^M201_AUTH_HIT tick=\\d+ attacker="+attackerId+" target="+targetId+" damage=46 hp=54\\s*$"),
    "exactly46HP belongs to intended independent fighter; no34HP or fallback damage");
   const ack=await waitFor(async()=>{
    const p=await physical(),receipts=p.gesture?.acknowledged??[];
    return [1,2,3].every(action=>receipts.some(r=>r.source===0&&r.action===action&&r.status===1))?p:false;
   },5000);
   const accepted=ack.gesture.acknowledged.filter(r=>r.source===0&&r.status===1);
   assert.equal(new Set(accepted.map(r=>r.gestureId)).size,1,"PRESS/UPGRADE/RELEASE ACKs own the same actual source0 gesture");
   for(const action of [1,2,3])assert.equal(accepted.filter(r=>r.action===action).length,1,"one accepted ACK per physical gesture edge");
   const releaseReceipt=accepted.find(r=>r.action===3);
   const worldRelease=admitted.filter(e=>e.eventAction===3&&e.from===9&&e.to===10);
   assert.equal(worldRelease.length,1,"matching physical release mutates actual World HeavyWindup to HeavyActive exactly once");
   assert.equal(worldRelease[0].gesture,upgrade.light.gesture);
   assert.ok(worldRelease[0].index>upgrade.heavy.index,"World release follows actual upgrade mutation");
   assert.ok(heavyActive.tick>=worldRelease[0].tick,"sampled HeavyActive follows actual release mutation");
   for(const receipt of accepted){
    const mutation=admitted.filter(e=>e.eventAction===receipt.action&&e.sequence===receipt.sequence&&e.gesture===receipt.gestureId);
    assert.equal(mutation.length,1,"each accepted source0 receipt correlates to one actual World-lock admission");
    assert.equal(receipt.serverTick,mutation[0].tick,"accepted ACK server tick matches the exact World-lock admission");
   }
   assert.ok(heavyActive.tick>=releaseReceipt.serverTick,
    "World HeavyActive cannot precede server admission of matching genuine physical UP");
   // Read each independent client's existing authoritative own HUD. These
   // values come from real replicas; no hidden gameplay object is written.
   const replicas=await waitFor(async()=>{
    const states=await Promise.all(actors.map(async({s,actor})=>({actorId:actor.id,browser:s.engine,
     ...await evaluate(s,String.raw`return {
      hp:Number(document.querySelector('#player-hp-value')?.textContent),
      guard:Number(document.querySelector('#player-guard-value')?.textContent),
      stamina:Number(document.querySelector('#player-stamina-value')?.textContent),
      status:document.querySelector('#event-text')?.textContent||'',
      roster:[...document.querySelectorAll('#scoreboard-list li')].map(li=>li.textContent||'')};`)})));
    return states.every(s=>s.hp===(s.actorId===targetId?54:100)&&s.guard===100&&s.stamina===100&&s.roster.length===4)?states:false;
   },5000);
   assert.equal(replicas.length,4,"all four original independent replicas confirm exact victim HP and preserved guard/stamina");
   const evidence={mode:physicalMode,sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"set-from-commit",
    attackerBrowser:attacker.engine,attackerId,targetId,physical:released.events,canonicalSource0Receipts:accepted,
    originalWorldUpgrade:upgrade,originalWorldGestureAdmissions:admissions(),originalWorldHeavyActive:heavyActive,originalWorldActions:actions(),originalWorldHits:hits(),
    replicas,originalGamePage:true,actualRustWorld:true,publicListener:false,independentPhysicalHumanHosts:false};
   await writeFile(join(output,"combat4-physical-held-lmb-upgrade-world.json"),JSON.stringify(evidence,null,2)+"\n");
   console.log("COMBAT4_PHYSICAL_HELD_LMB_UPGRADE_WORLD_PASS",JSON.stringify(evidence));
  }catch(error){
   const evidence={error:String(error),browser:await physical().catch(e=>({driverError:String(e)})),originalWorld:worldLines()};
   await writeFile(join(output,"combat4-physical-held-lmb-upgrade-failure.json"),JSON.stringify(evidence,null,2)+"\n");
   console.error("COMBAT4_PHYSICAL_HELD_LMB_UPGRADE_FAILURE",JSON.stringify(evidence));
   throw error;
  }finally{
   if(!physicalUpCompleted)await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
    actions:[{type:"pointer",id:"real-held-lmb",parameters:{pointerType:"mouse"},actions:[{type:"pointerUp",button:0}]}]
   }).catch(()=>{});
  }
 }else{
 const attacker=actors[0].s;
 const worldAction=(from,to)=>{
   const re=new RegExp("M201_AUTH_ACTION tick=\\d+ fighter=1 from="+from+" to="+to);
   return readAuthoritativeWorld().split("\n").find(line=>re.test(line));
 };
 const baseline=await waitFor(()=>{
   const line=readAuthoritativeWorld().split("\n").find(line=>/M201_FLIGHT_ACTOR_BASELINE tick=\d+ fighter=1 action=0/.test(line));
   return line||false;
 },12000);
 assert(baseline,"trusted first-seen original World Idle0 baseline");
 const firstCanvas=await evaluate(attacker,"const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();return {focused:document.activeElement===c,gestureLab:new URLSearchParams(location.search).get('gestureLab')};");
 assert.equal(firstCanvas.focused,true);
 assert.equal(firstCanvas.gestureLab,"1");
 // Combat4 QA-only, original real W3C page: preserve exact error provenance
 // for E no-combat denial and LMB physical source0 World admission.
 // Buffer stays in this loopback-native browser and is bounded to 24 entries.
 const keyETraceInstall=String.raw`
 if(window.__MYASO_COMBAT4_KEYE_TRACE__)return true;
 const records=[];
 const append=(entry)=>{records.push(Object.freeze(entry));if(records.length>24)records.shift();};
 for(const type of ["keydown","keyup"]){
   window.addEventListener(type,event=>{
     if(event.code!=="KeyE")return;
     append({type,code:event.code,trusted:event.isTrusted,repeat:event.repeat,
       focus:document.activeElement?.id||"",hidden:document.hidden,at:performance.now()});
   },true);
 }
 window.addEventListener("blur",()=>{
   append({type:"blur",focus:document.activeElement?.id||"",at:performance.now()});
 },true);
 const originalWarn=console.warn;
 console.warn=function(...args){
   if(args[0]==="authoritative protocol error"){
     const error=args[1];
     append({type:"protocol-error",name:String(error?.name||""),
       message:String(error?.message||error||"").slice(0,1400),
       stack:String(error?.stack||"").slice(0,2200),at:performance.now()});
   }
   return originalWarn.apply(this,args);
 };
 window.__MYASO_COMBAT4_KEYE_TRACE__=()=>records.map(entry=>({...entry}));
 return true;`;
 assert.equal(await evaluate(attacker,keyETraceInstall),true,"read-only KeyE release and raw protocol error provenance");
 // Genuine E press/release is now a NEGATIVE Combat check. Keep its
 // read-only W3C trace; the future Use/Interact system is not activated.
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
   actions:[{type:"key",id:"real-original-reserved-KeyE",actions:[
     {type:"keyDown",value:"e"},{type:"keyUp",value:"e"},
   ]}]
 });
 const eTrace=await evaluate(attacker,"return window.__MYASO_COMBAT4_KEYE_TRACE__()");
 assert.deepEqual(eTrace.filter(e=>e.code==="KeyE").map(e=>e.type),["keydown","keyup"],
   "true physical E must be seen but MUST NOT be a Combat gesture");
 assert.ok(eTrace.filter(e=>e.code==="KeyE").every(e=>e.trusted),
   "owner-reserved E must be checked using real trusted W3C events");
 assert(!worldAction(0,9)&&!worldAction(0,1),
   "reserved E must initiate neither heavy nor light World Combat");
 assert(!readAuthoritativeWorld().split("\n").some(line=>
   /M201_AUTH_HIT tick=\d+ attacker=1 /.test(line)),
   "reserved E must never cause World damage");

 // Keep the original four-browser SAME-ACTOR heavy46 THEN light34 strict
 // checks: heavy now uses physical HELD LMB, never obsolete KeyE.
 const heavyPointer=await evaluate(attacker,
   "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();const b=c.getBoundingClientRect();const events=[];for(const type of ['pointerdown','pointerup','pointercancel'])window.addEventListener(type,e=>{if(e.button===0)events.push({type,trusted:e.isTrusted,pointerId:e.pointerId,pointerType:e.pointerType,at:performance.now()})},true);window.__MYASO_MAIN0_LMB_HEAVY_TRACE__=()=>events.map(x=>({...x}));return {x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.50),focus:document.activeElement===c};");
 assert(heavyPointer.focus,"physical LMB heavy must own the original canvas");
 let pressed,heavy,heavyReleased=false;
 try {
   await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
     actions:[{type:"pointer",id:"real-original-lmb-heavy",
       parameters:{pointerType:"mouse"},actions:[
       {type:"pointerMove",origin:"viewport",x:heavyPointer.x,y:heavyPointer.y,duration:0},
       {type:"pointerDown",button:0},
     ]}]
   });
   // Genuine LMB first enters LightWindup1 and upgrades to HeavyWindup9
   // UNDER the original World lock. Sampled 60Hz action logs may show 0→1→9,
   // not legacy KeyE's direct 0→9. Require both real admitted source0 edges.
   pressed=await waitFor(()=>{
     const admissions=readAuthoritativeWorld().split("\n").filter(line=>
       /M201_AUTH_GESTURE_ACTION tick=\d+ fighter=1 source=0 gesture=\d+ sequence=\d+ eventAction=\d+ status=1 from=\d+ to=\d+/.test(line));
     const light=admissions.find(line=>/eventAction=1 status=1 from=0 to=1/.test(line));
     const upgrade=admissions.find(line=>/eventAction=2 status=1 from=1 to=9/.test(line));
     return light&&upgrade?upgrade:false;
   },12000);
   await sleeps(460); // World READY320ms must NOT auto-strike while held
   assert(!worldAction(9,10),"held LMB cannot commit World heavy before release");
   const heldTrace=await evaluate(attacker,"return window.__MYASO_MAIN0_LMB_HEAVY_TRACE__()");
   const down=heldTrace.filter(e=>e.type==="pointerdown");
   assert.equal(down.length,1,"heavy comes from exactly one physical LMB down");
   assert.equal(heldTrace.filter(e=>e.type==="pointerup"||e.type==="pointercancel").length,0);
   assert.equal(down[0].trusted,true);
   assert.equal(down[0].pointerType,"mouse");
   await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
     actions:[{type:"pointer",id:"real-original-lmb-heavy",
       parameters:{pointerType:"mouse"},actions:[{type:"pointerUp",button:0}]}]
   });
   heavyReleased=true;
   heavy=await waitFor(()=>worldAction(9,10),12000);
   const released=await evaluate(attacker,"return window.__MYASO_MAIN0_LMB_HEAVY_TRACE__()");
   const ups=released.filter(e=>e.type==="pointerup");
   assert.equal(ups.length,1,"heavy requires one deliberate W3C physical UP");
   assert.equal(ups[0].trusted,true);
   assert.equal(ups[0].pointerId,down[0].pointerId,"heavy UP must match LMB DOWN");
   assert.ok(ups[0].at-down[0].at>320,"heavy was genuinely held beyond World READY320");
   await waitFor(()=>readAuthoritativeWorld().split("\n").some(line=>
     /M201_AUTH_HIT tick=\d+ attacker=1 target=2 damage=46 hp=54/.test(line)),12000);
   assert.equal(readAuthoritativeWorld().split("\n").filter(line=>
     /M201_AUTH_HIT tick=\d+ attacker=1 target=2 damage=46 hp=54/.test(line)).length,1,
     "original World must commit exactly one 46HP HIT from source0 held LMB");
 }catch(error){
   const page=await evaluate(attacker,
     "return {event:document.querySelector('#event-text')?.textContent||'',gesture:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null,keyE:window.__MYASO_COMBAT4_KEYE_TRACE__?.()??[],physicalLmb:window.__MYASO_MAIN0_LMB_HEAVY_TRACE__?.()??[]};"
   ).catch(e=>({driverError:String(e)}));
   const evidence={error:String(error),browser:page,originalRustWorldTail:readAuthoritativeWorld().slice(-6500)};
   await writeFile(join(output,"combat4-lmb-heavy-release-protocol-error.json"),JSON.stringify(evidence,null,2));
   console.error("MAIN0_ORIGINAL_GAME_LMB_HEAVY_RELEASE_DIAGNOSTIC",JSON.stringify(evidence));
   throw error;
 }finally{
   if(!heavyReleased)await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
     actions:[{type:"pointer",id:"real-original-lmb-heavy",
       parameters:{pointerType:"mouse"},actions:[{type:"pointerUp",button:0}]}]
   }).catch(()=>{});
 }
 const heavyReturnedIdle=await waitFor(()=>{
   const lines=readAuthoritativeWorld().split("\n");
   const after=lines.findIndex(line=>line===heavy);
   return after>=0 && lines.slice(after+1).find(line=>/M201_AUTH_ACTION tick=\d+ fighter=1 from=\d+ to=0/.test(line));
 },14000);
 assert(heavyReturnedIdle,"new physically pressed light starts only after original World returns to Idle");
 // True original Light reach is 76 + fighter radius 18 = 94 world units.
 // Heavy knockback and W3C keyboard scheduling make a fixed hold unreliable.
 // Require real replicated World geometry before one physical Light click;
 // never mutate fighter coordinates, World reach or attack authority.
 const geometryAttempts=[];
 const readOriginalPair=async()=>{
  const p=await evaluate(attacker,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
  return {tick:p?.serverTick??null,
   a:p?.replicatedFighters?.find(f=>f.netId===1)??null,
   t:p?.replicatedFighters?.find(f=>f.netId===2)??null};
 };
 // The original World heavy-return-to-Idle receipt only covers attacker #1;
 // defender #2 may still be in authentic damage recovery. Wait for BOTH
 // replicated World actors to be Idle before genuine physical Light staging.
 // Bounded read-only wait; preserve every strict stage/HP/reach assertion.
 const idleBeforeLight=await waitFor(async()=>{
  const pair=await readOriginalPair();
  return pair.a?.action===0&&pair.t?.action===0?pair:false;
 },5000).catch(async error=>{
  const pair=await readOriginalPair().catch(()=>null);
  console.error("COMBAT4C_POST_HEAVY_IDLE_WAIT_FAILED",JSON.stringify({
   error:String(error),pair,originalWorldTail:readAuthoritativeWorld().slice(-2200),
  }));
  throw error;
 });
 console.log("COMBAT4C_POST_HEAVY_BOTH_IDLE",JSON.stringify(idleBeforeLight));
 let stage=null;
 for(let attempt=0;attempt<6;attempt++){
  const before=await readOriginalPair(),{a,t}=before;
  assert.ok(a&&t&&a.action===0&&t.action===0,
   "real original World attackers must be Idle for Light staging");
  assert.ok(Math.abs(t.y-a.y)<=8,"original Light staging must keep the real horizontal lane");
  const gap=t.x-a.x;
  if(gap>COMBAT.fighterRadius*2+8&&gap<=COMBAT.attack.reach+COMBAT.fighterRadius-8){
   await sleeps(120);
   const verified=await readOriginalPair();
   if(verified.tick>before.tick && verified.a && verified.t
    && Math.abs(verified.a.x-a.x)<=2 && Math.abs(verified.t.x-t.x)<=2
    && Math.abs(verified.t.y-t.y)<=2){stage={before,verified,gap,geometryAttempts};break;}
  }else{
   const distance=gap-(COMBAT.attack.reach-8);
   const key=distance>=0?"d":"a";
   const ms=Math.max(80,Math.min(200,Math.ceil(Math.abs(distance)*1000/COMBAT.moveSpeed)));
   assert.equal(await evaluate(attacker,
    "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();return document.activeElement===c;"),
    true,"physical WASD needs original focused arena");
   await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
    actions:[{type:"key",id:"real-original-post-heavy-world-staging",actions:[
     {type:"keyDown",value:key},{type:"pause",duration:ms},{type:"keyUp",value:key},
    ]}]
   });
   await sleeps(310); // avoid an accidental second-tap native Dash
   geometryAttempts.push({attempt,key,ms,before,after:await readOriginalPair()});
  }
 }
 assert.ok(stage,"genuine movement failed stable original Light geometry: "+JSON.stringify(geometryAttempts));
 console.log("COMBAT4C_ORIGINAL_LIGHT_GEOMETRY_STAGED",JSON.stringify(stage));
 const pointer=await evaluate(attacker, "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();const b=c.getBoundingClientRect();return {x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.50),focus:document.activeElement===c};");
 assert(pointer.focus,"actual canvas must own physical LMB before W3C action");
 const shortLightWorldStart=readAuthoritativeWorld().length;
 // One physical W3C pointer action tick sequence. Do NOT wait for a
 // server Windup log while the mouse remains held: the original 85ms local
 // UPGRADE-intent hook can correctly request server-held heavy after that.
 // This click has real DOWN and actual UP 25ms later, never a synthetic hit.
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
   actions:[{type:"pointer",id:"real-original-lmb",parameters:{pointerType:"mouse"},actions:[
    {type:"pointerMove",origin:"viewport",x:pointer.x,y:pointer.y,duration:0},
    {type:"pointerDown",button:0},
    {type:"pause",duration:25},
    {type:"pointerUp",button:0},
   ]}]
 });
 const lightPress=await waitFor(()=>readAuthoritativeWorld().slice(shortLightWorldStart)
   .split("\n").find(line=>/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=1/.test(line)),12000);
 let lightActive;
 try {
   lightActive=await waitFor(()=>readAuthoritativeWorld().slice(shortLightWorldStart)
   // A genuine short W3C click may briefly UPGRADE before release; the original
   // World then resumes undercharged HeavyWindup(9) directly to LightActive(2).
   // The strict original-World 34HP HIT / one-shot assertions below remain mandatory.
    .split("\n").find(line=>/M201_AUTH_ACTION tick=\d+ fighter=1 from=(?:1|9) to=2/.test(line)),12000);
 } catch(error) {
   const browser=await evaluate(attacker,
    "return {event:document.querySelector('#event-text')?.textContent||'',gesture:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null};"
   ).catch(e=>({driverError:String(e)}));
   console.error("MAIN0_ORIGINAL_GAME_SHORT_LMB_DIAGNOSTIC",
    JSON.stringify({error:String(error),browser,originalRustWorldTail:readAuthoritativeWorld().slice(-6500)}));
   throw error;
 }
 const honestWorldHits=readAuthoritativeWorld().split("\n")
  .filter(line=>/M201_AUTH_HIT tick=\d+ attacker=1 target=\d+ damage=(34|46) hp=/.test(line));
 assert.ok(honestWorldHits.some(line=>/damage=46(?:\\.0+)? hp=/.test(line)),
  "original Rust World must prove true 46 HP heavy strike against an independent fighter");
 if(!honestWorldHits.some(line=>/damage=34(?:\\.0+)? hp=/.test(line))){
  // Forensics ONLY after the actual World light reached Active; retain the
  // original hard 34HP gate below verbatim. A true whiff is not ACK-as-hit.
  const rawWorld=readAuthoritativeWorld().split("\n");
  const sourcePage=await evaluate(attacker,
   "return {event:document.querySelector('#event-text')?.textContent||'',gesture:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null,physicalKeyEAndProtocolErrors:window.__MYASO_COMBAT4_KEYE_TRACE__?.()??[]};"
  ).catch(error=>({browserEvidenceError:String(error)}));
  const evidence={
   status:"genuine original 34HP light hit MISSING",
   mandatoryTest:"original Rust World must prove true 34 HP light strike against an independent fighter",
   heavyWorldAction:heavy,lightWorldPress:lightPress,lightWorldActive:lightActive,
   actualHits:honestWorldHits,
   originalWorldActionsAndHits:rawWorld.filter(line=>
    /M201_(AUTH_ACTION|AUTH_HIT|AUTH_BLOCK|AUTH_PARRY|AUTH_BREAK|FLIGHT_ACTOR_BASELINE)/.test(line)
   ).slice(-200),
   originalServerWorldTail:rawWorld.slice(-240),
   attackerPage:sourcePage,
   fourRealIndependentSeatRoster:trial.map(x=>({browser:x.browser,actorId:x.actorId})),
   caveat:"ACK/admitted action != actual 34HP hit; strict gate remains unchanged",
  };
  await writeFile(join(output,"combat4-original-light-no-34hp-world-diagnostic.json"),
   JSON.stringify(evidence,null,2)+"\n");
  console.error("COMBAT4C_REAL_WORLD_LIGHT_NO_34HP_DIAGNOSTIC",JSON.stringify({
   ...evidence,originalServerWorldTail:evidence.originalServerWorldTail.slice(-50),
  }));
 }
 assert.ok(honestWorldHits.some(line=>/damage=34(?:\\.0+)? hp=/.test(line)),
  "original Rust World must prove true 34 HP light strike against an independent fighter");
 assert.equal(honestWorldHits.filter(line=>/damage=46 hp=/.test(line)).length,1,
   "held source0 LMB can commit only one 46HP original World HIT");
 assert.equal(honestWorldHits.filter(line=>/damage=34 hp=/.test(line)).length,1,
   "short source0 LMB can commit only one 34HP original World HIT; exact World HIT evidence="+JSON.stringify(honestWorldHits));
 assert.ok(honestWorldHits.some(line=>
   /M201_AUTH_HIT tick=\d+ attacker=1 target=2 damage=34 hp=20/.test(line)),
   "genuine light hits the original heavy-damaged target for exactly 34 more HP");
 console.log("MAIN0_ORIGINAL_GAME_PHYSICAL_V2_QUIC_WORLD_ACTIONS",JSON.stringify({
  realChromeOrFirefox:true,originalGamePage:true,serverIssuedQuicActor:1,
  physicalKeyEReservedForUse:true,physicalLMBHeldHeavyRelease:true,physicalLMBPointerDown:true,
  trustedWorldHeavyPress:pressed,trustedWorldHeavyRelease:heavy,
  trustedWorldLightPress:lightPress,trustedWorldLightActive:lightActive,
  originalWorldCombatHitEvidence:honestWorldHits,
  actualIndependentHumanOperators:false,publicListener:false,
 }));
 }
 if(chatC1&&physicalMode==="held-lmb") {
  const s=actors[0].s,id=actors[0].actor.id,start=readAuthoritativeWorld().length;
  const proof=()=>evaluate(s,"return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
  await waitFor(async()=>{const p=await proof();return p?.replicatedFighters?.find(f=>f.netId===id)?.action===0;});
  const source=(await proof()).nextSequence;
  const pointer=pressed=>request(s.base,"POST","/session/"+s.id+"/actions",{actions:[{
   type:"pointer",id:"real-held-lmb",parameters:{pointerType:"mouse"},
   actions:[{type:pressed?"pointerDown":"pointerUp",button:0}],
  }]});
  const key=value=>request(s.base,"POST","/session/"+s.id+"/actions",{actions:[{
   type:"key",id:"actual-cancel-chat",actions:[{type:"keyDown",value},{type:"keyUp",value}],
  }]});
  await pointer(true);
  const ready=await waitFor(async()=>{
   const p=await proof(),press=p?.acknowledged?.find(e=>e.sequence>=source&&e.action===1&&e.status===1);
   const upgraded=p?.acknowledged?.some(e=>e.sequence>=source&&e.action===2&&e.status===1);
   return press&&upgraded&&p.serverTick-press.serverTick>=20
     &&p.replicatedFighters.find(f=>f.netId===id)?.action===9?p:false;
  });
  await key("\uE007");
  assert.equal(await evaluate(s,"return document.activeElement?.matches('.local-chat-input');"),true);
  await waitFor(async()=>{
   const p=await proof();return p?.acknowledged?.some(e=>e.sequence>=source&&e.action===4&&e.status===1)
     &&p.replicatedFighters.find(f=>f.netId===id)?.action===0;
  });
  await pointer(false);
  await key("\uE00C");
  assert.equal(await evaluate(s,"return document.activeElement?.id==='arena';"),true);
  const p=await proof(),lines=readAuthoritativeWorld().slice(start).split("\n");
  assert.equal(lines.some(line=>/^M201_AUTH_HIT /.test(line)),false,"opening chat cancels held READY without damage");
  assert.equal(p.acknowledged.some(e=>e.sequence>=source&&e.action===3),false,"cancelled source cannot acquire a phantom release");
  const evidence={actor:id,sourceSequence:source,readyServerTick:ready.serverTick,
   receipts:p.acknowledged.filter(e=>e.sequence>=source),originalWorld:lines};
  await writeFile(join(output,"combat4-chat-cancels-held-ready.json"),JSON.stringify(evidence,null,2)+"\n");
  console.log("COMBAT4_NATIVE_CHAT_CANCEL_HELD_READY_PASS",JSON.stringify(evidence));
  await nativeChatRound("After physical Heavy release");
 }
 const report={physicalMode,chatC1,instantLmb,sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"set-from-commit",actualRustWebTransport:true,
  actualOriginalClient:true,realSeparateNativeBrowserProcesses:seatCount,independentPhysicalHumanHosts:false,
  authenticSilverKnightIntegrationVerified:true,allFiveClipsVisuallyValidated:false,
  trueFourIndependentHumanOperators:false,modeIsOptional:physicalMode==="space-guard",defaultArenaPreserved:true,
  genuineFullCombatApproval:false,trials:trial};
 await writeFile(join(output,"main0-knights-original-game-native.json"),JSON.stringify(report,null,2)+"\n");
 console.log( "MAIN0_KNIGHTS_ORIGINAL_GRID_REAL_W3C_PASS "+JSON.stringify({pass:true,source:report.sourceCommit,actors:trial.map(x=>x.actorId),browsers:trial.map(x=>x.browser),floors:trial.map(x=>({mode:x.mode,centerLuminance:x.data.floor.centerLuminance,frames:x.data.frames,p95:x.data.frameIntervalP95Ms,silverWebP:x.data.knightWebPDraws,sources:x.data.knightSources})),screenshots:trial.map(x=>x.screenshot)}));
}finally{
 for(const s of sessions){try{await request(s.base,"DELETE","/session/"+s.id)}catch{}}
 for(const child of processes){try{child.kill("SIGTERM")}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
