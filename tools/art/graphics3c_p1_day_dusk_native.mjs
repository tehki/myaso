// Graphics 3C P1: original World9 Canvas renderer in real native Chrome/Firefox.
// Browser screenshots are real art-layer evidence, NOT authenticated gameplay.
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,join,extname,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as delay} from "node:timers/promises";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.env.GRAPHICS3C_P1_NATIVE_OUT||join(root,"artifacts/graphics3c-p1-greyhaven-native"));
const sha=execFileSync("git",["-C",root,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
const digest=b=>createHash("sha256").update(b).digest("hex");
const spots=[{id:"red-lion",camera:{x:4365,y:4075}},{id:"blacksmith",camera:{x:3800,y:3970}}];
const browsers=["chrome","firefox"];
const children=[],sessions=[];
let http;
async function freePort(){const s=createServer();await new Promise(ok=>s.listen(0,"127.0.0.1",ok));const port=s.address().port;await new Promise(ok=>s.close(ok));return port;}
async function w3c(base,method,path,body,timeout=40000){
 const res=await fetch(base+path,{method,headers:body===undefined?undefined:{"content-type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok||data.value?.error)throw Error(method+" "+path+" returned "+res.status+": "+JSON.stringify(data).slice(0,250));
 return data.value??data;
}
async function driver(engine){
 const port=await freePort();
 const exe=engine==="chrome"?"chromedriver":"geckodriver";
 const args=engine==="chrome"?["--port="+port]:["--host","127.0.0.1","--port",String(port)];
 const child=spawn(exe,args,{stdio:"ignore"});children.push(child);
 const base="http://127.0.0.1:"+port;
 let ready=false;
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(exe+" exited "+child.exitCode);
  try{const status=await w3c(base,"GET","/status",undefined,1000);if(status.ready){ready=true;break;}}catch{}
  await delay(100);
 }
 assert.ok(ready,"real "+exe+" W3C driver must be ready");
 const options=engine==="chrome"?
  {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,800"]}}:
  {browserName:"firefox","moz:firefoxOptions":{args:["-headless"],prefs:{"layout.frame_rate":60}}};
 const created=await w3c(base,"POST","/session",{capabilities:{alwaysMatch:options}},65000);
 assert.ok(created.sessionId,"genuine W3C browser session required");
 const session={base,id:created.sessionId,engine,version:created.capabilities?.browserVersion||"unreported"};
 sessions.push(session);return session;
}
function html(){
 return `<!doctype html><meta charset="utf-8"><title>Greyhaven P1 source renderer</title>
 <canvas id="arena" width="960" height="540" style="display:block;max-width:none"></canvas>
 <script type="module">
 import {createAuthoredWorldRenderer} from "/src/browser/authored-world-renderer.mjs";
 import {MAP_IDS} from "/src/world/authored-maps.mjs";
 import {ARENA_VIEW_ZOOM} from "/src/browser/arena-viewport.mjs";
 const canvas=document.querySelector("#arena"),ctx=canvas.getContext("2d",{alpha:false,willReadFrequently:true});
 window.greyhavenP1Source={render(mode,camera){
  if(!["day","dusk"].includes(mode)||![camera?.x,camera?.y].every(Number.isFinite))
   throw Error("explicit nonrelease Greyhaven visual mode and authored camera required");
  // Match the real renderer's default incremental tile-build budget.
  const world=createAuthoredWorldRenderer({greyhavenTimeOfDay:mode,cacheCap:24,buildLimit:3});
  const draws=[],createdPerDraw=[];
  for(let i=0;i<8;i++){
   const before=performance.now();
   ctx.clearRect(0,0,960,540);
   ctx.save();ctx.translate(480,270);ctx.scale(ARENA_VIEW_ZOOM,ARENA_VIEW_ZOOM);ctx.translate(-480,-270);
   world.draw(ctx,MAP_IDS.overworld,camera,960,540,1);ctx.restore();
   draws.push(performance.now()-before);
   createdPerDraw.push(world.stats.created);
  }
  return {canvas:canvas.toDataURL("image/png"),mode,camera,
   cacheTiles:world.stats.cached,tileSize:512,zoom:ARENA_VIEW_ZOOM,
   sourceWorldMap:MAP_IDS.overworld,sourceReplacements:world.replacedBuildingIds,
   buildLimit:3,createdPerDraw,totalDraws:draws.length,drawSamplesMs:draws,visualOnly:true,
   actualRust:false,actualHumans:0,gpuPresentMeasured:false};
 }};window.greyhavenP1Ready=true;
 </script>`;
}
async function staticHost(){
 http=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  if(pathname==="/"){res.writeHead(200,{"content-type":"text/html; charset=utf-8"});res.end(html());return;}
  if(!pathname.startsWith("/src/"))throw Error("only original source modules allowed");
  const absolute=resolve(root,"."+pathname);
  if(!absolute.startsWith(root+sep)||![".mjs",".js"].includes(extname(absolute)))throw Error("invalid source path");
  const bytes=await readFile(absolute);
  res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(bytes);
 }catch{res.writeHead(404);res.end("missing original source");}});
 await new Promise(ok=>http.listen(0,"127.0.0.1",ok));
 return "http://127.0.0.1:"+http.address().port;
}
function image(data){assert.match(data,/^data:image\/png;base64,/);const b=Buffer.from(data.split(",")[1],"base64");
 assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(b.readUInt32BE(16),960);assert.equal(b.readUInt32BE(20),540);return b;}
function percentile(values,p){const a=[...values].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)];}
await mkdir(out,{recursive:true});
const report={exactSourceSha:sha,purpose:"source-authored P1 daytime/dusk World9 Canvas-only Chrome/Firefox visual reviewer",
 browsers:[],realWorld9Map:true,realSilverActors:0,actualRustWebTransport:false,
 actualCombatApproval:false,gpuPresentMeasured:false,independentHumanHosts:false};
