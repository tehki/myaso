// Core 8A P0: original Pre-Alpha Combat arena — four genuine W3C browsers,
// genuine Rust WebTransport / INPUT_ACK, Chat C1 operator DEFAULT OFF.
// A client URL query chatC1=1 MUST NOT activate UI/server chat on loopback.
// Test-only, single CI host, no simulated fighters, production or configuration.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {join} from "node:path";

const root=process.cwd(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browsers=["chrome","firefox","chrome","chrome"];
const processes=[],sessions=[],ports=new Map();
async function randomPort(){
  return new Promise((resolve,reject)=>{
    const socket=createServer();
    socket.once("error",reject);
    socket.listen(0,"127.0.0.1",()=>{
      const port=socket.address().port;
      socket.close(()=>resolve(port));
    });
  });
}
function launch(binary,args,opts={}){
  const child=spawn(binary,args,{...opts,env:{...process.env,...opts.env},
    detached:process.platform!=="win32"});
  processes.push(child);
  return child;
}
function terminateGroup(child){
  if(!child?.pid)return;
  try {
    if(process.platform!=="win32")process.kill(-child.pid,"SIGKILL");
    else child.kill("SIGKILL");
  }catch{try{child.kill("SIGKILL")}catch{}}
}
async function wd(method,path,body,creationPort){
  const sessionId=path.match(/^\/session\/([^/]+)/)?.[1];
  const port=creationPort??ports.get(sessionId);
  assert(Number.isSafeInteger(port),"genuine WebDriver session required");
  const r=await fetch("http://127.0.0.1:"+port+path,{
    method,headers:{"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(35000),
  });
  const payload=await r.json();
  if(!r.ok||payload.value?.error)throw Error(method+" "+path+" "+JSON.stringify(payload).slice(0,700));
  return payload.value;
}
const evaljs=(session,script,args=[])=>wd("POST","/session/"+session+"/execute/sync",{script,args});
async function poll(label,fn,ms=17000){
  const start=Date.now();let last;
  while(Date.now()-start<ms){
    try{last=await fn();if(last?.ok)return last;}catch(e){last={error:String(e)}}
    await delay(180);
  }
  throw Error("Timeout "+label+": "+JSON.stringify(last).slice(0,1300));
}
async function snapshot(session){
  return evaljs(session,
    "const rows=[...document.querySelectorAll('#scoreboard-list li')];"
    +"const status=document.querySelector('#event-text')?.textContent||'';"
    +"const diag=document.querySelector('#network-diagnostics')?.textContent||'';"
    +"const tick=status.match(/server tick ([0-9]+)/);"
    +"const samples=diag.match(/Samples ([0-9]+)/);"
    +"return {status,serverTick:tick?Number(tick[1]):0,samples:samples?Number(samples[1]):0,"
    +"roster:rows.map(r=>r.textContent),own:rows.filter(r=>r.dataset.own==='true').length,"
    +"canvas:!!document.querySelector('canvas#arena'),"
    +"chatRoot:!!document.querySelector('[data-local-chat],.local-chat'),"
    +"chatInput:!!document.querySelector('.local-chat-input'),"
    +"diagnostics:diag};");
}
async function nativeMove(session){
  await evaljs(session,"document.querySelector('#arena').focus();");
  await wd("POST","/session/"+session+"/actions",{actions:[{type:"key",id:"combat-movement",
    actions:[{type:"keyDown",value:"w"}]}]});
  await delay(270);
  await wd("POST","/session/"+session+"/actions",{actions:[{type:"key",id:"combat-movement",
    actions:[{type:"keyUp",value:"w"}]}]});
}
try{
  const env={...process.env,MYASO_BIND:"127.0.0.1:0"};
  delete env.MYASO_CHAT_C1_ENABLED;
  const server=launch(join(root,"server","target","debug","myaso-server"),[],{
    env,stdio:["ignore","pipe","pipe"],
  });
  let stdout="",stderr="";
  server.stdout.on("data",x=>{stdout+=x.toString()});
  server.stderr.on("data",x=>{stderr+=x.toString()});
  const ready=await poll("real Rust QUIC server",()=>{
    const url=stdout.match(/listening on (https:\/\/[^\s]+)/)?.[1];
    const cert=stdout.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];
    return {ok:!!url&&!!cert,url,cert};
  },15000);
  assert(ready.url.startsWith("https://127.0.0.1:"));
  const pin=ready.cert.replaceAll(":","");
  assert.match(pin,/^[a-fA-F0-9]{64}$/,"actual ephemeral certificate pin required");
  console.log("PREALPHA_C1_DEFAULT_OFF_REAL_RUST",JSON.stringify({
    url:ready.url,certificateSha256Length:pin.length,chatOperatorFlagPresent:false,
  }));
  const webPort=await randomPort();
  launch("python3",["-m","http.server",String(webPort),"--bind","127.0.0.1",
    "--directory",root],{stdio:"ignore"});
  const driverPorts={};
  for(const family of new Set(browsers)){
    const driverPort=await randomPort();
    driverPorts[family]=driverPort;
    const executable=family==="chrome"?"chromedriver":(process.env.C1_GECKODRIVER||"geckodriver");
    launch(executable,["--port="+driverPort],{stdio:"ignore"});
    await poll(family+" native W3C driver",async()=>{
      const response=await fetch("http://127.0.0.1:"+driverPort+"/status",
        {signal:AbortSignal.timeout(700)}).catch(()=>null);
      return {ok:!!response?.ok};
    },12000);
  }
  const url="http://127.0.0.1:"+webPort+"/web/?server="
    +encodeURIComponent(ready.url)+"&cert="+encodeURIComponent(pin)
    +"&chatC1=1&netstats=1";
  for(let i=0;i<browsers.length;i++){
    const family=browsers[i],driverPort=driverPorts[family];
    const caps=family==="chrome"?{browserName:"chrome","goog:chromeOptions":{
      args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1200,820"]}}
      :{browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
    const session=(await wd("POST","/session",
      {capabilities:{alwaysMatch:caps}},driverPort)).sessionId;
    assert(session,"genuine native W3C session required");
    ports.set(session,driverPort);sessions.push(session);
    await wd("POST","/session/"+session+"/url",{url});
    const state=await poll("real admitted fighter "+(i+1),async()=>{
      const state=await snapshot(session);
      return {ok:state.serverTick>0&&state.own===1&&state.canvas
        &&state.samples>0,value:state};
    },18000);
    assert.equal(state.value.chatRoot,false,"unapproved URL chatC1=1 must not create chat UI");
    console.log("PREALPHA_C1_OFF_BROWSER_JOIN",JSON.stringify({
      browser:family,ordinal:i+1,...state.value,
    }));
  }
  const initial=await Promise.all(sessions.map((session,i)=>poll(
    "four genuine server fighters visible on "+browsers[i],async()=>{
      const s=await snapshot(session);
      return {ok:s.roster.length===4&&s.own===1&&s.serverTick>0
        &&s.samples>0&&!s.chatRoot&&!s.chatInput,value:s};
    },15000)));
  for(let i=0;i<sessions.length;i++){
    await nativeMove(sessions[i]);
  }
  const final=await Promise.all(sessions.map((session,i)=>poll(
    "server-owned input ACK progress under four players on "+browsers[i],async()=>{
      const now=await snapshot(session),before=initial[i].value;
      const advancingSamples=now.samples>before.samples;
      const cappedWindow=before.samples>=94&&now.samples===96;
      return {ok:now.roster.length===4&&now.own===1&&!now.chatRoot&&!now.chatInput
        &&now.serverTick>before.serverTick+3&&now.samples>0
        &&(advancingSamples||cappedWindow),value:now};
    },12000)));
  console.log("PREALPHA_P0_FOUR_REAL_NATIVE_CHAT_DEFAULT_OFF_PASS",
    JSON.stringify({realBrowsers:browsers,authenticatedRosterSize:4,
      operatorChatEnabled:false,forgedChatQueryIgnored:true,
      activeNativeKeyboardInput:true,
      originalServerTicksBefore:initial.map(v=>v.value.serverTick),
      originalServerTicksAfter:final.map(v=>v.value.serverTick),
      perBrowserAckSamples:final.map(v=>v.value.samples),
      physicalSwordEvidence:false,independentClientHosts:false,
      scope:"original Pre-Alpha arena, four actual W3C browsers, one local Rust server"}));
}catch(error){
  console.error("PREALPHA_P0_FOUR_REAL_NATIVE_CHAT_DEFAULT_OFF_FAIL",error);
  process.exitCode=1;
}finally{
  for(const session of sessions){try{await wd("DELETE","/session/"+session)}catch{}}
  for(const process_ of processes.reverse())terminateGroup(process_);
}
