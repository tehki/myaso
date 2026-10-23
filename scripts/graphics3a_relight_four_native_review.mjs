// GRAPHICS 3A isolated review: genuine authenticated Rust multiplayer,
// explicit original Blender relight URL; no Combat/Core/Physics authority changes.
// UI 10 x Physics 6: real four-browser crowd acceptance on Main's exact P6 collision integration. No synthetic fighters.
// Nonproduction, opt-in CLI only. Requires built server/target/debug/myaso-server,
// Node >=20, python3, Chrome/Chromium and chromedriver on PATH.
// Optional: C1_BROWSER_MATRIX=chrome,firefox,chrome with geckodriver and Firefox.
// Run from repository root: node scripts/chat_c1_three_browser_acceptance.mjs
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
if(browserMatrix.length!==4)throw Error("Joined C1/Silver requires exactly four authenticated native browser clients");
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
 const server=launch(binary,[],{env:{MYASO_BIND:"127.0.0.1:0",MYASO_CHAT_RADIUS:"160",MYASO_CHAT_C1_ENABLED:"1"},stdio:["ignore","pipe","pipe"]});
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
 const url="http://127.0.0.1:"+httpPort+"/web/?server="+encodeURIComponent(ready.url)+"&cert="+encodeURIComponent(ready.cert.replaceAll(":",""))+"&chatC1Preview=1&netstats=1&knights=1&knightArt=relit";
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
 // Passive measurement only: unchanged Canvas/RAF and original 5 Silver WebPs.
 // Installed before Chat C1 actions, then measured AFTER real ACK/focus/input.
 const silverSourceProof = [
  "if(!window.__UI10_CHAT_SILVER__){",
  "const p=CanvasRenderingContext2D.prototype,original=p.drawImage;",
  "const raf=window.requestAnimationFrame;",
  "const q={draws:0,maxFrameDraws:0,framesWithFour:0,activeFrame:false,badAtlases:0,assets:{}};",
  "window.requestAnimationFrame=function(callback){",
  "return raf.call(window,function(timestamp){",
  "const before=q.draws;q.activeFrame=true;",
  "try{return callback(timestamp);}finally{",
  "q.activeFrame=false;const n=q.draws-before;",
  "q.maxFrameDraws=Math.max(q.maxFrameDraws,n);",
  "if(n>=4)q.framesWithFour++;",
  "}",
  "});",
  "};",
  "p.drawImage=function(...args){",
  "const im=args[0],u=im?.currentSrc||im?.src||'';",
  "if(this.canvas?.id==='arena'&&q.activeFrame&&u.includes('/assets/knights/')&&u.includes('silver_')&&u.includes('.webp')){",
  "q.draws++;const k=u.split('/').pop();q.assets[k]=(q.assets[k]||0)+1;",
  "if(im.naturalHeight!==1280||im.naturalWidth%160!==0)q.badAtlases++;",
  "}",
  "return original.apply(this,args);",
  "};",
  "window.__UI10_CHAT_SILVER__=()=>({...q,",
  "flag:new URLSearchParams(location.search).get('knights'),",
  "art:new URLSearchParams(location.search).get('knightArt'),",
  "chatConnected:document.querySelector('[data-local-chat]')?.dataset.connected==='true',",
  "roster:[...document.querySelectorAll('#scoreboard-list li')].map(li=>li.querySelector('span')?.textContent||''),",
  "status:document.querySelector('#event-text')?.textContent||''",
  "});",
  "}"
 ].join("");
 for(const session of sessions) await evaljs(session,silverSourceProof);
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
 // Single EXACT set of four server-authenticated clients must prove that
 // original Silver renders continuously during completed proximity Chat C1,
 // native Enter/Escape and native WASD, without allocating any fake player.
 const silverResults=[];
 for(let i=0;i<sessions.length;i++){
  const proof=await poll("same-session Silver canvas + accepted chat + live server #"+(i+1),
   async()=>{
    const q=await evaljs(sessions[i],
     "return window.__UI10_CHAT_SILVER__?.()??null");
    return {...q,ok:q?.flag==="1"&&q.art==="relit"&&q.chatConnected===true&&
     q.roster?.length===4&&q.draws>=12&&q.maxFrameDraws>=4&&
     q.framesWithFour>=1&&q.badAtlases===0&&
     (q.assets?.["silver_idle_relit.webp"]||0)>0&&
     /Online - player #\d+ - server tick \d+/.test(q.status)};
   },22000);
  silverResults.push(proof);
  console.log("SILVER_CHAT_ONE_ARENA_CLIENT",JSON.stringify({
   browser:browserMatrix[i],player:i+1,draws:proof.draws,
   fourInFrame:proof.framesWithFour,maximumPerFrame:proof.maxFrameDraws,
   roster:proof.roster,chatConnected:proof.chatConnected,
   realSourceIdle:proof.assets["silver_idle_relit.webp"],badAtlases:proof.badAtlases,
   serverStatus:proof.status
  }));
 }
 assert.equal(silverResults.length,4);
 console.log("UI10_PREALPHA_C1_FOUR_SILVER_NATIVE_PASS",JSON.stringify({
  browserMatrix,realRustGameAndChat:true,oneExactSetOfFourSessions:true,
  allFourOriginalSilverInRealRAF:true,authenticatedProximityAndAck:true,
  chatFocusReturnedToCombat:true,authoritativeInputAndServerTicks:true,
  fourRealHumanOperators:false,instantLightFixed:false,
  publicChatEnabled:false,noRealSwordsOrItems:true,
  releaseApproved:false
 }));
 // Reuse the ORIGINAL live four server+Silver+Chat sessions AFTER genuine
 // C1 radius/exclusion proof but BEFORE the P6 converging WASD choreography.
 // This proves the same actual crowd experience on the compact UI layout.
 const viewportTargets=[
  {width:1280,height:720},{width:1366,height:682},
  {width:1366,height:682},{width:1280,height:720}
 ];
 const shortViewports=[];
 for(let i=0;i<sessions.length;i++){
  const session=sessions[i],target=viewportTargets[i];
  const size=()=>evaljs(session,"return {innerWidth,innerHeight,outerWidth,outerHeight}");
  for(let tries=0;tries<5;tries++){
   const before=await size();
   if(nativeContentViewportMatches(before,target))break;
   await wd("POST","/session/"+session+"/window/rect",
    nextNativeW3cWindowRect(before,target));
   await delay(175);
  }
  assert(nativeContentViewportMatches(await size(),target),
   "P6 crowd requires exact real measured browser CSS short-viewport");
  const measure=()=>evaljs(session,[
   "const c=document.querySelector('#arena'),r=c.getBoundingClientRect();",
   "const details=document.querySelector('.controls-disclosure');",
   "const chat=document.querySelector('[data-local-chat]');",
   "return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,",
   "width:r.width,height:r.height,scrollY,",
   "originalPixels:[c.width,c.height],",
   "closed:details?.open===false,controls:details?.querySelector('.controls')?.children.length,",
   "chatConnected:chat?.dataset.connected==='true',",
   "status:document.querySelector('#event-text')?.textContent||''};"
  ].join(""));
  const q=await measure();
  assert.deepEqual(q.originalPixels,[960,540],"source pixel-buffer unchanged");
  assert(q.left>=0&&q.top>=0&&q.right<=target.width+1
   &&q.bottom<=target.height+1,"full Combat arena on screen");
  assert(Math.abs(q.width/q.height-16/9)<.02,"16:9 native presentation");
  assert.equal(q.scrollY,0,"no game-page scroll");
  assert.equal(q.controls,14,"all original Combat controls retained");
  assert.equal(q.closed,true,"Controls help starts collapsed");
  assert.equal(q.chatConnected,true,"same native client still genuinely Chat C1 connected");
  const elem=await wd("POST","/session/"+session+"/element",
   {using:"css selector",value:".controls-disclosure summary"});
  const id=elem["element-6066-11e4-a52e-4f735466cecf"];
  assert(id,"native keyboard-accessible controls summary exists");
  await wd("POST","/session/"+session+"/element/"+id+"/click",{});
  assert.equal(await evaljs(session,
   "return document.querySelector('.controls-disclosure')?.open"),true);
  await wd("POST","/session/"+session+"/element/"+id+"/click",{});
  assert.equal((await measure()).closed,true,"controls reclose");
  await evaljs(session,"document.querySelector('#arena').focus()");
  await key(session,"\uE007");
  const chat=await evaljs(session,[
   "const x=document.querySelector('[data-local-chat]'),input=x?.querySelector('input');",
   "const r=input.getBoundingClientRect();",
   "return {open:x?.dataset.open==='true',focused:document.activeElement===input,",
   "visible:r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth+1",
   "&&r.top>=0&&r.bottom<=innerHeight+1,scrollY};"
  ].join(""));
  assert(chat.open&&chat.focused&&chat.visible&&chat.scrollY===0,
   "same real player can see and focus Chat in compact window");
  await key(session,"\uE00C");
  const restored=await evaljs(session,[
   "const x=document.querySelector('[data-local-chat]');",
   "return {closed:x?.dataset.open==='false',focus:document.activeElement?.id==='arena'};"
  ].join(""));
  assert(restored.closed&&restored.focus,"Chat Escape returns authentic arena focus");
  shortViewports.push({browser:browserMatrix[i],target,canvasBottom:q.bottom,
   nativeChatVisible:true,controls:14,server:q.status});
 }
 console.log("UI10_P6_LIVE_SHORT_VIEWPORT_PASS",JSON.stringify(shortViewports));
 // P6-C02 actual-player crowd: observe real source-aligned 2D Silver sprite
 // origin positions from Canvas' own current transform, inside its original
 // animation-frame callback. Do not touch state, server, camera or actors.
 // Draw positions are presentation (interpolated/predicted), NOT raw World HP.
 const crowdObserve=[
  "if(!window.__UI10_P6_CROWD__){",
  "const canvas=document.querySelector('#arena'),ctx=CanvasRenderingContext2D.prototype;",
  "const original=ctx.drawImage,raf=window.requestAnimationFrame;",
  "const qa={totalFrames:0,fourFrames:0,crowdSamples:[],active:false,centers:[]};",
  "window.requestAnimationFrame=function(cb){",
  "return raf.call(window,function(t){",
  "qa.active=true;qa.centers=[];",
  "try{return cb(t);}finally{",
  "qa.active=false;qa.totalFrames++;",
  "if(qa.centers.length===4){",
  "qa.fourFrames++;const c=qa.centers;",
  "let min=Infinity,max=0;",
  "for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){",
  "const d=Math.hypot(c[i].x-c[j].x,c[i].y-c[j].y);",
  "min=Math.min(min,d);max=Math.max(max,d);",
  "}",
  "qa.crowdSamples.push({min,max,centers:c.map(x=>({...x}))});",
  "if(qa.crowdSamples.length>90)qa.crowdSamples.shift();",
  "}",
  "}",
  "});",
  "};",
  "ctx.drawImage=function(...args){",
  "const im=args[0],uri=im?.currentSrc||im?.src||'';",
  "if(this.canvas===canvas&&qa.active&&uri.includes('/assets/knights/')&&uri.includes('silver_')",
  "&&uri.includes('.webp')){",
  "const t=this.getTransform();qa.centers.push({x:t.e,y:t.f});",
  "}",
  "return original.apply(this,args);",
  "};",
  "window.__UI10_P6_CROWD__=()=>({totalFrames:qa.totalFrames,",
  "fourFrames:qa.fourFrames,samples:qa.crowdSamples.slice(-60),",
  "chatConnected:document.querySelector('[data-local-chat]')?.dataset.connected==='true',",
  "roster:[...document.querySelectorAll('#scoreboard-list li')].map(x=>x.querySelector('span')?.textContent||''),",
  "server:document.querySelector('#event-text')?.textContent||''});",
  "}",
 ].join("");
 for(const id of sessions)await evaljs(id,crowdObserve);
 // Source World spawns four IDs at x42/138/234/330,y42; converge only
 // via REAL native WASD on the four OWNED connected Canvas clients.
 const movePlan=[
  {key:"d",ms:640},{key:"d",ms:195},
  {key:"a",ms:255},{key:"a",ms:655}
 ];
 for(let i=0;i<sessions.length;i++){
  const id=sessions[i],p=movePlan[i];
  await evaljs(id,"document.querySelector('#arena').focus()");
  await wd("POST","/session/"+id+"/actions",{actions:[
   {type:"key",id:"p6-native-crowd-"+i,actions:[
    {type:"keyDown",value:p.key}]}]});
  await delay(p.ms);
  await wd("POST","/session/"+id+"/actions",{actions:[
   {type:"key",id:"p6-native-crowd-"+i,actions:[
    {type:"keyUp",value:p.key}]}]});
 }
 // Native movement must be visible to actual local player server clocks.
 // Allow real server corrections and remote interpolation to settle; report
 // the last qualifying four-image frames, not earlier arbitrary spawn frames.
 await delay(1100);
 const reports=[];
 for(let i=0;i<sessions.length;i++){
  const result=await poll("P6 same real four-fighter crowd "+i,async()=>{
   const q=await evaljs(sessions[i],"return window.__UI10_P6_CROWD__?.()");
   const samples=q?.samples??[];
   const recent=samples.slice(-12);
   const good=recent.filter(f=>f.min>=26.0&&f.max<=135);
   return {...q,recent,goodCount:good.length,ok:q?.fourFrames>=12&&
    q?.roster?.length===4&&q?.chatConnected===true&&recent.length>=8&&
    good.length>=8&&/Online - player #\d+ - server tick \d+/.test(q.server)};
  },12000);
  const latest=result.recent.at(-1);
  reports.push({browser:browserMatrix[i],player:i+1,
   minCssPx:latest.min,maxCssPx:latest.max,
   qualifyingCrowdFrames:result.goodCount,fourFrames:result.fourFrames,
   realRoster:result.roster,server:result.server});
 }
 console.log("UI10_P6_FOUR_REAL_NATIVE_CROWD_SEPARATION_PASS",
  JSON.stringify({reports,worldCollisionDiameter:36,
   presentationZoom:.84,browserObservedMinCss:26,
   crowdObservedMaxCss:135,realWASDMovement:true,
   worldAuthorityNotInferredFromPixels:true,noFakeFighters:true}));
 console.log("PASS real Rust server and "+sessions.length+" "+browserMatrix.join("/")+" WebTransport browser connections with pinned TLS: A↔B; C excluded from A; genuine ChatResult and continuing gameplay input ACKs");
}finally{
 for(const session of sessions){try{await wd("DELETE","/session/"+session)}catch{}}
 for(const p of processes){try{p.kill()}catch{}}
}
