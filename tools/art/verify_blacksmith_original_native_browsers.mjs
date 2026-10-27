// P1 original Blender Blacksmith art rendered in genuine native Chrome/Firefox.
// Localhost review only: never connects to game, modifies snapshots or authorizes portals.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {setTimeout as delay} from "node:timers/promises";

const source=resolve(".artifacts/graphics3b-blacksmith");
const dest=resolve(".artifacts/graphics3b-blacksmith-native-review");
const sha=b=>createHash("sha256").update(b).digest("hex");
const sessions=[],processes=[],original=new Map();
let server=null;
function png(b){
  assert.ok(Buffer.isBuffer(b)&&b.length>1000);
  assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(b.readUInt32BE(16),640);
  assert.equal(b.readUInt32BE(20),640);
}
async function load(){
  const r=JSON.parse(await readFile(join(source,"greyhaven-blacksmith-source-report.json"),"utf8"));
  assert.equal(r.kind,"graphics3b-original-blacksmith-p1-review");
  assert.equal(r.realImportedModuleCount,15);
  assert.ok(r.ownerRequestedBlenderGeometryFix?.authenticDoorMeshCount>0);
  assert.ok(r.ownerRequestedBlenderGeometryFix?.authenticWindowShutterMeshCount>0);
  assert.ok(r.ownerRequestedBlenderGeometryFix?.realGables?.doubleSidedTriangleClosure);
  assert.ok(r.ownerRequestedBlenderGeometryFix?.actualCollisionFreeGeometry?.noForgeRoofIntersection);
  assert.ok(r.ownerRequestedBlenderGeometryFix?.actualCollisionFreeGeometry?.noCreatorBoxToolIntersection);
  assert.equal(r.sourceOnly,true); assert.equal(r.placedInRuntime,false);
  assert.equal(r.productionAuthorized,false);
  for(const e of r.captured){
    assert.ok(["day","dusk"].includes(e.mood));
    assert.equal(e.name,"greyhaven-blacksmith-"+e.mood+".png");
    const b=await readFile(join(source,e.name));
    png(b);assert.equal(sha(b),e.sha256);
    original.set(e.mood,{bytes:b,sha:e.sha256});
  }
  assert.equal(original.size,2);
  assert.notEqual(original.get("day").sha,original.get("dusk").sha);
}
function html(mood){
  return '<!doctype html><html><head><meta charset="utf-8"><title>Original Blacksmith art only</title>'+
  '<style>html,body{background:#272322;color:#eee0c9;font:16px sans-serif;margin:0}main{padding:14px}canvas{display:block}</style></head>'+
  '<body><main><h3>Genuine original Blender Blacksmith: '+mood+'</h3>'+
  '<canvas id="original" width="640" height="640"></canvas><p id="status">loading</p></main>'+
  '<script>const c=document.querySelector("#original"),ctx=c.getContext("2d",{willReadFrequently:true});'+
  'const im=new Image();im.onload=()=>{if(im.naturalWidth!==640||im.naturalHeight!==640){window.proof={ok:false,error:"size"};return;}'+
  'ctx.clearRect(0,0,640,640);ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,640,640).data;'+
  'let visible=0;for(let i=3;i<data.length;i+=4)if(data[i]>0)visible++;'+
  'window.proof={ok:visible>2500,visible,mood:"'+mood+'",sourceBacked:true,gameIntegration:false};'+
  'document.querySelector("#status").textContent="Authentic Blender image";};'+
  'im.onerror=()=>window.proof={ok:false,error:"image"};im.src="/'+mood+'.png";</script></body></html>';
}
async function serve(){
  server=createServer((req,res)=>{
    const u=new URL(req.url,"http://127.0.0.1");
    if(u.pathname==="/"){
      const mood=u.searchParams.get("mood");
      if(!original.has(mood)){res.writeHead(403);res.end("Artist opt-in required");return;}
      res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});
      res.end(html(mood));return;
    }
    if(u.pathname==="/day.png"||u.pathname==="/dusk.png"){
      const mood=u.pathname.slice(1,-4);
      res.writeHead(200,{"content-type":"image/png","cache-control":"no-store"});
      res.end(original.get(mood).bytes);return;
    }
    res.writeHead(404);res.end("Not Found");
  });
  await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
  return "http://127.0.0.1:"+server.address().port;
}
async function port(){
  const s=createServer();await new Promise(ok=>s.listen(0,"127.0.0.1",ok));
  const p=s.address().port;await new Promise(ok=>s.close(ok));return p;
}
async function wd(b,method,path,data,ms=20000){
  const response=await fetch(b.url+path,{method,
    headers:data===undefined?undefined:{"content-type":"application/json"},
    body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(ms)});
  const j=await response.json();
  if(!response.ok||j.value?.error)
    throw Error(b.name+" WebDriver error "+JSON.stringify(j).slice(0,500));
  return j.value??j;
}
async function js(b,code){
  return wd(b,"POST","/session/"+b.sid+"/execute/sync",{script:code,args:[]});
}
async function start(name){
  const chrome=name==="chrome",p=await port();
  const child=spawn(chrome?"chromedriver":"geckodriver",
    chrome?["--port="+p]:["--host","127.0.0.1","--port",String(p)],
    {stdio:["ignore","ignore","pipe"]});
  processes.push(child);
  let tail="";child.stderr.on("data",x=>tail=(tail+String(x)).slice(-1300));
  const b={name,url:"http://127.0.0.1:"+p};
  let ready=false;
  for(let i=0;i<110;i++){
    if(child.exitCode!==null)throw Error(name+" driver stopped: "+tail);
    try{const response=await fetch(b.url+"/status",{signal:AbortSignal.timeout(500)});
      if(response.ok){ready=true;break;}}catch{}
    await delay(120);
  }
  if(!ready)throw Error(name+" driver unavailable: "+tail);
  const opts=chrome?
    {browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1000,900"]}}:
    {browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
  const s=await wd(b,"POST","/session",{capabilities:{alwaysMatch:opts}},60000);
  b.sid=s.sessionId;b.version=s.capabilities?.browserVersion;
  assert.ok(b.sid);sessions.push(b);
  await wd(b,"POST","/session/"+b.sid+"/timeouts",{script:15000,pageLoad:60000});
  return b;
}
async function proof(b){
  let last;
  for(let i=0;i<160;i++){
    last=await js(b,"return window.proof || {ok:false}");
    if(last?.ok)return last;
    await delay(120);
  }
  throw Error("Original Blender browser pixel acceptance failed: "+JSON.stringify(last));
}
async function capture(b,mood){
  const p=await proof(b);
  assert.equal(p.mood,mood);assert.equal(p.gameIntegration,false);
  assert.equal(p.sourceBacked,true);assert.ok(p.visible>2500);
  const url=await js(b,"return document.querySelector('#original').toDataURL('image/png')");
  assert.match(url,/^data:image\/png;base64,/);
  const canvas=Buffer.from(url.split(",")[1],"base64");
  png(canvas);
  const page=Buffer.from(await wd(b,"GET","/session/"+b.sid+"/screenshot"),"base64");
  assert.equal(page.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  const cf=b.name+"-"+mood+"-original-blender-canvas.png";
  const pf=b.name+"-"+mood+"-w3c-page.png";
  await writeFile(join(dest,cf),canvas);await writeFile(join(dest,pf),page);
  return {browser:b.name,version:b.version,mood,sourceSha256:original.get(mood).sha,
    canvasSha256:sha(canvas),pageSha256:sha(page),visiblePixels:p.visible,
    canvasFile:cf,pageFile:pf,gameRuntime:false};
}
let error=null;
try{
  await load();await mkdir(dest,{recursive:true});
  const origin=await serve(),results=[];
  for(const name of ["chrome","firefox"]){
    const b=await start(name),shots=[];
    for(const mood of ["day","dusk"]){
      await wd(b,"POST","/session/"+b.sid+"/url",{url:origin+"/?mood="+mood},60000);
      shots.push(await capture(b,mood));
    }
    assert.notEqual(shots[0].canvasSha256,shots[1].canvasSha256);
    results.push(...shots);
    console.log("GRAPHICS3B_BLACKSMITH_GENUINE_NATIVE_BROWSER_PASS "+name+" "+b.version);
  }
  await writeFile(join(dest,"genuine-original-blacksmith-browser-evidence.json"),
    JSON.stringify({sourceOnly:true,notWorld9Integration:true,realW3CChromeFirefox:true,
      serverAndCombatUnchanged:true,results},null,2)+"\n");
  console.log("GRAPHICS3B_BLACKSMITH_ORIGINAL_BLENDER_NATIVE_CHROME_FIREFOX_PASS");
}catch(e){error=e;console.error("GRAPHICS3B_BLACKSMITH_NATIVE_BROWSER_FAIL "+String(e.stack||e))}
finally{
  for(const b of sessions)try{await wd(b,"DELETE","/session/"+b.sid,undefined,4000)}catch{}
  for(const p of processes)try{p.kill("SIGTERM")}catch{}
  await delay(300);
  for(const p of processes)try{if(p.exitCode===null)p.kill("SIGKILL")}catch{}
  if(server)await Promise.race([new Promise(ok=>server.close(ok)),delay(1000)]);
}
if(error)process.exitCode=1;
