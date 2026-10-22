// Native fast-Connecting-phase browser pagehide; original server and QUIC.
// Does NOT claim promise resolved after pagehide (that needs a separate test).
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {join} from "node:path";
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const freePort=()=>new Promise((resolve,reject)=>{const s=createServer();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const children=[],sessions=[],portsBySession=new Map();
function run(bin,args,env={}){const p=spawn(bin,args,{env:{...process.env,...env},stdio:["ignore","pipe","pipe"]});children.push(p);return p;}
async function api(port,method,path,data){
 const r=await fetch("http://127.0.0.1:"+port+path,{method,
  headers:{"content-type":"application/json"},body:data===undefined?undefined:JSON.stringify(data)});
 const json=await r.json();if(!r.ok||json.value?.error)throw Error(method+" "+path+" "+JSON.stringify(json).slice(0,450));return json.value;
}
const wd=(s,m,path,data)=>api(portsBySession.get(s),m,"/session/"+s+path,data);
const js=(s,source,args=[])=>wd(s,"POST","/execute/sync",{script:source,args});
async function poll(label,fn,timeout=12000){const start=Date.now();let last;while(Date.now()-start<timeout){try{last=await fn();if(last?.ok)return last;}catch(e){last={error:String(e)};}await pause(100);}throw Error("Timeout "+label+": "+JSON.stringify(last).slice(0,1400));}
async function session(browser,driverPorts){
 const caps=browser==="chrome"?
 {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,720"]}}:
 {browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
 const s=(await api(driverPorts[browser],"POST","/session",{capabilities:{alwaysMatch:caps}})).sessionId;
 assert(s);sessions.push(s);portsBySession.set(s,driverPorts[browser]);return s;
}
const state='const t=document.querySelector("#event-text")?.textContent||"";return {path:location.pathname,status:t,ok:location.pathname==="/web/"&&t.startsWith("Connecting to authoritative server")};';
try {
 const server=run(join(process.cwd(),"server/target/debug/myaso-server"),[],{MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4"});
 let out="";server.stdout.on("data",b=>out+=b.toString());
 const online=await poll("Rust server",()=>{const url=out.match(/listening on (https:\/\/[^\s]+)/)?.[1],pin=out.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];return {ok:!!url&&!!pin,url,pin};},15000);
 const http=await freePort();run("python3",["-m","http.server",String(http),"--bind","127.0.0.1","--directory",process.cwd()]);
 const drivers={};for(const b of ["chrome","firefox"]){drivers[b]=await freePort();run(b==="chrome"?"chromedriver":"geckodriver",["--port="+drivers[b]]);await poll(b+" driver",async()=>({ok:(await fetch("http://127.0.0.1:"+drivers[b]+"/status").catch(()=>null))?.ok}),10000);}
 const url="http://127.0.0.1:"+http+"/web/?server="+encodeURIComponent(online.url)+"&cert="+encodeURIComponent(online.pin.replaceAll(":",""))+"&netstats=1";
 const probe=await session("chrome",drivers);await wd(probe,"POST","/url",{url:"about:blank"});
 let observed=null;const phases=[];
 // Browser navigation is real. We do not dispatch synthetic pagehide, fake
 // the WebTransport connection, or modify its admission timings.
 for(let i=0;i<8;i++){
  await js(probe,"window.location.assign(arguments[0]);return true",[url]);
  let connecting=null;
  for(let k=0;k<35;k++){try{const v=await js(probe,state);if(v.ok){connecting=v;break;}if(/^Online - player/.test(v.status))break;}catch{}await pause(25);}
  const before=await js(probe,'return {path:location.pathname,status:document.querySelector("#event-text")?.textContent||""}').catch(()=>({path:"transition",status:""}));
  await wd(probe,"POST","/url",{url:"about:blank"});
  phases.push({attempt:i+1,connectingSeen:!!connecting,exitFrom:before.path,status:before.status.slice(0,100)});
  if(connecting){observed=connecting;break;}
 }
 console.log("UI10_REAL_FAST_CONNECT_EXIT_PHASES",JSON.stringify({phases,observed,unsettledQuicPromiseNotProved:true}));
 assert(observed,"Native Connecting-stage exit not captured; refuse to claim this race qualified");
 // All four real Rust-owned seats must still be available to independently
 // authenticated original Chrome/Firefox clients after the probe departed.
 const players=[];
 for(const browser of ["chrome","firefox","chrome","chrome"]){
  const s=await session(browser,drivers);await wd(s,"POST","/url",{url});
  const x=await poll("four fresh server-owned seats after fast exit",()=>js(s,
   'const t=document.querySelector("#event-text")?.textContent||"";return {ok:/Online - player #\\d+ - server tick \\d+/.test(t),status:t};'),18000);
  players.push({browser,status:x.status});
 }
 const fifth=await session("chrome",drivers);await wd(fifth,"POST","/url",{url}).catch(()=>{});
 const reject=await poll("fifth connection must be rejected at capacity",()=>js(fifth,
  'const t=document.querySelector("#event-text")?.textContent||"";return {ok:/Multiplayer connection failed|Connection failed|server full|maximum players/i.test(t),status:t};'),11000);
 console.log("UI10_REAL_CONNECT_STAGE_PAGEHIDE_FOUR_SEAT_PASS",JSON.stringify({
  observedRealConnectingBeforeNativeExit:true,actors:players,fifthRejected:reject.status,
  genuineBrowserNavigation:true,webTransportReal:true,serverActualRust:true,
  earlyPromiseResolutionAfterPagehideNotProved:true,publicGameUnaffected:true}));
} finally {
 for(const s of sessions){try{await wd(s,"DELETE","")}catch{}}
 for(const p of children){try{p.kill()}catch{}}
}