try{
 const host=await staticHost();
 for(const engine of browsers){
  const s=await driver(engine);
  await w3c(s.base,"POST","/session/"+s.id+"/url",{url:host},60000);
  let ready=false;
  for(let n=0;n<100;n++){
   try{ready=await w3c(s.base,"POST","/session/"+s.id+"/execute/sync",{
     script:"return window.greyhavenP1Ready===true;",args:[]});if(ready)break;}catch{}
   await delay(150);
  }
  assert.ok(ready,"genuine "+engine+" must load original authored-world-renderer module");
  const results=[];
  for(const spot of spots) {
   const record={place:spot.id,camera:spot.camera,variants:[]};
   for(const mode of ["day","dusk"]){
    const v=await w3c(s.base,"POST","/session/"+s.id+"/execute/sync",{
     script:"return window.greyhavenP1Source.render(arguments[0],arguments[1]);",
     args:[mode,spot.camera]},60000);
    assert.equal(v.mode,mode);assert.equal(v.zoom,.84);
    assert.equal(v.actualRust,false);assert.equal(v.actualHumans,0);
    assert.ok(v.cacheTiles>=1&&v.cacheTiles<=24);
    assert.deepEqual(v.sourceReplacements,[]);
    assert.equal(v.totalDraws,8);
    assert.equal(v.buildLimit,3,"native reviewer must match the game's incremental tile-build budget");
    assert.deepEqual(v.createdPerDraw.slice(0,2),[3,3],"six visible tiles must build in two bounded batches");
    assert.ok(v.createdPerDraw.slice(2).every(x=>x===0),"warm draws must not create additional tiles");
    assert.ok(v.drawSamplesMs.every(x=>Number.isFinite(x)&&x>=0));
    const warm=v.drawSamplesMs.slice(2);
    assert.equal(warm.length,6);
    const bytes=image(v.canvas),name=engine+"-"+spot.id+"-"+mode+".png";
    await writeFile(join(out,name),bytes);
    record.variants.push({mode,filename:name,bytes:bytes.length,sha256:digest(bytes),
     cacheTiles:v.cacheTiles,buildLimit:v.buildLimit,createdPerDraw:v.createdPerDraw,
     coldBatch1Ms:v.drawSamplesMs[0],coldBatch2Ms:v.drawSamplesMs[1],
     warmDrawP50Ms:percentile(warm,.5),warmDrawP95Ms:percentile(warm,.95)});
   }
   assert.notEqual(record.variants[0].sha256,record.variants[1].sha256,
     "actual original World renderer must produce different day and dusk images");
   results.push(record);
  }
  report.browsers.push({engine,version:s.version,results});
  console.log("GRAPHICS3C_P1_NATIVE_BROWSER_PASS "+JSON.stringify({
   source:sha,engine,version:s.version,results}));
 }
 assert.equal(report.browsers.length,2,"genuine Chrome+Firefox required");
 await writeFile(join(out,"original-source-native-report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("GRAPHICS3C_P1_DAY_DUSK_SOURCE_SCREENSHOTS_PASS "+JSON.stringify({
  sha,browsers:report.browsers.map(b=>b.engine),locations:spots.map(s=>s.id),
  images:report.browsers.flatMap(b=>b.results.flatMap(v=>v.variants.map(i=>i.filename))),
  realRustWebTransport:false,actualCombatApproval:false,gpuPresentMeasured:false}));
}finally{
 for(const s of sessions){try{await w3c(s.base,"DELETE","/session/"+s.id,undefined,12000);}catch{}}
 for(const c of children){try{c.kill("SIGTERM");}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
