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
async function startOriginalRust(maxPlayers=4){
 const bin=join(root,"server","target","debug","myaso-server");
 const build=spawnSync("cargo",["build",...(process.env.MYASO_LIVE_GESTURE_CARGO_OFFLINE==="0"?[]:["--offline"]),"--locked","--manifest-path","server/Cargo.toml","--bin","myaso-server","--quiet"],{cwd:root,encoding:"utf8",timeout:150000});
 if(build.status!==0)throw Error("exact source local Rust build failed: "+String(build.stderr||build.error).slice(-1900));
 const child=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:String(maxPlayers),MYASO_EXPERIMENTAL_GESTURE_V2:"1",MYASO_FLIGHT_ACTION_PROOF:"1"},stdio:["ignore","pipe","pipe"]});
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
 // at KeyE PRESS/physical UP/typed ACK. Not a gameplay hook or hit simulator.
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
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
   actions:[{type:"key",id:"real-original-KeyE",actions:[{type:"keyDown",value:"e"}]}]
 });
 const pressed=await waitFor(()=>worldAction(0,9),12000);
 await sleeps(460); // source cannot release until genuine matching W3C KeyUP
 assert(!worldAction(9,10),"held native KeyE may READY but never auto-hit");
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
   actions:[{type:"key",id:"real-original-KeyE",actions:[{type:"keyUp",value:"e"}]}]
 });
 let heavy;
 try {
   heavy=await waitFor(()=>worldAction(9,10),12000);
 } catch (error) {
   const page=await evaluate(attacker,
     "return {event:document.querySelector('#event-text')?.textContent||'',gesture:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null,physicalKeyEAndProtocolErrors:window.__MYASO_COMBAT4_KEYE_TRACE__?.()??[]};"
   ).catch(e=>({driverError:String(e)}));
   const evidence={error:String(error),browser:page,originalRustWorldTail:readAuthoritativeWorld().slice(-6500)};
   await writeFile(join(output,"combat4-keye-release-protocol-error.json"),JSON.stringify(evidence,null,2));
   console.error("MAIN0_ORIGINAL_GAME_HEAVY_RELEASE_DIAGNOSTIC",JSON.stringify(evidence));
   throw error;
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
 const lightPress=await waitFor(()=>worldAction(0,1),12000);
 let lightActive;
 try {
   lightActive=await waitFor(()=>worldAction(1,2),12000);
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

 // Combat 4A independent true two-actor original World proof:
 // First preserve ALL preceding four OS browser / relit Silver Knights /
 // actual same-server QUIC World 46HP KeyE and 34HP standalone LMB gates.
 // FFA light swings can strike multiple valid victims; never mistake this
 // for duplicate source0 events. Now use a fresh ORIGINAL Rust World with a
 // real two-seat limit, not synthetic positions, ACK-as-hit or mocked actors.
 const chordHost=await startOriginalRust(2);
 const readChordWorld=chordHost.readAuthoritativeWorld;
 const trueChordSeats=actors.slice(0,2);
 for (const [seat,{s}] of trueChordSeats.entries()) {
   const url=new URL(host+"/web/index.html");
   url.searchParams.set("server",chordHost.url);
   url.searchParams.set("cert",chordHost.cert);
   url.searchParams.set("knights","1");
   url.searchParams.set("knightArt","relit");
   url.searchParams.set("gestureLab","1");
   await request(s.base,"POST","/session/"+s.id+"/url",{url:url.toString()},45000);
   const joined=await waitFor(async()=>{
     const status=await evaluate(s,
       "return document.querySelector('#event-text')?.textContent||'';");
     const match=status.match(/Online - player #(\d+) - server tick (\d+)/);
     return match?{id:Number(match[1]),tick:Number(match[2])}:false;
   },18000);
   assert.equal(joined.id,seat+1,
     "fresh original Rust World must independently admit Chrome1 and Firefox2");
 }
 const isolatedPair=await waitFor(async()=>{
   const list=await evaluate(attacker,
     "return [...document.querySelectorAll('#scoreboard-list li')].map(li=>li.textContent?.trim()||'');");
   return list?.length===2?list:false;
 },16000);
 assert.equal(isolatedPair.length,2,
  "fresh original Rust World must render exactly two live real-browser fighters");
 const chordBaseline=await waitFor(()=>readChordWorld().split("\n").find(line=>
   /M201_FLIGHT_ACTOR_BASELINE tick=\d+ fighter=1 action=0/.test(line)),12000);
 assert(chordBaseline,"fresh original two-human World has trusted Idle actor1 baseline");
 console.log("COMBAT4A_TRUE_ORIGINAL_TWO_ACTOR_WORLD",JSON.stringify({
   originalFourSeatNativeEvidencePreserved:true,
   freshIndependentRustWorld:true,genuineChromeFirefox:isolatedPair,
   noInjectedPlayerState:true
 }));
 // Original fighter1/fighter2 spawn 96px apart. After the REAL Chrome
 // navigation to the new World, focus the NEW game canvas before true W3C
 // keyboard movement; otherwise KeyD lands on document body and attacker
 // remains physically out of short-light range despite valid source0 ACKs.
 const movementCanvasFocused=await evaluate(attacker,
  "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();return document.activeElement===c;");
 assert.equal(movementCanvasFocused,true,
  "actual fresh native game canvas MUST own authentic keyboard positioning");
 // Physically move 140ms toward the real target so 34HP reach is genuine.
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
  actions:[{type:"key",id:"combat4a-original-new-two-seat-move",actions:[
   {type:"keyDown",value:"d"},{type:"pause",duration:140},{type:"keyUp",value:"d"},
  ]}]
 });
 const chordCanvas=await evaluate(attacker,
  "const c=document.querySelector('#arena');c.scrollIntoView({block:'center'});c.focus();const b=c.getBoundingClientRect();return {x:Math.round(b.left+b.width*.72),y:Math.round(b.top+b.height*.5),focus:document.activeElement===c};");
 assert(chordCanvas.focus,"original game canvas must own RMB+LMB physical input focus");
 const chordTraceInstall="if(window.__MYASO_COMBAT4A_RMB_CHORD_TRACE__)return true;\nconst events=[];\nfor(const type of [\"pointerdown\",\"pointerup\",\"mousedown\",\"mouseup\"]){\n  window.addEventListener(type,event=>{\n    if(event.button!==0 && event.button!==2)return;\n    events.push(Object.freeze({type,button:event.button,buttons:event.buttons,\n      trusted:event.isTrusted,onCanvas:event.target?.id===\"arena\",\n      focus:document.activeElement?.id||\"\",at:performance.now()}));\n    if(events.length>16)events.shift();\n  },true);\n}\nwindow.__MYASO_COMBAT4A_RMB_CHORD_TRACE__=()=>events.map(x=>({...x}));\nreturn true;";
 assert.equal(await evaluate(attacker,chordTraceInstall),true);
 const chordWorldOffset=readChordWorld().length;
 const chordBefore=await evaluate(attacker,
  "return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
 assert(chordBefore && !chordBefore.closed,"original live QUIC source0 lease required");
 // One driver action source, genuine mouse down2 -> short down0/up0 with RMB
 // held throughout, then up2. The 240ms RMB hold MUST NOT issue a tap-kick.
 await request(attacker.base,"POST","/session/"+attacker.id+"/actions",{
   actions:[{type:"pointer",id:"combat4a-original-world-physical-chord",
     parameters:{pointerType:"mouse"},actions:[
      {type:"pointerMove",origin:"viewport",x:chordCanvas.x,y:chordCanvas.y,duration:0},
      {type:"pointerDown",button:2},
      {type:"pause",duration:240},
      {type:"pointerDown",button:0},
      {type:"pause",duration:25},
      {type:"pointerUp",button:0},
      {type:"pause",duration:40},
      {type:"pointerUp",button:2},
     ]}]
 });
 const physicalChord=await evaluate(attacker,
  "return window.__MYASO_COMBAT4A_RMB_CHORD_TRACE__?.()??[];");
 const nativeChordDowns=physicalChord.filter(e=>
   e.type==="mousedown" && e.button===0 && (e.buttons&3)===3 && e.trusted && e.onCanvas);
 const nativeChordUps=physicalChord.filter(e=>
   e.type==="mouseup" && e.button===0 && (e.buttons&1)===0 && (e.buttons&2)===2 && e.trusted);
 assert.equal(nativeChordDowns.length,1,
  "real original-game browser must deliver one trusted RMB-held LMB mousedown");
 assert.equal(nativeChordUps.length,1,
  "real original-game browser must deliver one trusted LMB mouseup before RMB up");
 let chordHit;
 try {
   chordHit=await waitFor(()=>{
    const after=readChordWorld().slice(chordWorldOffset).split("\n");
    return after.find(line=>
      /M201_AUTH_HIT tick=\d+ attacker=1 target=2 damage=34 hp=/.test(line));
   },14000);
 }catch(error){
   const browser=await evaluate(attacker,
    "return {gesture:window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null,physical:window.__MYASO_COMBAT4A_RMB_CHORD_TRACE__?.()??[]};");
   const evidence={error:String(error),physicalChord,browser,
     originalWorldAfterChord:readChordWorld().slice(chordWorldOffset).slice(-8000)};
   await writeFile(join(output,"combat4a-rmb-chord-no-34hp-world.json"),
     JSON.stringify(evidence,null,2)+"\n");
   console.error("COMBAT4A_RMB_CHORD_WORLD_HIT_MISSING",JSON.stringify(evidence));
   throw error;
 }
 const chordWorld=readChordWorld().slice(chordWorldOffset).split("\n");
 const chordHits=chordWorld.filter(line=>
    /M201_AUTH_HIT tick=\d+ attacker=1 target=\d+ damage=(34|46) hp=/.test(line));
 console.log("COMBAT4A_CHORD_WORLD_REAL_HITS",JSON.stringify({
  chordHits,worldActionEvents:chordWorld.filter(line=>
   /M201_AUTH_ACTION tick=\\d+ fighter=1/.test(line)),physicalChord
 }));
 assert.equal(chordHits.length,1,
  "one true RMB-held LMB must never issue a second light or phantom heavy hit");
 assert.equal(chordHits[0],chordHit,"the one genuine World hit must be 34HP");
 assert(chordWorld.some(line=>/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=1/.test(line)),
  "original Rust World must admit the RMB-held LMB source0 LightWindup");
 assert(chordWorld.some(line=>/M201_AUTH_ACTION tick=\d+ fighter=1 from=1 to=2/.test(line)),
  "original Rust World must activate light from the RMB-held LMB");
 const chordAfter=await evaluate(attacker,
  "return window.__MYASO_LOCAL_GESTURE_PROOF__?.()??null;");
 const oldSource0=chordBefore.acknowledged.filter(e=>e.source===0);
 const newSource0=chordAfter.acknowledged.filter(e=>e.source===0
   && !oldSource0.some(old=>old.sequence===e.sequence));
 assert.equal(newSource0.length,2,
  "original World must acknowledge exactly one new source0 PRESS+RELEASE");
 assert.equal(newSource0[0].gestureId,newSource0[1].gestureId);
 assert.deepEqual(newSource0.map(e=>e.action),[1,3],
  "actual physical chord must not request upgrade, cancel or double press");
 console.log("COMBAT4A_ORIGINAL_GAME_RMB_LMB_QUIC_34HP_WORLD_PASS",JSON.stringify({
   genuineNativeBrowser:attacker.engine,
   actualOriginalPage:true,actualRustWorld:true,onePhysicalRmbHeldLmb:true,
   realTrustedDown:nativeChordDowns[0],realTrustedUp:nativeChordUps[0],
   originalWorldHit:chordHit,source0Edges:newSource0,
   originalWorldActionEvents:chordWorld.filter(line=>
     /M201_AUTH_ACTION tick=\d+ fighter=1/.test(line)),
   independentHumanHosts:false,publicListener:false
 }));

 console.log("MAIN0_ORIGINAL_GAME_PHYSICAL_V2_QUIC_WORLD_ACTIONS",JSON.stringify({
  realChromeOrFirefox:true,originalGamePage:true,serverIssuedQuicActor:1,
  physicalKeyEHoldRelease:true,physicalLMBPointerDown:true,
  trustedWorldHeavyPress:pressed,trustedWorldHeavyRelease:heavy,
  trustedWorldLightPress:lightPress,trustedWorldLightActive:lightActive,
  originalWorldCombatHitEvidence:honestWorldHits,
  actualIndependentHumanOperators:false,publicListener:false,
 }));
 const report={sourceCommit:process.env.MYASO_LIVE_GESTURE_SOURCE_SHA||"set-from-commit",actualRustWebTransport:true,
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
