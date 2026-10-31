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
const engines=(process.env.MYASO_WORLD9_NATIVE_BROWSERS||"chrome,firefox").split(",");
assert.equal(engines.length,2,"two distinct genuine browser sessions required");
assert.ok(engines.every(x=>x==="chrome"||x==="firefox"),"unknown W3C browser engine");
const output=resolve(process.env.MYASO_GRAPHICS3_NATIVE_OUT||join(root,".artifacts","world9-greyhaven-alpha-two-native"));
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
 const child=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"2",MYASO_CHAT_C1_ENABLED:"1",MYASO_CHAT_RADIUS:"160",MYASO_WORLD9_GREYHAVEN_ALPHA:"1"},stdio:["ignore","pipe","pipe"]});
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
const ob=window.__world9Alpha={tiles:0,frames:0};
const orig=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(...args){
 if(this.canvas===canvas && args[0] instanceof HTMLCanvasElement
   && args[0].width===512 && args[0].height===512)ob.tiles++;
 return orig.apply(this,args);
};
return true;`;
const nativeStats=String.raw`
const review=window.__MYASO_WORLD9_ALPHA_REVIEW__;
return {review,tiles:window.__world9Alpha?.tiles??0,
  stageWidth:document.querySelector("#arena")?.width,
  stageHeight:document.querySelector("#arena")?.height,
  chatConnected:document.querySelector("[data-local-chat]")?.dataset.connected,
  status:document.querySelector("#event-text")?.textContent};`;
const outputTrace={samples:[],sourceSha:null,
  originalRust:true,independentNativeBrowserSeats:2,
  physicalBuildingCollisionProven:false,zoneHandshakeProven:false,
  portalAuthorityProven:false,physicalSwordsProven:false};
await mkdir(output,{recursive:true});
try{
 const shaRes=spawnSync("git",["rev-parse","HEAD"],{cwd:root,encoding:"utf8"});
 assert.equal(shaRes.status,0,"exact checkout source identity must exist");
 outputTrace.sourceSha=shaRes.stdout.trim();
 if(process.env.MYASO_WORLD9_SOURCE_SHA)assert.equal(outputTrace.sourceSha,process.env.MYASO_WORLD9_SOURCE_SHA,"CI must checkout exact PR head");
 const {url:rustUrl,cert}=await startOriginalRust(),host=await startStatic();
 const actors=[];
 for(let i=0;i<2;i++){
   const s=await startW3C(engines[i],i);
   const u=new URL(host+"/web/index.html");
   for(const [key,val] of Object.entries({server:rustUrl,cert,knights:"1",knightArt:"relit",
     world:"1",greyhaven:"1",chatC1Preview:"1"}))u.searchParams.set(key,val);
   await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
   const actor=await waitFor(async()=>{
     const value=await evaluate(s,"return document.querySelector('#event-text')?.textContent||''");
     const match=value?.match(/Online - player #(\d+) - server tick (\d+)/);
     return match?{id:Number(match[1]),tick:Number(match[2])}:null;
   },16000);
   assert.equal(actor.id,i+1,"two distinct original authoritative Rust player IDs");
   assert.ok(await evaluate(s,nativeHook),"true native game Canvas observation");
   actors.push({s,actor});
 }
 // Confirm two real Rust-backed Greyhaven actors in both actual browsers
 // BEFORE applying any genuine trusted browser keyboard movement.
 const initial=[];
 for(const {s,actor} of actors){
   const data=await waitFor(async()=>{
     const x=await evaluate(s,nativeStats);
     return x?.review?.actors?.length===2 && x.review.worldDrawActive && x.tiles>=2 ? x : null;
   },18000);
   assert.equal(data.stageWidth,960);assert.equal(data.stageHeight,540);
   const own=data.review.actors.find(x=>x.netId===actor.id);
   assert.ok(own && Math.hypot(own.x-(actor.id===1?4110:4206),own.y-4160)<2,
     "real server actor must originate from original Greyhaven spawn");
   initial.push(data);
 }
 // One authentic W3C A key gesture, not a network event or synthetic teleport.
 const first=actors[0].s;
 await evaluate(first,"document.querySelector('#arena').focus();return true");
 await request(first.base,"POST","/session/"+first.id+"/actions",
   {actions:[{type:"key",id:"keyboard",actions:[
     {type:"keyDown",value:"a"},{type:"pause",duration:330},{type:"keyUp",value:"a"}]}]});
 await waitFor(async()=>{
   const observed=await Promise.all(actors.map(async({s})=>await evaluate(s,nativeStats)));
   const start=initial[0].review.actors.find(x=>x.netId===1).x;
   const owner=observed[0]?.review?.actors?.find(x=>x.netId===1);
   const peer=observed[1]?.review?.actors?.find(x=>x.netId===1);
   if(!owner||!peer||owner.x>=start-15||Math.abs(owner.x-peer.x)>8)return false;
   return observed;
 },18000);
 const leftObserved=await Promise.all(actors.map(async({s})=>evaluate(s,nativeStats)));
 const leftOwner=leftObserved[0].review.actors.find(x=>x.netId===1);
 assert.ok(leftOwner.x<4110-15,"real keyboard movement must first move west");
 // Clear the eastbound frontage lane with player 2 using its own genuine
 // browser input. Otherwise the two real fighter bodies correctly block
 // player 1 before it can reach the Red Lion wall under test.
 const second=actors[1].s;
 await evaluate(second,"document.querySelector('#arena').focus();return true");
 await request(second.base,"POST","/session/"+second.id+"/actions",
   {actions:[{type:"key",id:"keyboard",actions:[
     {type:"keyDown",value:"s"},{type:"pause",duration:700},{type:"keyUp",value:"s"}]}]});
 await waitFor(async()=>{
   const views=await Promise.all(actors.map(async({s})=>evaluate(s,nativeStats)));
   const a=views[0].review.actors.find(x=>x.netId===2);
   const b=views[1].review.actors.find(x=>x.netId===2);
   return a&&b&&a.y>4240&&Math.abs(a.y-b.y)<8?views:null;
 },12000);
 // Re-focus player 1 after player 2's separate browser action. W3C focus
 // is per browser window; never assume the previous seat still owns input.
 await evaluate(first,"document.querySelector('#arena').focus();return true");
 // Walk east on the open street to the Red Lion south frontage.
 await request(first.base,"POST","/session/"+first.id+"/actions",
   {actions:[{type:"key",id:"keyboard",actions:[
     {type:"keyDown",value:"d"},{type:"pause",duration:1800},{type:"keyUp",value:"d"}]}]});
 let lastFrontage=[];
 const frontage=await waitFor(async()=>{
   const views=await Promise.all(actors.map(async({s})=>evaluate(s,nativeStats)));
   const a=views[0].review.actors.find(x=>x.netId===1);
   const b=views[1].review.actors.find(x=>x.netId===1);
   lastFrontage=views.map(v=>v.review.actors.filter(x=>x.netId===1||x.netId===2));
   return a&&b&&a.x>4330&&a.x<4410&&Math.abs(a.x-b.x)<8?views:null;
 },18000).catch(error=>{
   console.error("GREYHAVEN_RED_LION_FRONTAGE_FIRST_RED "+JSON.stringify(lastFrontage));
   throw error;
 });
 const frontageActor=frontage[0].review.actors.find(x=>x.netId===1);
 assert.ok(frontageActor.y>4050+18,"open south street is walkable before the building face");
 // Move north in two physical steps: first onto the safe sidewalk, then
 // attempt to cross the Red Lion's actual fixed building AABB.
 await evaluate(first,"document.querySelector('#arena').focus();return true");
 await request(first.base,"POST","/session/"+first.id+"/actions",
   {actions:[{type:"key",id:"keyboard",actions:[
     {type:"keyDown",value:"w"},{type:"pause",duration:300},{type:"keyUp",value:"w"}]}]});
 const sidewalk=await waitFor(async()=>{
   const views=await Promise.all(actors.map(async({s})=>evaluate(s,nativeStats)));
   const a=views[0].review.actors.find(x=>x.netId===1);
   const b=views[1].review.actors.find(x=>x.netId===1);
   return a&&b&&a.y<frontageActor.y-18&&a.y>4050+18&&Math.abs(a.y-b.y)<8?views:null;
 },12000);
 const sidewalkActor=sidewalk[0].review.actors.find(x=>x.netId===1);
 await evaluate(first,"document.querySelector('#arena').focus();return true");
 await request(first.base,"POST","/session/"+first.id+"/actions",
   {actions:[{type:"key",id:"keyboard",actions:[
     {type:"keyDown",value:"w"},{type:"pause",duration:450},{type:"keyUp",value:"w"}]}]});
 await sleeps(500);
 const wallViews=await Promise.all(actors.map(async({s})=>evaluate(s,nativeStats)));
 const wallOwner=wallViews[0].review.actors.find(x=>x.netId===1);
 const wallPeer=wallViews[1].review.actors.find(x=>x.netId===1);
 assert.ok(wallOwner.y>=4050+18-1,
   "original Rust Physics6 swept collision must stop the actor outside Red Lion south wall");
 assert.ok(wallOwner.y<sidewalkActor.y-4,
   "actor must reach the real walkable frontage before being stopped by the wall");
 assert.ok(Math.abs(wallOwner.x-wallPeer.x)<8 && Math.abs(wallOwner.y-wallPeer.y)<8,
   "both browsers must agree on the actual server-authoritative wall stop");
 outputTrace.physicalBuildingCollisionProven=true;
 outputTrace.redLionWall={actorNetId:1,x:wallOwner.x,y:wallOwner.y,
   minX:4240,maxX:4490,minY:3880,maxY:4050,actorRadius:18};
 await sleeps(900);
 for(const {s,actor} of actors){
   const data=await evaluate(s,nativeStats);
   assert.ok(data.review.actors.length===2 && data.tiles>=8,
     "both original actors and real 512-unit authored tile drawing");
   assert.equal(data.review.source,"replicated-original-Rust-World");
   assert.equal(data.review.ownNetId,actor.id);
   assert.ok(data.review.serverTick>0,"actual source Rust World tick");
   assert.ok(Number.isFinite(data.review.camera.x));
   if(actor.id===1)assert.ok(data.review.actors.find(a=>a.netId===1).y>=4050+18-1,
     "first player remains outside the authoritative Red Lion solid");
   else assert.ok(data.review.actors.find(a=>a.netId===2).x>0,
     "second original Rust player remains present");
   const page=(await request(s.base,"GET","/session/"+s.id+"/screenshot")).value;
   const pageBytes=Buffer.from(page,"base64");
   assert.ok(pageBytes.length>1000 && pageBytes.subarray(0,4).equals(
     Buffer.from([137,80,78,71])),"actual browser screenshot");
   const png=await evaluate(s,
     "return document.querySelector('#arena').toDataURL('image/png')");
   assert.ok(png.startsWith("data:image/png;base64,"));
   const canvasBytes=Buffer.from(png.slice(22),"base64");
   const name=s.engine+"-actor"+actor.id;
   await writeFile(join(output,name+"-page.png"),pageBytes);
   await writeFile(join(output,name+"-canvas-960x540.png"),canvasBytes);
   outputTrace.samples.push({browser:s.engine,actorNetId:actor.id,
     data,pageSHA256:sha(pageBytes),canvasSHA256:sha(canvasBytes)});
 }
 await writeFile(join(output,"world9-greyhaven-two-native.json"),
   JSON.stringify(outputTrace,null,2)+"\n");
 console.log("WORLD9_ALPHA_TWO_NATIVE_RUST_GREYHAVEN_PASS "+
   JSON.stringify({sourceSha:outputTrace.sourceSha,
     actors:outputTrace.samples.map(x=>x.actorNetId),
     final:outputTrace.samples.map(x=>x.data.review.actors),
     physicalBuildingCollisionProven:outputTrace.physicalBuildingCollisionProven,
     redLionWall:outputTrace.redLionWall,
     tiles:outputTrace.samples.map(x=>x.data.tiles),
     canvasSHA256:outputTrace.samples.map(x=>x.canvasSHA256)}));

}finally{
 for(const s of sessions){try{await request(s.base,"DELETE","/session/"+s.id)}catch{}}
 for(const child of processes){try{child.kill("SIGTERM")}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
