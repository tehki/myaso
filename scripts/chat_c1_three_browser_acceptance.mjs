// Chat C1B full browser→real Rust→browser loopback acceptance.
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
const browserMatrix=(process.env.C1_BROWSER_MATRIX||"chrome,chrome,chrome").split(",").map(x=>x.trim().toLowerCase());
if (![3,4].includes(browserMatrix.length) || browserMatrix.some(x=>!["chrome","firefox"].includes(x))) {
 throw Error("C1_BROWSER_MATRIX must contain three or four chrome/firefox entries");
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
 const server=launch(binary,[],{env:{MYASO_BIND:"127.0.0.1:0",MYASO_CHAT_RADIUS:"160",MYASO_CHAT_C1_ENABLED:"1",MYASO_FLIGHT_ACTION_PROOF:"1"},stdio:["ignore","pipe","pipe"]});
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
 const url="http://127.0.0.1:"+httpPort+"/web/?server="+encodeURIComponent(ready.url)+"&cert="+encodeURIComponent(ready.cert.replaceAll(":",""))+"&chatC1Preview=1&netstats=1";
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
 const far=await evaljs(c,"return [...document.querySelectorAll('.local-chat-item .local-chat-text')].map(e=>e.textContent)");
 console.log("C_FAR",JSON.stringify(far));assert(!far.includes(first),"C outside authoritative radius");

 // Independent 4D's real first-red was native canvas LMB while chat owns
 // focus. Genuine W3C physical LMB/RMB/wheel on the authenticated Rust World.
 // This asserts native focus ownership; 4D must separately recheck actual
 // World attack/HIT logs before authorizing release.
 // Original Rust World runs unchanged. Loopback-only proof records its
 // authoritative action transitions. Snapshot stdout before any chat-owned
 // physical gesture; no synthetic client-side action table can substitute.
 await poll("original World own player Idle baseline before composer mouse",()=>{
   const lines=stdout.match(/M201_(?:FLIGHT_ACTOR_BASELINE|AUTH_ACTION) tick=\\d+ fighter=1 (?:action|from)=\\d+(?: to=\\d+)?/g)||[];
   const last=lines.at(-1)||"";
   const idle=/action=0$|to=0$/.test(last);
   return {ok:idle,last};
 },9000);
 await delay(110); // Drain any earlier authentic event before the proof fence.
 const genuineWorldBaseline = stdout.length;
 const beforeMouse = await evaljs(a,
  "const x=document.querySelector('[data-local-chat]');return {focused:document.activeElement===x.querySelector('input'),open:x.dataset.open};");
 assert.deepEqual(beforeMouse,{focused:true,open:"true"},"native Chat C1 composer precondition");
 const aim = await evaljs(a,
  "const x=document.querySelector('#arena').getBoundingClientRect();return {x:Math.round(x.left+x.width*.65),y:Math.round(x.top+x.height*.48)};");
 await wd("POST","/session/"+a+"/actions",{actions:[{
  type:"pointer",id:"c1-native-mouse",parameters:{pointerType:"mouse"},
  actions:[{type:"pointerMove",origin:"viewport",x:aim.x,y:aim.y,duration:35},
   {type:"pointerDown",button:0},{type:"pause",duration:75},{type:"pointerUp",button:0},
   {type:"pointerDown",button:2},{type:"pointerUp",button:2}],
 }]});
 await wd("POST","/session/"+a+"/actions",{actions:[{
  type:"wheel",id:"c1-native-wheel",
  actions:[{type:"scroll",x:aim.x,y:aim.y,deltaX:0,deltaY:120,duration:30}],
 }]});
 const afterMouse = await evaljs(a,
  "const x=document.querySelector('[data-local-chat]');return {focused:document.activeElement===x.querySelector('input'),open:x.dataset.open};");
 assert.deepEqual(afterMouse,{focused:true,open:"true"},"P0 native LMB/RMB/wheel cannot steal chat focus");
 await delay(400); // Multiple genuine 60Hz World ticks beyond input packet ACK.
 const nativeWorldAfter=stdout.slice(genuineWorldBaseline);
 const leakedWorldActions=[...nativeWorldAfter.matchAll(
   /M201_AUTH_ACTION tick=(\\d+) fighter=1 from=(\\d+) to=(\\d+)/g
 )].map(m=>({tick:Number(m[1]),from:Number(m[2]),to:Number(m[3])}));
 const leakedWorldHits=[...nativeWorldAfter.matchAll(
   /M201_AUTH_HIT tick=(\\d+) attacker=1 target=(\\d+)/g
 )].map(m=>({tick:Number(m[1]),target:Number(m[2])}));
 assert.deepEqual(leakedWorldActions,[],
   "P0 authentic World actor1 action transition during chat composer input");
 assert.deepEqual(leakedWorldHits,[],
   "P0 authentic World actor1 HIT during chat composer input");
 console.log("C1_REAL_WORLD_NATIVE_CHAT_NO_COMBAT_PASS",
   JSON.stringify({actorId:1,authWorldTransitionCount:0,authWorldHitCount:0,
     physicalGestures:["LMB","RMB","wheel"],writer:"original World M201 60Hz"}));
 console.log("C1_REAL_WORLD_NATIVE_CHAT_POINTER_FOCUS_PASS",
  JSON.stringify({lmb:true,rmb:true,wheel:true,focused:true}));

 if(d) {
  const farD=await evaljs(d,
    "return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",[first]);
  assert.equal(farD,false,"fourth player outside A's authoritative proximity cannot see A");
  console.log("FOURTH_PLAYER_A_DISTANCE_EXCLUSION",JSON.stringify({aToD:false}));
 }

 const reply="Yes — beside the fountain.";
 await send(b,reply);
 const bAck=await poll("B real server ACK",()=>evaljs(b,"return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0]),status:document.querySelector('.local-chat-status').textContent};",[reply]));
 console.log("B_ACK",JSON.stringify(bAck));
 const gotA=await poll("A receives B",()=>evaljs(a,"const x=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].map(e=>({name:e.querySelector('.local-chat-sender')?.textContent,text:e.querySelector('.local-chat-text')?.textContent}));return {ok:x.some(m=>m.text===arguments[0]&&m.name==='Player #2'),messages:x};",[reply]));
 console.log("A_RECEIVED",JSON.stringify(gotA));
 // A–B–C–D four independent browser flight: actual Rust spawn spacing
 // is 96 units, with local radius 160. C is 192 from A (excluded) while
 // B and D are each 96 from C (both valid server recipients).
 if(d) {
  const cross="C near B and D — A must not hear";
  await send(c,cross);
  const cAck=await poll("C server accepted four-player local message",()=>evaljs(c,
   "return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0])}",[cross]));
  const bGot=await poll("B received C as server-issued player #3",()=>evaljs(b,
   "const e=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].find(e=>e.querySelector('.local-chat-text')?.textContent===arguments[0]);return {ok:!!e,name:e?.querySelector('.local-chat-sender')?.textContent}",[cross]));
  const dGot=await poll("D received C as server-issued player #3",()=>evaljs(d,
   "const e=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].find(e=>e.querySelector('.local-chat-text')?.textContent===arguments[0]);return {ok:!!e,name:e?.querySelector('.local-chat-sender')?.textContent}",[cross]));
  assert.equal(bGot.name,"Player #3");
  assert.equal(dGot.name,"Player #3");
  assert.equal(cAck.ok,true);
  await delay(550);
  const aGot=await evaljs(a,
   "return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",[cross]);
  assert.equal(aGot,false,"A beyond 160 cannot receive C's authenticated chat");
  console.log("FOUR_PLAYER_AUTHENTIC_PROXIMITY_PASS",
   JSON.stringify({fourSessions:sessions.length,cToB:true,cToD:true,cToA:false,serverAck:true}));
 }


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
 const hostileFar=await evaljs(c,
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
 const maxFar = await evaljs(c,"return [...document.querySelectorAll('.local-chat-item .local-chat-text')].some(x=>x.textContent===arguments[0])",[maxBytes]);
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
 console.log("PASS real Rust server and "+sessions.length+" "+browserMatrix.join("/")+" WebTransport browser connections with pinned TLS: A↔B; C excluded from A; genuine ChatResult and continuing gameplay input ACKs");
}finally{
 for(const session of sessions){try{await wd("DELETE","/session/"+session)}catch{}}
 for(const p of processes){try{p.kill()}catch{}}
}
