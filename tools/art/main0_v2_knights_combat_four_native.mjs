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

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const engines=(process.env.MYASO_LIVE_GESTURE_NATIVE_BROWSERS||"chrome,chrome,chrome,chrome").split(",");
const physicalMode=process.env.MYASO_LIVE_GESTURE_PHYSICAL_MODE||"original";
assert.ok(["original","held-lmb"].includes(physicalMode),"unknown physical gesture acceptance mode");
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
 const build=spawnSync("cargo",["build",...(process.env.MYASO_LIVE_GESTURE_CARGO_OFFLINE==="0"?[]:["--offline"]),"--locked","--manifest-path","server/Cargo.toml","--bin","myaso-server","--quiet"],{cwd:root,encoding:"utf8",timeout:150000});
 if(build.status!==0)throw Error("exact source local Rust build failed: "+String(build.stderr||build.error).slice(-1900));
 const child=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",MYASO_EXPERIMENTAL_GESTURE_V2:"1",MYASO_FLIGHT_ACTION_PROOF:"1"},stdio:["ignore","pipe","pipe"]});
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
await mkdir(output,{recursive:true});
try{
 const {url:rustUrl,cert,readAuthoritativeWorld}=await startOriginalRust(),host=await startStatic();
 const actors=[];
 for(let i=0;i<4;i++){
  const s=await startW3C(engines[i],i);const flag="0";
  const u=new URL(host+"/web/index.html");u.searchParams.set("server",rustUrl);u.searchParams.set("cert",cert);u.searchParams.set("knights","1");u.searchParams.set("knightArt","relit");u.searchParams.set("gestureLab","1");
  await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
  const actor=await waitFor(async()=>{let t=await evaluate(s,"return document.querySelector('#event-text')?.textContent||'';");const m=t?.match(/Online - player #(\d+) - server tick (\d+)/);return m?{id:Number(m[1]),tick:Number(m[2])}:null},16000);
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
  assert.ok(data.roster.length>=4,"genuine same-server four human roster must be visible");
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
 assert.equal(trial.length,4,"four real native fighter sessions required");
 assert.ok(trial.every(x=>x.mode==="grid"),"release slice must use original grid on every browser, never optional terrain");

 // First-party unchanged /web/index.html game page, not a synthetic QA UI.
 // True WebDriver key/pointer actions run against a fresh admitted original
 // Rust QUIC actor. M201 prints are read-only World mutation events, not HUD.
 if(physicalMode==="held-lmb"){
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
 // Real original World spawns fighter #1/#2 96px apart. Light reaches
 // 76px + 18px fighter radius = 94px, while the preceding true 46HP
 // heavy reaches 82+18=100px and knocks the target BACK 28px.
 // Correct the authentic 4-human-actor QA staging, NOT World reach, hit
 // events or strict 34HP assertion: physically walk the real attacker
 // toward the knockback-displaced target using a trusted W3C key hold.
 // 220ms at the original 215px/s nominal walk speed is ~47px of reach
 // recovery, leaving genuine World collision/damage to decide success.
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[{type:"key",id:"real-original-post-heavy-forward-step",actions:[
   {type:"keyDown",value:"d"},
   {type:"pause",duration:220},
   {type:"keyUp",value:"d"},
  ]}]
 });
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
    .split("\n").find(line=>/M201_AUTH_ACTION tick=\d+ fighter=1 from=1 to=2/.test(line)),12000);
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
   "short source0 LMB can commit only one 34HP original World HIT");
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
 const report={physicalMode,sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"set-from-commit",actualRustWebTransport:true,
  actualOriginalClient:true,realSeparateNativeBrowserProcesses:4,independentPhysicalHumanHosts:false,
  authenticSilverKnightIntegrationVerified:true,allFiveClipsVisuallyValidated:false,
  trueFourIndependentHumanOperators:false,modeIsOptional:false,defaultArenaPreserved:true,
  genuineFullCombatApproval:false,trials:trial};
 await writeFile(join(output,"main0-knights-original-game-native.json"),JSON.stringify(report,null,2)+"\n");
 console.log( "MAIN0_KNIGHTS_ORIGINAL_GRID_REAL_W3C_PASS "+JSON.stringify({pass:true,source:report.sourceCommit,actors:trial.map(x=>x.actorId),browsers:engines,floors:trial.map(x=>({mode:x.mode,centerLuminance:x.data.floor.centerLuminance,frames:x.data.frames,p95:x.data.frameIntervalP95Ms,silverWebP:x.data.knightWebPDraws,sources:x.data.knightSources})),screenshots:trial.map(x=>x.screenshot)}));
}finally{
 for(const s of sessions){try{await request(s.base,"DELETE","/session/"+s.id)}catch{}}
 for(const child of processes){try{child.kill("SIGTERM")}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
