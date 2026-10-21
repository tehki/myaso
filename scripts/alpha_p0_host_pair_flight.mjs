// Core 8A P0: RUN ON EACH OF TWO REAL STAGING CLIENT HOSTS (role A and B).
// This script NEVER starts a game server, opens a port beyond localhost,
// changes routing, or asserts that preflight alone proves cross-host play.
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {readFile,stat,writeFile,mkdir} from "node:fs/promises";
import {hostname,networkInterfaces} from "node:os";
import path from "node:path";
import {setTimeout as sleep} from "node:timers/promises";
import {parseHostPairConfig,privateIpv4} from "./alpha_p0_host_pair_config.mjs";

const interfaces=Object.values(networkInterfaces()).flat().filter(Boolean);
const localAddresses=interfaces.filter(x=>x.family==="IPv4"&&!x.internal).map(x=>x.address);
// Refuse missing attestation BEFORE starting browsers or even HTTP localhost.
const cfg=parseHostPairConfig(process.env,{localAddresses});
const root=process.cwd(),started=Date.now(),children=[],sessions=[],evidence={};
let http;
const end=cfg.start+35000;
function assert(ok,msg){if(!ok)throw Error(msg)}
function stop(child,signal="SIGTERM"){
  if(!child?.pid)return;
  try{if(process.platform==="win32")child.kill(signal);else process.kill(-child.pid,signal)}catch{}
}
async function w3c(s,method,uri,body,timeout=12000){
  const r=await fetch(s.base+uri,{method,headers:body===undefined?undefined:{"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
  const j=await r.json();
  if(!r.ok||j.value?.error)throw Error("W3C "+method+" "+uri+" "+JSON.stringify(j.value).slice(0,450));
  return j.value??j;
}
async function poll(fn,label,limit){
  const until=Math.min(Date.now()+limit,end);
  let last;
  while(Date.now()<until){
    last=await fn();
    if(last?.ok)return last.value;
    await sleep(160);
  }
  throw Error(label+" timed out; last="+JSON.stringify(last?.value).slice(0,500));
}
async function pageServer(){
  const server=createServer(async(req,res)=>{
    try{
      const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1/").pathname);
      const relative=pathname.endsWith("/")?pathname+"index.html":pathname;
      const abs=path.resolve(root,"."+relative);
      if(!abs.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
      const info=await stat(abs);
      if(!info.isFile()){res.writeHead(404);res.end();return}
      const types={".html":"text/html; charset=utf-8",".js":"text/javascript",
        ".mjs":"text/javascript",".css":"text/css",".png":"image/png",
        ".svg":"image/svg+xml",".json":"application/json",".woff2":"font/woff2"};
      res.setHeader("content-type",types[path.extname(abs)]||"application/octet-stream");
      res.setHeader("cache-control","no-store");
      res.end(await readFile(abs));
    }catch{res.writeHead(404);res.end()}
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  return server;
}
async function driver(family,port){
  const exe=family==="chrome"?"chromedriver":"geckodriver";
  const args=family==="chrome"?[`--port=${port}`, "--allowed-ips=127.0.0.1"]:
    ["--host","127.0.0.1","--port",String(port)];
  const child=spawn(exe,args,{cwd:root,detached:process.platform!=="win32",
    stdio:["ignore","pipe","pipe"]});
  children.push(child);
  child.stdout.on("data",d=>process.stdout.write("["+family+" driver] "+d));
  child.stderr.on("data",d=>process.stderr.write("["+family+" driver] "+d));
  const s={family,base:`http://127.0.0.1:${port}`,child};
  await poll(async()=>{
    if(child.exitCode!==null)throw Error(family+" WebDriver exited "+child.exitCode);
    try{return {ok:(await fetch(s.base+"/status",{signal:AbortSignal.timeout(600)})).ok,value:true}}
    catch{return {ok:false,value:false}}
  },family+" driver startup",14000);
  const caps=family==="chrome"?{browserName:"chrome","goog:chromeOptions":{args:[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900",
    "--disable-background-timer-throttling","--disable-backgrounding-occluded-windows"]}}:
    {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],
      prefs:{"dom.min_background_timeout_value":4,
        "dom.timeout.enable_budget_timer_throttling":false}}};
  const created=await w3c(s,"POST","/session",{capabilities:{alwaysMatch:caps}},30000);
  s.id=created.sessionId??created.value?.sessionId;
  assert(s.id,"missing real browser W3C session ID");
  sessions.push(s);
  await w3c(s,"POST",`/session/${s.id}/timeouts`,{script:15000,pageLoad:30000,implicit:0});
  const u=new URL(`http://127.0.0.1:${http.address().port}/web/index.html`);
  u.searchParams.set("server",cfg.url);
  u.searchParams.set("cert",cfg.fingerprint);
  u.searchParams.set("scenario","uijumpffaprimary");
  await w3c(s,"POST",`/session/${s.id}/url`,{url:u.href},30000);
  await poll(async()=>{const v=await snapshot(s);return {ok:v.id>0&&v.tick>0,value:v}},
    family+" authentic game admission",18000);
  return s;
}
async function snapshot(s){
  return await w3c(s,"POST",`/session/${s.id}/execute/sync`,{
    script:`const a=window.__MYASO_ACCEPTANCE_STATE__;
      return {id:Number(a?.playerNetId??0),tick:Number(a?.serverTick??0),
        fighters:(a?.fighters??[]).map(f=>({netId:Number(f.netId),x:Number(f.x),y:Number(f.y)})),
        scoreboard:[...document.querySelectorAll("#scoreboard-list li")].map(x=>x.textContent.trim())};`,
    args:[]
  });
}
function fighter(state,id){return state.fighters.find(f=>f.netId===id)}
function roster(state){
  const ids=state.fighters.map(f=>f.netId).sort((a,b)=>a-b);
  return state.tick>0&&state.id>0&&ids.length===4
    &&new Set(ids).size===4
    &&ids.every(id=>Number.isSafeInteger(id)&&id>0
      &&state.scoreboard.some(row=>row.startsWith("#"+id)))
    &&state.scoreboard.length===4;
}
function moved(from,to,id){
  const a=fighter(from,id),b=fighter(to,id);
  return !!a&&!!b&&Math.hypot(b.x-a.x,b.y-a.y)>4;
}
async function move(s){
  const el=await w3c(s,"POST",`/session/${s.id}/element`,{using:"css selector",value:"#arena"});
  const id=el["element-6066-11e4-a52e-4f735466cecf"];
  assert(id,"actual game arena missing");
  await w3c(s,"POST",`/session/${s.id}/element/${id}/click`,{});
  const uri=`/session/${s.id}/actions`;
  await w3c(s,"POST",uri,{actions:[{type:"key",id:"pair-native",actions:[{type:"keyDown",value:"d"}]}]});
  try{await sleep(950)}
  finally{await w3c(s,"POST",uri,{actions:[{type:"key",id:"pair-native",actions:[{type:"keyUp",value:"d"}]}]})}
}
async function untilUtc(when){
  if(Date.now()>when+900)throw Error("coordinated UTC time missed: "+when);
  await sleep(Math.max(0,when-Date.now()));
}
async function run(){
  console.log("MYASO_P0_PAIR_START "+JSON.stringify({
    role:cfg.role,hostId:cfg.hostId,osHost:hostname(),server:cfg.url,
    utcBarrier:cfg.start,clientIpv4:localAddresses.filter(privateIpv4)}));
  http=await pageServer();
  await driver("chrome",9661);
  await driver("firefox",9662);
  const joined=await Promise.all(sessions.map(s=>poll(async()=>{
    const state=await snapshot(s);return {ok:roster(state),value:state};
  },s.family+" four live identities",Math.max(1000,cfg.start-Date.now()-4000))));
  const localIds=joined.map(s=>s.id);
  assert(new Set(localIds).size===2,"two real browsers reused same identity");
  const allIds=joined[0].fighters.map(f=>f.netId).sort((a,b)=>a-b);
  assert(joined[1].fighters.map(f=>f.netId).sort((a,b)=>a-b).join(",")===allIds.join(","),
    "two local browsers disagree on four-player authoritative roster");
  const peerIds=allIds.filter(id=>!localIds.includes(id));
  assert(peerIds.length===2,"no two independently admitted peer-host players");
  await untilUtc(cfg.start-2000);
  const baseline=await Promise.all(sessions.map(snapshot));
  assert(baseline.every(x=>roster(x)&&x.fighters.map(f=>f.netId).sort((a,b)=>a-b).join(",")===allIds.join(",")),
    "roster changed before coordinated cross-host movement");
  await untilUtc(cfg.start+(cfg.role==="A"?750:6500));
  const actedAt=Date.now();
  await move(sessions[0]);
  await poll(async()=>{const state=await snapshot(sessions[0]);return {
    ok:roster(state)&&state.tick>baseline[0].tick&&moved(baseline[0],state,localIds[0]),value:state
  }},cfg.role+" genuine local W3C Chrome movement",8000);
  await sleep(Math.max(0,cfg.start+14000-Date.now()));
  const proof=await poll(async()=>{
    const states=await Promise.all(sessions.map(snapshot));
    const candidates=peerIds.filter(id=>states.every((s,i)=>moved(baseline[i],s,id)));
    const ok=states.every((s,i)=>roster(s)&&s.tick>baseline[i].tick
      &&s.fighters.map(f=>f.netId).sort((a,b)=>a-b).join(",")===allIds.join(",")
      &&moved(baseline[i],s,localIds[0]));
    return {ok:ok&&candidates.length===1,value:{states,candidates}};
  },cfg.role+" genuine opposite-host movement in both browsers",15000);
  const marker="MYASO_P0_PAIR_LIVE_REMOTE_MOVE_PASS";
  Object.assign(evidence,{
    marker,kind:"P0_REAL_W3C_PAIR_STAGING",scope:"NOT production / Greyhaven / swords / WAN qualification",
    role:cfg.role,hostId:cfg.hostId,peerHostId:cfg.peerHostId,
    osHost:hostname(),localIpv4:localAddresses.filter(privateIpv4),
    url:cfg.url,certificateSha256:cfg.fingerprint,serverCapAttested:4,start:cfg.start,
    clientFamilies:sessions.map(s=>s.family),localIds,allIds,remoteIds:peerIds,
    actorId:localIds[0],remoteMovedId:proof.candidates[0],
    movedAt:actedAt,serverTicksBefore:baseline.map(s=>s.tick),
    serverTicksAfter:proof.states.map(s=>s.tick),
    baseline:baseline.map(s=>s.fighters),observed:proof.states.map(s=>s.fighters),
    twoNativeIndependentW3cClients:true,authenticatedRemoteQuic:true,
    crossHostMovementSeenByChromeAndFirefox:true,
  });
  console.log(marker+" "+JSON.stringify(evidence));
}
let failed=false;
try{await run()}
catch(e){failed=true;console.error("MYASO_P0_PAIR_FAILED "+(e.stack??e))}
finally{
  const output=path.join(root,`alpha-p0-pair-${cfg.role.toLowerCase()}-evidence.json`);
  if(!failed)await writeFile(output,JSON.stringify(evidence,null,2));
  for(const s of sessions)try{await w3c(s,"DELETE",`/session/${s.id}`,undefined,1500)}catch{}
  for(const child of children)stop(child);
  await sleep(1200);
  for(const child of children)stop(child,"SIGKILL");
  if(http){http.closeAllConnections?.();await Promise.race([
    new Promise(resolve=>http.close(resolve)),sleep(1800)])}
}
if(failed)process.exitCode=1;
