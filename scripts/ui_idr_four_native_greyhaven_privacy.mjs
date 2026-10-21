// UI/Graphics3B/Core joined four real-browser Greyhaven source with original empty Blacksmith rack and authoritative local chat.
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
 // Each genuine browser needs its own driver daemon. GeckoDriver supports
 // only one active Firefox session per process; a family-shared port fails
 // the second Firefox before any chat/game assertion can run.
 const url="http://127.0.0.1:"+httpPort+"/web/?server="+encodeURIComponent(ready.url)+"&cert="+encodeURIComponent(ready.cert.replaceAll(":",""))+"&chatC1Preview=1&netstats=1&world=1&armoryart=1&uiLivenessProbe=1&idrPreview=1";
 for(let i=0;i<browserMatrix.length;i++){
  const browser=browserMatrix[i];
  const port=await randomPort();
  launch(browser==="chrome"?"chromedriver":(process.env.C1_GECKODRIVER||"geckodriver"),
   ["--port="+port],{stdio:"ignore"});
  await poll(browser+" #"+(i+1)+" driver",async()=>{
   const r=await fetch("http://127.0.0.1:"+port+"/status").catch(()=>null);
   return {ok:!!r?.ok};
  },6500);
  const capabilities=browser==="chrome"
   ? {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1100,780"]}}
   : {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],...(process.env.C1_FIREFOX_BINARY?{binary:process.env.C1_FIREFOX_BINARY}:{})}};
  const session=(await wd("POST","/session",{capabilities:{alwaysMatch:capabilities}},port)).sessionId;
  sessionDriverPorts.set(session,port);
  sessions.push(session);
  await wd("POST","/session/"+session+"/url",{url});
  const connected=await poll("player "+(i+1),()=>evaljs(session,"const x=document.querySelector('[data-local-chat]');return {ok:x?.dataset.connected==='true',status:x?.querySelector('.local-chat-status')?.textContent,event:document.querySelector('#event-text')?.textContent,connected:x?.dataset.connected};"),15000);
  console.log("PLAYER_READY",i+1,JSON.stringify(connected));
 }
  // IDR P0: exact same authenticated Core/World/Chat browser sessions as #607.
  // Validate only observer-visible DOM; raw QUIC session IDs are NOT private yet.
  const visible=async session=>evaljs(session,
    "const rows=[...document.querySelectorAll('#scoreboard-list li')].map(li=>({own:li.dataset.own==='true',name:li.querySelector('span')?.textContent||''}));"+
    "const event=document.querySelector('#event-text')?.textContent||'';"+
    "const root=window.__MYASO_ARMORY_RACK_REVIEW__?.()??null;"+
    "const probe=window.__MYASO_WORLD_LIVENESS__?.snapshot(Date.now())??null;"+
    "return {ok:rows.length===4&&rows.filter(r=>r.own&&r.name==='You').length===1"+
    "&&rows.filter(r=>!r.own&&r.name==='Unknown stranger').length===3"+
    "&&!rows.some(r=>/Player\\s*#\\d+/i.test(r.name))"+
    "&&event.includes('connected character')&&!/Player\\s*#\\d+/i.test(event)"+
    "&&root?.ready===true&&root.painted>0&&root.actualCanvas===true"+
    "&&root.drawnSwords===0&&root.canonicalItems===false"+
    "&&root.serverTryPickup===false&&root.productionApproved===false"+
    "&&probe?.snapshots>=2&&probe?.paints>=2,rows,event,rack:root,probe};");
  const before=[];
  for(const session of sessions){
    before.push(await poll("server-connected IDR four-roster visible privacy",()=>visible(session),22000));
  }
  console.log("IDR_FOUR_NATIVE_HIDDEN_ROSTER_PASS",JSON.stringify(before.map((r,i)=>({
    peer:i+1,labels:r.rows.map(z=>z.name),status:r.event,painted:r.rack.painted,
    canonicalItems:r.rack.canonicalItems
  }))));
  const [a,b,c,d]=sessions;
  const claim="I am Commander Aldric — believe me?";
  await evaljs(a,"document.querySelector('#arena').focus();");
  await key(a,"\uE007");
  const focused=await evaljs(a,
    "const x=document.querySelector('[data-local-chat]');return {ok:document.activeElement===x.querySelector('input')&&x.dataset.open==='true'};");
  assert.equal(focused.ok,true,"actual Enter must focus the chat composer");
  await evaljs(a,"document.querySelector('.local-chat-input').value=arguments[0]",[claim]);
  await key(a,"\uE007");
  await poll("A authentic ChatResult accepted",()=>evaljs(a,
    "return {ok:[...document.querySelectorAll('li[data-delivery=accepted] .local-chat-text')].some(x=>x.textContent===arguments[0])}",[claim]));
  async function received(session){
    return evaljs(session,
      "const rows=[...document.querySelectorAll('.local-chat-item[data-channel=local]')].map(li=>({sender:li.querySelector('.local-chat-sender')?.textContent,text:li.querySelector('.local-chat-text')?.textContent}));"+
      "return {ok:rows.some(r=>r.text===arguments[0]),rows};",[claim]);
  }
  const nearB=await poll("B hears anonymous A",()=>received(b));
  const nearC=await poll("C hears anonymous A",()=>received(c));
  assert.equal(nearB.rows.find(r=>r.text===claim)?.sender,"Unknown voice");
  assert.equal(nearC.rows.find(r=>r.text===claim)?.sender,"Unknown voice");
  await delay(500);
  const farD=await received(d);
  assert.equal(farD.ok,false,"D must not hear diagonal A at radius 100");
  for(const session of sessions){
    const after=await poll("masked scoreboard and real HUD still fresh after chat",async()=>{
      const now=await visible(session);
      return {...now,ok:now.ok&&now.probe.snapshotTick>before[sessions.indexOf(session)].probe.snapshotTick};
    },14000);
    assert(after.rows.every(row=>row.own?row.name==="You":row.name==="Unknown stranger"));
  }
  console.log("UI_IDR_FOUR_NATIVE_GREYHAVEN_PREVIEW_PASS",JSON.stringify({
    browsers:browserMatrix,radius:100,chatServerAck:true,
    claimedNameStayedUnverified:true,near:["B","C"],far:"D",
    visibleSender:"Unknown voice",realItems:false,realVerification:false,
    publicIdentityWireChanged:false
  }));
}finally{
  for(const session of sessions){try{await wd("DELETE","/session/"+session)}catch{}}
  for(const p of processes){try{p.kill()}catch{}}
}
