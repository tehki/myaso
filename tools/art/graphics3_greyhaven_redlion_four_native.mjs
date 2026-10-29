// Reserve Main 0: original grid Silver Knight release-slice; genuine Rust QUIC and four W3C browser sessions.
// Original playable arena only. No fake actors, packets, Silver artwork or Combat authority.
import assert from "node:assert/strict";
import {spawn, spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve, join, extname, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";

// Nonrelease QA: same real Rust/Chrome/Firefox Silver + Chat client with opt-in source-verified Greyhaven Red Lion.
// Original 3B Blender assets, 3C World9 renderer and actor painter are exercised, never fake World players.
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const engines=(process.env.MYASO_GRAPHICS3_NATIVE_BROWSERS||"chrome,firefox,chrome,firefox").split(",");
assert.equal(engines.length,4,"four distinct genuine browser sessions required");
assert.ok(engines.every(x=>x==="chrome"||x==="firefox"),"unknown W3C browser engine");
const output=resolve(process.env.MYASO_GRAPHICS3_NATIVE_OUT||join(root,".artifacts","graphics3-greyhaven-redlion-native"));
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
 const build=spawnSync("cargo",["build",...(process.env.MYASO_KNIGHTS_CARGO_OFFLINE==="0"?[]:["--offline"]),"--locked","--manifest-path","server/Cargo.toml","--bin","myaso-server","--quiet"],{cwd:root,encoding:"utf8",timeout:150000});
 if(build.status!==0)throw Error("exact source local Rust build failed: "+String(build.stderr||build.error).slice(-1900));
 const child=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",MYASO_CHAT_C1_ENABLED:"1",MYASO_CHAT_RADIUS:"450"},stdio:["ignore","pipe","pipe"]});
 processes.push(child);let buffer="",err="";
 child.stdout.on("data",d=>buffer+=d.toString());
 child.stderr.on("data",d=>err+=d.toString());
 const v=await waitFor(()=>{if(child.exitCode!==null)throw Error("Rust server exit "+err);const url=buffer.match(/listening on (https:\/\/[^\s]+)/)?.[1];const cert=buffer.match(/development certificate SHA-256:\s*([0-9a-fA-F:]+)/)?.[1]?.replaceAll(":","").toLowerCase();return url&&cert?.length===64?{url,cert}:null},30000);
 return v;
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

const nativeHook=String.raw`
const canvas=document.querySelector("#arena");
if(!canvas||canvas.width!==960||canvas.height!==540)return false;
const obs=window.__graphics3Greyhaven={frames:[],lastFrame:0,worldDraws:0,facadeDraws:0,roofDraws:0};
const real=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(...args){
 const src=args[0],at=performance.now();
 if(typeof ImageBitmap!=="undefined" && src instanceof ImageBitmap){
   if(src.width===228&&src.height===297)obs.facadeDraws++;
   if(src.width===238&&src.height===197)obs.roofDraws++;
 }
 if(this.canvas===canvas&&src instanceof HTMLCanvasElement&&src.width===960&&src.height===540){
   obs.worldDraws++;
   if(at-obs.lastFrame>5){obs.frames.push(at);obs.lastFrame=at;if(obs.frames.length>900)obs.frames.shift()}
 }
 return real.apply(this,args);
};
return true;`;
const nativeStats=String.raw`
const obs=window.__graphics3Greyhaven;if(!obs)return null;
const frames=obs.frames,ms=frames.slice(1).map((v,i)=>v-frames[i]).filter(v=>v>=0).sort((a,b)=>a-b);
const p=q=>ms.length?ms[Math.min(ms.length-1,Math.floor((ms.length-1)*q))]:null;
const c=document.querySelector("#arena"),h=document.querySelector("[data-local-chat]");
return {realSourceObservation:true,worldDraws:obs.worldDraws,facadeDraws:obs.facadeDraws,roofDraws:obs.roofDraws,
 sampleCount:ms.length,frameP50Ms:p(.5),frameP95Ms:p(.95),
 stageWidth:c?.width,stageHeight:c?.height,
 roster:[...document.querySelectorAll("#scoreboard-list li")].map(e=>e.textContent?.trim()),
 status:document.querySelector("#event-text")?.textContent||"",
 chatConnected:h?.dataset.connected,chatOpen:h?.dataset.open,
 flags:Object.fromEntries(new URLSearchParams(location.search).entries())};`;
const outputTrace={samples:[],sourceSha:null,realOriginalRust:true,nativeSeparateW3CSeats:4,visualOnly:true,
  authorizedPvPNotProven:true,serverCollisionNotProven:true,redLionDayDuskSourceHashInNodeTests:true};
await mkdir(output,{recursive:true});
try{
 const shaRes=spawnSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"});
 assert.equal(shaRes.status,0,"exact checkout source identity must exist");
 outputTrace.sourceSha=shaRes.stdout.trim();
 if(process.env.MYASO_GRAPHICS3_SOURCE_SHA)assert.equal(outputTrace.sourceSha,process.env.MYASO_GRAPHICS3_SOURCE_SHA,"CI must checkout exact PR head");
 const {url:rustUrl,cert}=await startOriginalRust(),host=await startStatic();
 const actors=[];
 for(let i=0;i<4;i++){
   const s=await startW3C(engines[i],i);
   const u=new URL(host+"/web/index.html");
   for(const [key,val] of Object.entries({server:rustUrl,cert,knights:"1",knightArt:"relit",
     world:"1",greyhaven:"1",redlion:"1",dusk:"1",chatC1Preview:"1"}))u.searchParams.set(key,val);
   await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
   const actor=await waitFor(async()=>{
     const value=await evaluate(s,"return document.querySelector('#event-text')?.textContent||''");
     const match=value?.match(/Online - player #(\d+) - server tick (\d+)/);
     return match?{id:Number(match[1]),tick:Number(match[2])}:null;
   },16000);
   assert.equal(actor.id,i+1,"four distinct original authoritative Rust player IDs");
   assert.ok(await evaluate(s,nativeHook),"true native game Canvas observation");
   actors.push({s,actor});
 }
 // Real physical W3C movement on the first authenticated player. Never inject XY.
 const first=actors[0].s;
 await evaluate(first,"document.querySelector('#arena').focus();return true");
 await request(first.base,"POST","/session/"+first.id+"/actions",
   {actions:[{type:"key",id:"keyboard",actions:[{type:"keyDown",value:"d"},{type:"pause",duration:450},{type:"keyUp",value:"d"}]}]});
 await sleeps(2600);
 for(const {s,actor} of actors){
   const data=await evaluate(s,nativeStats);
   assert.ok(data?.realSourceObservation && data.stageWidth===960 && data.stageHeight===540,"actual 960x540 browser game Canvas");
   assert.equal(data.flags.world,"1");assert.equal(data.flags.greyhaven,"1");assert.equal(data.flags.redlion,"1");assert.equal(data.flags.dusk,"1");
   assert.ok(data.roster.length>=4,"actual same-server four authoritative human actors");
   assert.ok(data.worldDraws>=8,"first-party staged World9 tiles must paint into genuine game Canvas");
   assert.ok(data.facadeDraws>=8 && data.roofDraws>=8,
     "original SHA-verified Blender Red Lion day/dusk facade and roof must actually draw as decoded ImageBitmap");
   assert.ok(data.sampleCount>=12 && data.frameP95Ms!==null,"native render frame sample count");
   assert.equal(data.chatConnected,"true","genuine Chat C1 UI must stay connected");
   const page=(await request(s.base,"GET","/session/"+s.id+"/screenshot")).value;
   const pageBytes=Buffer.from(page,"base64");
   assert.ok(pageBytes.length>1000&&pageBytes.subarray(0,4).equals(Buffer.from([137,80,78,71])),"real native page PNG");
   const png=await evaluate(s,"return document.querySelector('#arena').toDataURL('image/png')");
   assert.ok(png.startsWith("data:image/png;base64,"),"original game Canvas PNG required");
   const canvasBytes=Buffer.from(png.slice("data:image/png;base64,".length),"base64");
   const prefix=s.engine+"-actor"+actor.id;
   await writeFile(join(output,prefix+"-page.png"),pageBytes);
   await writeFile(join(output,prefix+"-arena-960x540.png"),canvasBytes);
   outputTrace.samples.push({browser:s.engine,actorNetId:actor.id,data,
     pagePNG:prefix+"-page.png",pageSHA256:sha(pageBytes),
     canvasPNG:prefix+"-arena-960x540.png",canvasSHA256:sha(canvasBytes)});
 }
 await writeFile(join(output,"graphics3-greyhaven-redlion-native.json"),JSON.stringify(outputTrace,null,2)+"\n");
 console.log("GRAPHICS3_GREYHAVEN_ORIGINAL_BLENDER_REDLION_FOUR_NATIVE_PASS "+JSON.stringify({
  head:outputTrace.sourceSha,players:outputTrace.samples.map(x=>x.actorNetId),
  browsers:engines,p95Intervals:outputTrace.samples.map(x=>x.data.frameP95Ms),
  facade:outputTrace.samples.map(x=>x.data.facadeDraws),roof:outputTrace.samples.map(x=>x.data.roofDraws)
 }));
}finally{
 for(const s of sessions){try{await request(s.base,"DELETE","/session/"+s.id)}catch{}}
 for(const child of processes){try{child.kill("SIGTERM")}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
