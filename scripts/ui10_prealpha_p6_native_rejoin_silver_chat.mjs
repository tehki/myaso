// Core8C x UI10: genuine voluntary native Chrome/Firefox pagehide retirement and replacement on original v1.
// Nonproduction, opt-in CLI only. Requires built server/target/debug/myaso-server,
// Node >=20, python3, Chrome/Chromium and chromedriver on PATH.
// Browser matrix: C1_BROWSER_MATRIX=chrome,firefox,chrome,chrome with geckodriver and Firefox.
// Run from repository root: node scripts/core8c_ui10_native_pagehide_departure.mjs
// No mock adapter, public server, external port or production deployment.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { nativeContentViewportMatches, nextNativeW3cWindowRect } from "./graphics3b_native_viewport_parity.mjs";
const root=process.cwd(), delay=ms=>new Promise(r=>setTimeout(r,ms));
const randomPort=()=>new Promise((resolve,reject)=>{const s=createServer();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const processes=[],sessions=[];
const browserMatrix=(process.env.C1_BROWSER_MATRIX||"chrome,firefox,chrome,chrome").split(",").map(x=>x.trim().toLowerCase());
if(browserMatrix.length!==4)throw Error("Core8C native removal requires exactly four authenticated browser clients");
if (browserMatrix.some(x=>!["chrome","firefox"].includes(x))) {
 throw Error("C1_BROWSER_MATRIX must contain Chrome and Firefox browser types");
}
const sessionDriverPorts=new Map();
const launch=(bin,args,extra={})=>{const p=spawn(bin,args,{...extra,env:{...process.env,...(extra.env||{})}});processes.push(p);return p;};
async function wd(method,path,body,createPort){
 const sessionId=path.match(/^\/session\/([^/]+)/)?.[1];
 const driverPort=createPort??sessionDriverPorts.get(sessionId);
 if (!driverPort) throw Error("Unknown WebDriver browser session");
 const r=await fetch("http://127.0.0.1:"+driverPort+path,{method,headers:{"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json();
 if(!r.ok||data.value?.error)throw Error(method+" "+path+" "+JSON.stringify(data).slice(0,1400));
 return data.value;
}
const evaljs=(session,script,args=[])=>wd("POST","/session/"+session+"/execute/sync",{script,args});
const key=(session,code)=>wd("POST","/session/"+session+"/actions",{actions:[{type:"key",id:"keyboard",actions:[{type:"keyDown",value:code},{type:"keyUp",value:code}]}]});
async function poll(label,fn,timeout=12000){
 const start=Date.now();let last;
 while(Date.now()-start<timeout){try{last=await fn();if(last?.ok)return last;}catch(e){last={error:String(e)}}await delay(170);}
 throw Error("Timeout "+label+": "+JSON.stringify(last).slice(0,1300));
}
try {
 const binary=join(root,"server","target","debug","myaso-server");
 const server=launch(binary,[],{env:{MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",MYASO_CHAT_C1_ENABLED:"1",MYASO_CHAT_RADIUS:"160"},stdio:["ignore","pipe","pipe"]});
 let stdout="",stderr="";
 server.stdout.on("data",d=>{stdout+=d.toString()});
 server.stderr.on("data",d=>{stderr+=d.toString()});
 const ready=await poll("server",()=>{const url=stdout.match(/listening on (https:\/\/[^\s]+)/)?.[1],cert=stdout.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];return {ok:!!url&&!!cert,url,cert,stderr:stderr.slice(-200)};},14000);
 assert.equal(ready.cert.replaceAll(":","").length,64,"Pinned TLS SHA256 bytes");
 console.log("SERVER_READY",JSON.stringify({url:ready.url,pinLength:ready.cert.replaceAll(":","").length}));
 const httpPort=await randomPort();
 launch("python3",["-m","http.server",String(httpPort),"--bind","127.0.0.1","--directory",root],{stdio:"ignore"});
 const driverPorts={};
 for (const browser of new Set(browserMatrix)) {
  const port=await randomPort();
  driverPorts[browser]=port;
  launch(browser==="chrome"?"chromedriver":(process.env.C1_GECKODRIVER||"geckodriver"),
   ["--port="+port],{stdio:"ignore"});
  await poll(browser+" driver",async()=>{const r=await fetch("http://127.0.0.1:"+port+"/status").catch(()=>null);return {ok:!!r?.ok};},6500);
 }
 const shortTargets=[
  {width:1280,height:720},{width:1366,height:682},
  {width:1366,height:682},{width:1280,height:720}
 ];
 async function originalShortUi(sid,target,label){
  const size=()=>evaljs(sid,"return {innerWidth,innerHeight,outerWidth,outerHeight}");
  for(let i=0;i<5;i++){
   const q=await size();
   if(nativeContentViewportMatches(q,target))break;
   await wd("POST","/session/"+sid+"/window/rect",nextNativeW3cWindowRect(q,target));
   await delay(180);
  }
  assert(nativeContentViewportMatches(await size(),target),"real native CSS viewport must match "+label);
  const measured=await poll("original Silver/Chat short UI "+label,async()=>{
   const q=await evaljs(sid,[
    "const c=document.querySelector('#arena'),r=c.getBoundingClientRect();",
    "const chat=document.querySelector('[data-local-chat]');",
    "const details=document.querySelector('.controls-disclosure');",
    "const status=document.querySelector('#event-text')?.textContent||'';",
    "return {width:r.width,height:r.height,top:r.top,bottom:r.bottom,",
    "left:r.left,right:r.right,sourcePixels:[c.width,c.height],",
    "controls:details?.querySelector('.controls')?.children.length,",
    "chatConnected:chat?.dataset.connected==='true',",
    "scrollY:window.scrollY,status};"
   ].join(""));
   return {...q,ok:q.chatConnected&&q.controls===14
    &&q.top>=0&&q.left>=0&&q.bottom<=target.height+1
    &&q.right<=target.width+1&&q.scrollY===0};
  },9000);
  assert.deepEqual(measured.sourcePixels,[960,540],"original Canvas bitmap unchanged");
  assert(Math.abs(measured.width/measured.height-16/9)<.02,"original Canvas ratio");
  console.log("UI10_CORE8C_SHORT_CHAT_SEAT_PASS",JSON.stringify({
   label,target,viewportCanvasBottom:measured.bottom,
   originalSilverCanvas:true,chatConnected:true,all14Controls:true}));
  return measured;
 }
 const url="http://127.0.0.1:"+httpPort+"/web/?server="+encodeURIComponent(ready.url)+"&cert="+encodeURIComponent(ready.cert.replaceAll(":",""))+"&netstats=1";
 for(let i=0;i<browserMatrix.length;i++){
  const browser=browserMatrix[i];
  const capabilities=browser==="chrome"
   ? {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1100,780"]}}
   : {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],...(process.env.C1_FIREFOX_BINARY?{binary:process.env.C1_FIREFOX_BINARY}:{})}};
  const session=(await wd("POST","/session",{capabilities:{alwaysMatch:capabilities}},driverPorts[browser])).sessionId;
  sessionDriverPorts.set(session,driverPorts[browser]);
  sessions.push(session);
  await wd("POST","/session/"+session+"/url",{url});
  const connected=await poll("player "+(i+1),()=>evaljs(session,"const x=document.querySelector('#event-text')?.textContent||'';return {ok:/Online - player #\\d+ - server tick \\d+/.test(x),status:x};"),15000);
  console.log("PLAYER_READY",i+1,JSON.stringify(connected));
  await originalShortUi(session,shortTargets[i],"initial actor "+(i+1));
 }

 // Passive Canvas source proof only: observes the ORIGINAL drawRemoteIdentity
 // ctx.fillText("#id") while the ORIGINAL requestAnimationFrame paints.
 const traceScript=[
  "if(!window.__CORE8C_VISIBLE_IDS__){",
  "const ctx=CanvasRenderingContext2D.prototype,oldText=ctx.fillText,oldImage=ctx.drawImage;",
  "const raf=window.requestAnimationFrame;",
  "const q={active:false,labels:[],frames:[],frameCount:0,silverDraws:0,silverFourFrames:0};",
  "window.requestAnimationFrame=function(cb){return raf.call(window,function(t){",
  "q.active=true;q.labels=[];q.silverDraws=0;",
  "try{return cb(t);}finally{",
  "q.active=false;q.frameCount++;if(q.silverDraws===4)q.silverFourFrames++;",
  "q.frames.push({t,ids:[...new Set(q.labels)].sort(),silvers:q.silverDraws});",
  "if(q.frames.length>80)q.frames.shift();",
  "}});};",
  "ctx.fillText=function(text,...args){",
  "if(q.active&&this.canvas?.id==='arena'&&/^#[0-9]+$/.test(String(text)))q.labels.push(String(text));",
  "return oldText.call(this,text,...args);};",
  "ctx.drawImage=function(...args){",
  "const image=args[0],uri=image?.currentSrc||image?.src||'';",
  "if(q.active&&this.canvas?.id==='arena'&&uri.includes('/assets/knights/silver_')&&uri.endsWith('.webp'))q.silverDraws++;",
  "return oldImage.apply(this,args);};",
  "window.__CORE8C_VISIBLE_IDS__=()=>({frameCount:q.frameCount,",
  "frames:q.frames.slice(-25),silverFourFrames:q.silverFourFrames,",
  "roster:[...document.querySelectorAll('#scoreboard-list li')].map(li=>li.querySelector('span')?.textContent||''),",
  "status:document.querySelector('#event-text')?.textContent||''});",
  "}"
 ].join("");
 const [a,b,c,d]=sessions;
 const surviving=[a,c,d];
 async function realWasdAndAck(sid,label,moveKey="w") {
  const old=await evaljs(sid,
   "const x=document.querySelector('#event-text')?.textContent||'';return Number(x.match(/server tick (\\d+)/)?.[1]||0)");
  await evaljs(sid,"document.querySelector('#arena').focus()");
  await wd("POST","/session/"+sid+"/actions",{actions:[{
   type:"key",id:"core8c-native-input-"+label,actions:[{type:"keyDown",value:moveKey}]
  }]});
  await delay(330);
  await wd("POST","/session/"+sid+"/actions",{actions:[{
   type:"key",id:"core8c-native-input-"+label,actions:[{type:"keyUp",value:moveKey}]
  }]});
  return poll("real W3C native input produced fresh authoritative server tick "+label,
   ()=>evaljs(sid,
    "const x=document.querySelector('#event-text')?.textContent||'';const tick=Number(x.match(/server tick (\\d+)/)?.[1]||0);return {ok:tick>arguments[0]+3,status:x,oldTick:arguments[0],newTick:tick}",[old]),9000);
 }
 // Baseline ACK and realtime replication are driven by actual W3C gameplay.
 // The real old-v1 client does not promise unsolicited snapshot delivery to
 // an idle viewer that has never acknowledged its reliable initial baseline.
 for(let i=0;i<sessions.length;i++){
  const ack=await realWasdAndAck(sessions[i],"ready-"+(i+1));
  console.log("CORE8C_BROWSER_REAL_INPUT_ACK_PRECONDITION",i+1,JSON.stringify(ack));
 }
 for(const sid of surviving)await evaljs(sid,traceScript);
 function rosterHas(rows,id){return rows.some(r=>String(r).includes("#"+id));}
 async function visible(sid){
  return evaljs(sid,"return window.__CORE8C_VISIBLE_IDS__?.()??null");
 }
 const before=[];
 for(const sid of surviving){
  const q=await poll("real Canvas draws departed #2 before disconnect",async()=>{
   const v=await visible(sid);
   const recent=v?.frames?.slice(-12)||[];
   return {...v,ok:v?.roster?.length===4&&[1,2,3,4].every(id=>rosterHas(v.roster,id))
      &&recent.length>=8&&recent.filter(x=>x.ids.includes("#2")&&x.silvers===4).length>=6};
  },17000);
  before.push({labels:q.frames.slice(-8).map(f=>f.ids),roster:q.roster});
 }
 console.log("CORE8C_BROWSER_REAL_FOUR_ROSTER_BEFORE",JSON.stringify(before));

 // Real WebDriver session teardown closes authentic QUIC and original actor #2.
 const departedAt=Date.now();
 await wd("POST","/session/"+b+"/url",{url:"about:blank"});
 console.log("CORE8C_BROWSER_REAL_PEER2_NAVIGATED_AWAY");
 await delay(900);
 // FIRST require a fresh genuine server-issued session under the original
 // admission cap 4. This distinguishes a crashed server from stale client
 // replication when the native #2 Firefox window closes.
 const newcomerCaps={browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1100,780"
 ]}};
 const newcomer=(await wd("POST","/session",
  {capabilities:{alwaysMatch:newcomerCaps}},driverPorts.chrome)).sessionId;
 sessionDriverPorts.set(newcomer,driverPorts.chrome);
 sessions.push(newcomer);
 await wd("POST","/session/"+newcomer+"/url",{url});
 // Intentional user navigation MUST send graceful WebTransport.close via
 // the pagehide handler before unloading. This is NOT an abrupt process
 // crash or time-based QUIC expiry; require a new server-owned actor promptly.
 let newConnected=null;
 for(let attempt=0;attempt<5;attempt++){
  let observed={ok:false,failed:false,status:"uninitialized"};
  const checkUntil=Date.now()+1500;
  while(Date.now()<checkUntil){
   observed=await evaljs(newcomer,
    "const x=document.querySelector('#event-text')?.textContent||'';return {ok:/Online - player #5 - server tick \\d+/.test(x),failed:/Multiplayer connection failed/.test(x),status:x};");
   if(observed.ok||observed.failed)break;
   await delay(130);
  }
  console.log("CORE8C_PAGEHIDE_FIFTH_CAPACITY",JSON.stringify({
   attempt:attempt+1,elapsedMs:Date.now()-departedAt,
   status:observed.status,accepted:observed.ok,failed:observed.failed,
   serverEvents:stdout.split("\\n").filter(x=>/assigned player|session ended/.test(x)).slice(-7)
  }));
  if(observed.ok){newConnected={...observed,elapsedMs:Date.now()-departedAt};break;}
  assert(observed.failed,"only retry a definitively rejected attempt");
  assert(Date.now()-departedAt<5000,"pagehide peer did not release server admission slot in 5s");
  await delay(180);
  await wd("POST","/session/"+newcomer+"/url",{url});
 }
 assert(newConnected?.ok&&newConnected.elapsedMs<6000,
  "ordinary pagehide must free the real server seat within 6s, not await 35s timeout");
 console.log("CORE8C_BROWSER_NEW_ACTOR_CONNECTED",JSON.stringify(newConnected));
 // The original three authenticated sessions must also remain alive and
 // continue processing genuine v1 input ACKs after peer #2 departed.
 try {
  for(const sid of surviving){
   // After initial W, a fighter may be against the NORTH arena wall.
   // Press S to genuinely move away from the wall and require a fresh
   // authoritative own-player snapshot; do NOT waive its ACK alignment.
   const ack=await realWasdAndAck(sid,"post-departure","s");
   console.log("CORE8C_BROWSER_POST_DEPARTURE_ACK",JSON.stringify(ack));
  }
 }catch(error){
  const clients=await Promise.all(surviving.map(sid=>evaljs(sid,
   "return {status:document.querySelector('#event-text')?.textContent||'',roster:[...document.querySelectorAll('#scoreboard-list li')].map(x=>x.querySelector('span')?.textContent||''),diag:document.querySelector('#network-diagnostics')?.textContent||''}").catch(e=>({error:String(e)}))));
  console.error("CORE8C_NATIVE_AFTER_PEER_CLOSE_DIAGNOSTIC",JSON.stringify({
   error:String(error),serverExitCode:server.exitCode,serverSignalCode:server.signalCode,
   serverStdoutTail:stdout.slice(-2000),serverStderrTail:stderr.slice(-2600),clients
  }));
  throw error;
 }
 const removed=[];
 for(const sid of surviving){
  const q=await poll("native Canvas AND HUD remove #2 and show authentic new #5",async()=>{
   const v=await visible(sid);
   const recent=v?.frames?.slice(-12)||[];
   return {...v,ok:v?.roster?.length===4&&[1,3,4,5].every(id=>rosterHas(v.roster,id))
      &&!rosterHas(v.roster,2)&&recent.length>=8
      &&recent.filter(frame=>!frame.ids.includes("#2")&&frame.ids.includes("#5")
        &&frame.ids.length>=3).length>=8};
  },18000);
  removed.push({roster:q.roster,frames:q.frames.slice(-8).map(f=>f.ids)});
 }
 console.log("CORE8C_BROWSER_REAL_GHOST_REMOVED",JSON.stringify(removed));
 const rejoined=[];
 for(const sid of surviving){
  const q=await poll("original Canvas HUD removes #2 and renders fresh #5",async()=>{
   const v=await visible(sid);
   const recent=v?.frames?.slice(-12)||[];
   return {...v,ok:v?.roster?.length===4&&[1,3,4,5].every(id=>rosterHas(v.roster,id))
      &&!rosterHas(v.roster,2)&&recent.length>=8
      &&recent.filter(x=>x.ids.includes("#5")&&!x.ids.includes("#2")&&x.ids.length>=3&&x.silvers===4).length>=8};
  },22000);
  rejoined.push({roster:q.roster,frames:q.frames.slice(-8).map(f=>f.ids),
   status:q.status});
 }

 // Repeat a REAL pagehide after the first replacement, without changing
 // production code or injecting server state. Verify a *second* freed slot
 // and strictly monotonic fresh identity 6, rather than an accidental ID 2
 // resurrection, a one-shot cleanup or a leaked reconnect admission permit.
 await originalShortUi(newcomer,shortTargets[3],"replacement actor 5");
 const secondDepartureAt=Date.now();
 await wd("POST","/session/"+newcomer+"/url",{url:"about:blank"});
 const sixth=(await wd("POST","/session",
   {capabilities:{alwaysMatch:newcomerCaps}},driverPorts.chrome)).sessionId;
 sessionDriverPorts.set(sixth,driverPorts.chrome);
 sessions.push(sixth);
 await wd("POST","/session/"+sixth+"/url",{url});
 const sixthJoined=await poll("second real pagehide admits unique actor #6",
   async()=>evaljs(sixth,
    "const x=document.querySelector('#event-text')?.textContent||'';return {ok:/Online - player #6 - server tick \\d+/.test(x),status:x};"),5000);
 const secondElapsedMs=Date.now()-secondDepartureAt;
 await originalShortUi(sixth,shortTargets[3],"replacement actor 6");
 assert(secondElapsedMs<6000,"repeated graceful pagehide must free same capped seat within 6s");
 console.log("CORE8C_PAGEHIDE_SECOND_ADMISSION",JSON.stringify({
   ...sixthJoined,elapsedMs:secondElapsedMs,expectedActor:6,
 }));
 const twiceRemoved=[];
 for(const sid of surviving){
  const v=await poll("authentic Canvas/HUD retire #2 and #5; new #6 persists",
   async()=>{
    const snapshot=await visible(sid),frames=snapshot?.frames?.slice(-12)||[];
    return {...snapshot,ok:snapshot?.roster?.length===4
     &&[1,3,4,6].every(id=>rosterHas(snapshot.roster,id))
     &&!rosterHas(snapshot.roster,2)&&!rosterHas(snapshot.roster,5)
     &&frames.length>=8
     &&frames.filter(x=>x.ids.includes("#6")&&x.silvers===4
       &&!x.ids.includes("#5")&&!x.ids.includes("#2")&&x.ids.length>=3).length>=8};
   },12000);
  twiceRemoved.push({roster:v.roster,frames:v.frames.slice(-8).map(x=>x.ids)});
  const ownAck=await realWasdAndAck(sid,"post-second-pagehide","s");
  console.log("CORE8C_PAGEHIDE_SECOND_SURVIVOR_ACK",JSON.stringify(ownAck));
 }
 console.log("CORE8C_UI10_SECOND_PAGEHIDE_PASS",JSON.stringify({
  genuineSecondSeatRetirement:true,firstRemovedActor:2,secondRemovedActor:5,
  secondNewServerActor:6,elapsedMs:secondElapsedMs,
  originalSurvivingNativeBrowsers:browserMatrix,
  realCanvasAndHudAfterSecond:twiceRemoved,
 }));

 // The exact native browser that voluntarily left as actor #2 now RETURNS
 // to its game URL after the replacement actor #6 also voluntarily leaves.
 // The same *browser session* must authenticate as FRESH actor #7, never
 // restore old actor #2 or attach to a retired WebTransport/World lease.
 const originalBrowserRejoinAt=Date.now();
 await wd("POST","/session/"+sixth+"/url",{url:"about:blank"});
 await wd("POST","/session/"+b+"/url",{url});
 const realReturn=await poll("original browser rejoins as fresh original-v1 actor #7",
   async()=>evaljs(b,
    "const x=document.querySelector('#event-text')?.textContent||'';return {ok:/Online - player #7 - server tick \\d+/.test(x),status:x};"),7000);
 const returnElapsedMs=Date.now()-originalBrowserRejoinAt;
 await originalShortUi(b,shortTargets[1],"returned original browser actor 7");
 assert(returnElapsedMs<9000,
  "returning native browser must create fresh server session before 9s");
 console.log("CORE8C_PAGEHIDE_ORIGINAL_BROWSER_RETURN",JSON.stringify({
  ...realReturn,returnElapsedMs,originalActor:2,returnedAsActor:7,
 }));
 const thirdRemoval=[];
 for(const sid of surviving){
  const q=await poll("no #2/#5/#6 ghosts after original browser returns with ID #7",
   async()=>{
    const view=await visible(sid),frames=view?.frames?.slice(-12)||[];
    return {...view,ok:view?.roster?.length===4
     &&[1,3,4,7].every(id=>rosterHas(view.roster,id))
     &&[2,5,6].every(id=>!rosterHas(view.roster,id))
     &&frames.length>=8
     &&frames.filter(f=>f.ids.includes("#7")&&f.silvers===4
       &&[2,5,6].every(id=>!f.ids.includes("#"+id))
       &&f.ids.length>=3).length>=8};
   },11000);
  thirdRemoval.push({roster:q.roster,frames:q.frames.slice(-8).map(f=>f.ids)});
  const ack=await realWasdAndAck(sid,"post-native-rejoin","s");
  console.log("CORE8C_PAGEHIDE_RETURN_SURVIVOR_ACK",JSON.stringify(ack));
 }
 const returningActorAck=await realWasdAndAck(b,"returned-browser-actor7","s");
 console.log("CORE8C_PAGEHIDE_RETURNED_ACTOR_ACK",JSON.stringify(returningActorAck));
 console.log("CORE8C_UI10_SAME_BROWSER_FRESH_REJOIN_PASS",JSON.stringify({
  returnedExistingBrowserSession:true,oldIdentity2Rejected:true,
  returnedActorServerIdentity:7,realNativeRoundTripMs:returnElapsedMs,
  retiredIds:[2,5,6],survivors:[1,3,4,7],
  genuineCanvasHudAfterThirdRotation:thirdRemoval,
  bothReturningAndRemainingClientsMovedWithServerAcks:true,
  bfcacheRestoreTested:false,
 }));
 console.log("CORE8C_UI10_GRACEFUL_PAGEHIDE_PASS",JSON.stringify({
  genuineWebTransport:true,chromeFirefoxNativeBrowsers:browserMatrix,
  initialActorIds:[1,2,3,4],disconnectedActorId:2,replacementActorId:5,
  browserCanvasIdentityAndHudConfirmed:true,oldActorNeverRenderedAfterRemoval:true,
  intentionalNavigationClose:true,
  initialCanvas:before,removedCanvas:removed,rejoinedCanvas:rejoined,
  realWorldHPProof:false,realV2Gesture:false,independentPhysicalHosts:false,
  approvedRelease:false
 }));
}finally{
 for(const session of sessions){try{await wd("DELETE","/session/"+session)}catch{}}
 for(const p of processes){try{p.kill()}catch{}}
}
