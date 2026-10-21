// C1 Greyhaven real-four-browser PROXIMITY acceptance on combined Core 8A/8C/World9 source.
 // Native real Rust server + four distinct W3C browsers; NO simulated chat adapters.
 // Separate from legacy 96-unit arena acceptance, no actual weapons or two-host claim.
// Nonproduction, opt-in CLI only. Requires built server/target/debug/myaso-server,
// Node >=20, python3, Chrome/Chromium and chromedriver on PATH.
// Optional: C1_BROWSER_MATRIX=chrome,firefox,chrome with geckodriver and Firefox.
// Run from repository root: node scripts/chat_c1_three_browser_acceptance.mjs
// No mock adapter, public server, external port or production deployment.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
const root=process.cwd(), delay=ms=>new Promise(r=>setTimeout(r,ms));
const randomPort=()=>new Promise((resolve,reject)=>{const s=createServer();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const processes=[],sessions=[];
const browserMatrix=(process.env.C1_BROWSER_MATRIX||"chrome,firefox,chrome,chrome").split(",").map(x=>x.trim().toLowerCase());
if (browserMatrix.length!==4 || browserMatrix.some(x=>!["chrome","firefox"].includes(x))) {
 throw Error("Greyhaven C1 needs exactly four chrome/firefox sessions");
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
 const server=launch(binary,[],{env:{MYASO_BIND:"127.0.0.1:0",MYASO_CHAT_RADIUS:"100",MYASO_ALPHA_SPAWN:"greyhaven",MYASO_MAX_PLAYERS:"4",MYASO_ALPHA_STATIC_COLLISION:"reviewed-static-only"},stdio:["ignore","pipe","pipe"]});
 let stdout="",stderr="";
 server.stdout.on("data",d=>{stdout+=d.toString()});
 server.stderr.on("data",d=>{stderr+=d.toString()});
 const ready=await poll("server",()=>{const url=stdout.match(/listening on (https:\/\/[^\s]+)/)?.[1],cert=stdout.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];return {ok:!!url&&!!cert,url,cert,stderr:stderr.slice(-200)};},14000);
 assert.equal(ready.cert.replaceAll(":","").length,64,"Pinned TLS SHA256 bytes");
 assert.match(stdout,/staging-only Greyhaven spawn selected/,"real server must enable authored Greyhaven spawn");
 assert.match(stdout,/staging-only Greyhaven fixed static sweep enabled/,"real server must enable reviewed static collision");
 console.log("GREYHAVEN_STAGE_CONFIRMED",JSON.stringify({cap:4,radius:100,spawn:"greyhaven",geometry:"reviewed-static-only"}));
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
 const url="http://127.0.0.1:"+httpPort+"/web/?server="+encodeURIComponent(ready.url)+"&cert="+encodeURIComponent(ready.cert.replaceAll(":",""))+"&chatC1Preview=1&netstats=1&world=1&uiLivenessProbe=1";
 for(let i=0;i<browserMatrix.length;i++){
  const browser=browserMatrix[i];
  const capabilities=browser==="chrome"
   ? {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1100,780"]}}
   : {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],...(process.env.C1_FIREFOX_BINARY?{binary:process.env.C1_FIREFOX_BINARY}:{})}};
  const session=(await wd("POST","/session",{capabilities:{alwaysMatch:capabilities}},driverPorts[browser])).sessionId;
  sessionDriverPorts.set(session,driverPorts[browser]);
  sessions.push(session);
  await wd("POST","/session/"+session+"/url",{url});
  const connected=await poll("player "+(i+1),()=>evaljs(session,"const x=document.querySelector('[data-local-chat]');return {ok:x?.dataset.connected==='true',status:x?.querySelector('.local-chat-status')?.textContent,event:document.querySelector('#event-text')?.textContent,connected:x?.dataset.connected};"),15000);
  console.log("PLAYER_READY",i+1,JSON.stringify(connected));
 }
 const [a,b,c,d]=sessions;
 const nativeGreyhaven = async session=>evaljs(session,
  "const c=document.querySelector('#arena');const ctx=c?.getContext('2d');const roster=[...document.querySelectorAll('#scoreboard-list li')].map(x=>Number(x.querySelector('span')?.textContent?.match(/^#(\\d+)$/)?.[1]??0)).sort((a,b)=>a-b);let green=0;if(ctx)for(let y=65;y<c.height-65;y+=67)for(let x=65;x<c.width-65;x+=67){const p=ctx.getImageData(x,y,1,1).data;if(p[1]>p[0]+8&&p[1]>p[2]+8&&p[1]>=55&&p[1]<=195)green++;}const s=window.__MYASO_WORLD_LIVENESS__?.snapshot(Date.now());const status=document.querySelector('#event-text')?.textContent||'';return {ok:green>=8&&roster.join(',')==='1,2,3,4'&&s?.snapshots>0&&s?.frames>0&&s?.paints>0&&s?.statusTick>0,green,roster,liveness:s,uiTick:Number(status.match(/server tick (\\d+)/)?.[1]??0)};");
 const paintedBefore=[];
 for(let i=0;i<sessions.length;i++){
  const observed=await poll("genuine Greyhaven painted for player "+(i+1),
    ()=>nativeGreyhaven(sessions[i]),18000);
  paintedBefore.push(observed);
 }
 console.log("FOUR_PLAYER_RENDERED_GREYHAVEN_CHAT_READY",
  JSON.stringify(paintedBefore.map((v,i)=>({player:i+1,green:v.green,roster:v.roster,uiTick:v.uiTick,snapshotTick:v.liveness.snapshotTick,frames:v.liveness.frames,paints:v.liveness.paints}))));
 async function send(session,message){
  await evaljs(session,"document.querySelector('#arena').focus();");
  await key(session,"\uE007");
  const f=await evaljs(session,"const x=document.querySelector('[data-local-chat]');return {focused:document.activeElement===x.querySelector('input'),open:x.dataset.open};");
  assert(f.focused&&f.open==="true","native composer focus");
  await evaljs(session,"document.querySelector('.local-chat-input').value=arguments[0]",[message]);
  await key(session,"\uE007");
 }
 const first="Greyhaven: blacksmith by the market?";
 await send(a,first);
 const aAck=await poll("A real server ACK",()=>evaljs(a,"return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0]),status:document.querySelector('.local-chat-status').textContent};",[first]));
 console.log("A_ACK",JSON.stringify(aAck));
 const gotB=await poll("B near receive",()=>evaljs(b,"const x=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].map(e=>({name:e.querySelector('.local-chat-sender')?.textContent,text:e.querySelector('.local-chat-text')?.textContent}));return {ok:x.some(m=>m.text===arguments[0]),messages:x};",[first]));
 console.log("B_RECEIVED",JSON.stringify(gotB));
 assert.equal(gotB.messages.find(m=>m.text===first)?.name,"Player #1");
 await delay(700);
 // Server-authored Greyhaven 2x2 grid: A at (4110,4160), B (4206,4160),
 // C (4110,4256), D (4206,4256). With radius100 orthogonal peers
 // (96u) hear one another; diagonal (sqrt(96²+96²)>100) do not.
 const cGot=await poll("Greyhaven C receives A orthogonally",()=>evaljs(c,
  "const e=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].find(e=>e.querySelector('.local-chat-text')?.textContent===arguments[0]);return {ok:!!e,name:e?.querySelector('.local-chat-sender')?.textContent}",[first]));
 assert.equal(cGot.name,"Player #1");
 const far=await evaljs(d,"return [...document.querySelectorAll('.local-chat-item .local-chat-text')].map(e=>e.textContent)");
 console.log("GREYHAVEN_D_DIAGONAL_EXCLUSION",JSON.stringify(far));
 assert(!far.includes(first),"D diagonal from A must be out of radius100");

 const reply="Yes — beside the fountain.";
 await send(b,reply);
 const bAck=await poll("B real server ACK",()=>evaljs(b,"return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0]),status:document.querySelector('.local-chat-status').textContent};",[reply]));
 console.log("B_ACK",JSON.stringify(bAck));
 const gotA=await poll("A receives B",()=>evaljs(a,"const x=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].map(e=>({name:e.querySelector('.local-chat-sender')?.textContent,text:e.querySelector('.local-chat-text')?.textContent}));return {ok:x.some(m=>m.text===arguments[0]&&m.name==='Player #2'),messages:x};",[reply]));
 console.log("A_RECEIVED",JSON.stringify(gotA));
 // Four clients must observe true Core-radius100 orthogonal fanout.
 // C is adjacent to A and D (96) but diagonal to B (~136).
 const cross="Greyhaven C speaks to A and D, not diagonal B";
 await send(c,cross);
 const cAck=await poll("Greyhaven C real server ACK",()=>evaljs(c,
  "return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0])}",[cross]));
 const aGot=await poll("Greyhaven A receives adjacent C",()=>evaljs(a,
  "const e=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].find(e=>e.querySelector('.local-chat-text')?.textContent===arguments[0]);return {ok:!!e,name:e?.querySelector('.local-chat-sender')?.textContent}",[cross]));
 const dGot=await poll("Greyhaven D receives adjacent C",()=>evaljs(d,
  "const e=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].find(e=>e.querySelector('.local-chat-text')?.textContent===arguments[0]);return {ok:!!e,name:e?.querySelector('.local-chat-sender')?.textContent}",[cross]));
 assert.equal(aGot.name,"Player #3");
 assert.equal(dGot.name,"Player #3");
 assert.equal(cAck.ok,true);
 await delay(550);
 const bGot=await evaljs(b,
  "return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",[cross]);
 assert.equal(bGot,false,"B diagonal to C must never receive that message");
 console.log("GREYHAVEN_FOUR_BROWSER_CHAT_PASS",
  JSON.stringify({fourAuthenticated:sessions.length,fromA:["B","C"],aToD:false,fromC:["A","D"],cToB:false,serverAck:true,radius:100}));

 // The untrusted message body must survive actual Rust chat routing but
 // remain inert browser text. Never parse messages as DOM or grant sender
 // supplied markup control of browser content or authority.
 const hostileText = '<img src=x onerror=window.__chatC1Injected=true>';
 await send(a,hostileText);
 const htmlNear = await poll("untrusted markup received as inert text",()=>evaljs(b,
   "const rows=[...document.querySelectorAll('.local-chat-item[data-channel=local]')];const text=arguments[0];const matched=rows.find(r=>r.querySelector('.local-chat-text')?.textContent===text);return {ok:!!matched,sender:matched?.querySelector('.local-chat-sender')?.textContent??null,rawHtml:matched?.querySelector('.local-chat-text')?.innerHTML??null,images:document.querySelectorAll('[data-local-chat] img').length,scriptRan:window.__chatC1Injected===true};",
   [hostileText]));
 assert.equal(htmlNear.sender,"Player #1","Core-derived sender ID cannot be overridden by chat text");
 assert.equal(htmlNear.images,0,"browser must not parse untrusted chat as image markup");
 assert.equal(htmlNear.scriptRan,false,"browser must never execute message attributes");
 assert(!/<img/i.test(htmlNear.rawHtml),"received markup was rendered as literal HTML");
 const hostileFar=await evaljs(d,
   "return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",
   [hostileText]);
 assert.equal(hostileFar,false,"distant client may not receive hostile text either");
 console.log("UNTRUSTED_HTML_SERVER_TEXT_ONLY_PASS",
   JSON.stringify({near:true,sender:htmlNear.sender,images:0,executed:false,far:false}));

 // Genuine server validation, not a mock: 120 two-byte UTF-8 codepoints
 // must reach B under the 240-byte Core limit and never reach distant C.
 const maxBytes = "é".repeat(120);
 assert.equal(new TextEncoder().encode(maxBytes).length, 240);
 await send(a, maxBytes);
 const maxAck = await poll("240-byte real Core ChatResult",()=>
  evaljs(a,"return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0])}",[maxBytes]));
 const maxNear = await poll("240-byte delivered only to nearby B",()=>
  evaljs(b,"return {ok:[...document.querySelectorAll('.local-chat-item[data-channel=local] .local-chat-text')].some(x=>x.textContent===arguments[0])}",[maxBytes]));
 const maxFar = await evaljs(d,"return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",[maxBytes]);
 assert.equal(maxAck.ok,true);
 assert.equal(maxNear.ok,true);
 assert.equal(maxFar,false,"240-byte message must not reach distant C");
 console.log("UTF8_240_NATIVE_SERVER_PASS",JSON.stringify({bytes:240,near:true,far:false}));

 // The UI rejects 121x 2-byte Unicode (242 bytes) before any ChatSend.
 // Set DOM value deliberately (native maxLength would clamp typed input)
 // then submit with the real keyboard; confirm no phantom pending/sent row.
 await evaljs(a,"document.querySelector('#arena').focus();");
 await key(a,"\uE007");
 const maxOver = "é".repeat(121);
 assert.equal(new TextEncoder().encode(maxOver).length,242);
 await evaljs(a,"document.querySelector('.local-chat-input').value=arguments[0]",[maxOver]);
 await key(a,"\uE007");
 const rejected = await evaljs(a,
   "const x=document.querySelector('[data-local-chat]');const text=arguments[0];return {focused:document.activeElement===x.querySelector('input'),feedback:x.querySelector('.local-chat-status').textContent,outgoing:[...x.querySelectorAll('li.local-chat-item .local-chat-text')].filter(e=>e.textContent===text).length,inputValue:x.querySelector('input').value};",
   [maxOver]);
 assert.equal(rejected.focused,true,"failed compose stays editable");
 assert.match(rejected.feedback,/too long/i,"oversized payload rejected locally");
 assert.equal(rejected.outgoing,0,"rejected chat must not create optimistic row");
 assert.equal(rejected.inputValue,maxOver,"rejected chat remains editable");
 const remoteInvalid = await evaljs(b,"return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",[maxOver]);
 assert.equal(remoteInvalid,false,"242-byte invalid message never reached B");
 console.log("UTF8_242_REJECT_PASS",JSON.stringify({bytes:242,error:rejected.feedback}));

 // A native Escape from a rejected/unsent message returns focus to the
 // arena and clears input without submitting or leaking gameplay state.
 await key(a,"\uE00C");
 const escaped=await evaljs(a,
   "const x=document.querySelector('[data-local-chat]');return {arenaFocused:document.activeElement?.id==='arena',collapsed:x.dataset.open==='false',draft:x.querySelector('input').value};");
 assert.deepEqual(escaped,{arenaFocused:true,collapsed:true,draft:""});
 console.log("ESCAPE_COMBAT_FOCUS_RESTORED",JSON.stringify(escaped));

 // Native W3C input ownership: typing actual movement and combat hotkeys
 // inside the chat composer must never bubble into arena controls.
 await evaljs(a,
  "window.__c1NativeKeyboard=[];document.addEventListener('keydown',e=>window.__c1NativeKeyboard.push({key:e.key,target:e.target?.className||e.target?.id}),true);");
 await key(a,"\uE007"); // genuine Enter opens the opt-in local composer
 for (const literal of ["w","e"," "]) await key(a,literal);
 const typing=await evaljs(a,
  "const x=document.querySelector('[data-local-chat]');return {focused:document.activeElement===x.querySelector('input'),draft:x.querySelector('input').value,keys:window.__c1NativeKeyboard.filter(e=>['w','e',' '].includes(e.key))};");
 assert.equal(typing.focused,true,"real W/E/Space typing must remain in chat composer");
 assert.equal(typing.draft,"we ","real keyboard text must reach the composer unmodified");
 assert.deepEqual(typing.keys.map(e=>e.target),
   ["local-chat-input","local-chat-input","local-chat-input"],
   "combat W/E/Space must target only the input, never the arena");
 await key(a,"\uE00C"); // native Escape restores arena focus
 await key(a,"w"); // native W now targets the real game canvas
 const restored=await evaljs(a,
  "const x=document.querySelector('[data-local-chat]');return {arena:document.activeElement?.id==='arena',closed:x.dataset.open==='false',cleared:x.querySelector('input').value==='',lastW:window.__c1NativeKeyboard.filter(e=>e.key==='w').at(-1)?.target,noMessage:[...document.querySelectorAll('li.local-chat-item .local-chat-text')].every(n=>n.textContent!=='we ')};");
 assert.deepEqual(restored,{arena:true,closed:true,cleared:true,lastW:"arena",noMessage:true},
  "Escape must disarm composer and return real native W to gameplay without sending a chat message");
 console.log("NATIVE_CHAT_COMBAT_KEY_OWNERSHIP_PASS",
   JSON.stringify({typed:typing.draft,typedTargets:typing.keys.map(e=>e.target),...restored}));
 // Keep gameplay datagram ACK telemetry moving while the optional reliable
 // chat streams are connected. This is not full combat-under-chat acceptance.
 const ackSamples=async session=>evaljs(session,
   "const t=document.querySelector('#network-diagnostics')?.textContent||'';const n=t.match(/Samples (\\d+)/);const e=document.querySelector('#event-text')?.textContent||'';const tick=e.match(/server tick ([0-9]+)/);return {ok:!!n&&!!tick,samples:n?Number(n[1]):0,serverTick:tick?Number(tick[1]):null,diagnostics:t,eventText:e};");
 const before=await poll("gameplay ACK diagnostics before movement",()=>ackSamples(a));
 await evaljs(a,"document.querySelector('#arena').focus();");
 await wd("POST","/session/"+a+"/actions",{actions:[{type:"key",id:"movement",actions:[{type:"keyDown",value:"w"}]}]});
 await delay(300);
 await wd("POST","/session/"+a+"/actions",{actions:[{type:"key",id:"movement",actions:[{type:"keyUp",value:"w"}]}]});
 const after=await poll("gameplay ACKs continue after local chat",async()=>{
  const data=await ackSamples(a);
  // ACK RTT samples are a capped, 96-element rolling history. On full
  // history require fresh authoritative server ticks after the native W
  // movement instead of expecting an impossible 97th RTT sample.
  const freshSamples = data.samples > before.samples + 1;
  const cappedWindowProgress = before.samples >= 94 && data.samples === 96
    && Number.isInteger(data.serverTick)
    && data.serverTick > before.serverTick + 3;
  return {...data,ok:data.ok&&(freshSamples||cappedWindowProgress)};
 },5500);
 console.log("GAMEPLAY_ACK_WITH_CHAT",JSON.stringify({samplesBefore:before.samples,samplesAfter:after.samples,
   serverTickBefore:before.serverTick,serverTickAfter:after.serverTick,
   p95:after.diagnostics.match(/Input→ACK p50[^|]*p95 ([^| ]+)/)?.[1]??"unknown"}));
 const paintedAfter=[];
 for(let i=0;i<sessions.length;i++){
  const prior=paintedBefore[i];
  paintedAfter.push(await poll("four-player rendered city and UI tick still live after chat "+(i+1),
   async()=>{
    const now=await nativeGreyhaven(sessions[i]);
    return {...now,ok:now.ok&&now.uiTick>prior.uiTick&&now.liveness.snapshotTick>prior.liveness.snapshotTick&&now.liveness.frames>prior.liveness.frames&&now.liveness.paints>prior.liveness.paints};
   },12000));
 }
 console.log("FOUR_PLAYER_RENDERED_GREYHAVEN_CHAT_LIVE_PASS",
  JSON.stringify(paintedAfter.map((v,i)=>({player:i+1,green:v.green,fromTick:paintedBefore[i].uiTick,toTick:v.uiTick,snapshotTick:v.liveness.snapshotTick,frames:v.liveness.frames,paints:v.liveness.paints}))));
 console.log("PASS GREYHAVEN four real "+browserMatrix.join("/")+" WebTransport browser sessions with pinned TLS: Core8C authored spawn, reviewed static solids, radius100 orthogonal-only chat fanout and continuing gameplay ticks");
}finally{
 for(const session of sessions){try{await wd("DELETE","/session/"+session)}catch{}}
 for(const p of processes){try{p.kill()}catch{}}
}
