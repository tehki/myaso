// Graphics 3B P1 real native browser A/B for original Blender/World9 stage.
// Isolated browser compositor, NOT real four-player combat or a release gate.
// Baseline is pinned original PR #831 head, not a synthetic substitute.
import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {resolve,relative,isAbsolute,extname,join} from "node:path";
import {setTimeout as sleep} from "node:timers/promises";

const base=process.cwd();
const beforeSha="da5664b015bb1f76b1c60482b5009a6fd5fb7487";
const baseline=execFileSync("git",["show",beforeSha+":src/browser/red-lion-live-art.mjs"],{
 encoding:"utf8",maxBuffer:2e6
});
assert.match(baseline,/for\(const c of \[worldSurface,facadeSurface\]\)\{c\.width=w;c\.height=h\}/);
const current=await readFile(resolve(base,"src/browser/red-lion-live-art.mjs"),"utf8");
assert.match(current,/worldCtx\.clearRect\(0,0,w,h\)/);
const dest=resolve(process.argv[2]||"graphics3b-a232-stage-ab-evidence");
const drivers=[];
let server=null;
function mime(file){
 return extname(file)===".mjs"?"text/javascript; charset=utf-8":
  extname(file)===".html"?"text/html; charset=utf-8":
  extname(file)===".webp"?"image/webp":"application/octet-stream";
}
async function wd(b,method,path,data,ms=30000){
 const res=await fetch(b.url+path,{method,
  body:data===undefined?undefined:JSON.stringify(data),
  headers:data===undefined?undefined:{"content-type":"application/json"},
  signal:AbortSignal.timeout(ms)});
 const json=await res.json();
 if(!res.ok||json.value?.error)
  throw new Error(b.name+" "+method+" "+path+" "+JSON.stringify(json).slice(0,700));
 return json.value??json;
}
async function start(name,port){
 const chrome=name==="chrome";
 const env=chrome?process.env.CHROMEWEBDRIVER:process.env.GECKOWEBDRIVER;
 const bin=env?join(env,chrome?"chromedriver":"geckodriver"):chrome?"chromedriver":"geckodriver";
 const args=chrome?["--port="+port]:["--host","127.0.0.1","--port",String(port)];
 const proc=spawn(bin,args,{stdio:["ignore","ignore","pipe"]});
 drivers.push(proc);
 let stderr="";proc.stderr.on("data",v=>stderr=(stderr+String(v)).slice(-1000));
 for(let i=0;i<100;i++){
  if(proc.exitCode!==null)throw new Error(name+" driver failed "+stderr);
  try{if((await fetch("http://127.0.0.1:"+port+"/status",{signal:AbortSignal.timeout(400)})).ok)break}
  catch{}
  await sleep(130);
  if(i===99)throw new Error(name+" driver startup timeout "+stderr);
 }
 const b={name,url:"http://127.0.0.1:"+port};
 const capabilities=chrome?{browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900"
 ]}}:{browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
 const session=await wd(b,"POST","/session",{capabilities:{alwaysMatch:capabilities}},60000);
 assert.ok(session.sessionId);
 b.id=session.sessionId;b.version=session.capabilities?.browserVersion;
 await wd(b,"POST","/session/"+b.id+"/timeouts",{script:210000,pageLoad:60000});
 return b;
}
function browserProbe(variant,done){
 (async()=>{
  const module=await import("/"+variant+"/src/browser/red-lion-live-art.mjs");
  const art=module.createOriginalRedLionLiveArt();
  if(!await art.load())throw new Error("original art source load refused "+JSON.stringify(art.state()));
  const w=960,h=540,z=.84;
  const camera=i=>({x:4365+32*Math.sin(i*.13),y:4075+24*Math.cos(i*.17)});
  for(let i=0;i<48;i++)
   if(!art.prepare(camera(i),w,h,z))throw new Error("warm-up refused "+i);
  const costs=[];
  for(let i=0;i<120;i++){
   const started=performance.now();
   const frame=art.prepare(camera(i+48),w,h,z);
   const elapsed=performance.now()-started;
   if(!frame)throw new Error("frame refused "+i);
   costs.push(elapsed);
   if(i%12===0)await new Promise(resolve=>setTimeout(resolve,0));
  }
  const frame=art.prepare({x:4365,y:4075},w,h,z);
  if(!frame)throw new Error("pixel proof frame failed");
  const canvas=document.getElementById("benchmark-canvas");
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(frame.world,0,0);
  ctx.drawImage(frame.facade,0,0);
  const rgba=ctx.getImageData(0,0,w,h).data;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",rgba)),
   n=>n.toString(16).padStart(2,"0")).join("");
  const sorted=[...costs].sort((a,b)=>a-b);
  const percentile=p=>sorted[Math.ceil(p*sorted.length)-1];
  return {source:variant,p50Ms:percentile(.5),p95Ms:percentile(.95),
   p99Ms:percentile(.99),meanMs:costs.reduce((a,b)=>a+b,0)/costs.length,
   pixelSha256:hash,frames:costs.length,warmup:48,
   frameScope:"createOriginalRedLionLiveArt.prepare only; no gameplay/actors"};
 })().then(v=>done(v)).catch(e=>done({error:String(e.stack||e)}));
}
const code="("+browserProbe.toString()+")(arguments[0],arguments[arguments.length-1]);";
try{
 await mkdir(dest,{recursive:true});
 server=createServer(async(req,res)=>{
  try{
   const request=new URL(req.url,"http://localhost").pathname;
   const matches=/^\/(baseline|candidate)(\/.*)$/.exec(request);
   if(request==="/benchmark.html"){
    res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><canvas id="benchmark-canvas"></canvas></body></html>');
    return;
   }
   if(!matches){res.writeHead(404);res.end();return}
   if(matches[1]==="baseline"&&matches[2]==="/src/browser/red-lion-live-art.mjs"){
    res.writeHead(200,{"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});
    res.end(baseline);return;
   }
   const absolute=resolve(base,"."+decodeURIComponent(matches[2]));
   const rel=relative(base,absolute);
   if(rel.startsWith("..")||isAbsolute(rel)){res.writeHead(403);res.end();return}
   const bytes=await readFile(absolute);
   res.writeHead(200,{"content-type":mime(absolute),"cache-control":"no-store"});
   res.end(bytes);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise((yes,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",yes)});
 const page="http://127.0.0.1:"+server.address().port+"/benchmark.html";
 const results={scope:"genuine native browser original World9/3C+3B A2.32 staging only",
  beforeSha,headSha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
  immutableAssetSources:true,neverClaimFourPlayers:true,results:[]};
 for(const [name,port] of [["chrome",9919],["firefox",9920]]){
  const b=await start(name,port);
  try{
   await wd(b,"POST","/session/"+b.id+"/url",{url:page},60000);
   const rows=[];
   for(const [index,source] of ["baseline","candidate","candidate","baseline"].entries()){
    const reading=await wd(b,"POST","/session/"+b.id+"/execute/async",
     {script:code,args:[source]},210000);
    assert.equal(reading.error,undefined,name+" "+source+" "+reading.error);
    assert.equal(reading.frames,120);
    assert.ok(reading.p50Ms>=0&&reading.p95Ms>=reading.p50Ms);
    rows.push({order:index,...reading});
    console.log("GRAPHICS3B_NATIVE_STAGE_AB_SAMPLE "+JSON.stringify({browser:name,order:index,source,p50Ms:reading.p50Ms,p95Ms:reading.p95Ms,pixelSha256:reading.pixelSha256}));
   }
   // Verify the *real exact browser pixels* remain the same between
   // original and optimized stages. No screenshot spoofing or fake sprites.
   assert.equal(new Set(rows.map(x=>x.pixelSha256)).size,1,
    name+" source compositor RGB/RGBA parity failed");
   const average=(kind,key)=>rows.filter(x=>x.source===kind)
    .reduce((sum,x)=>sum+x[key],0)/2;
   results.results.push({browser:name,version:b.version,ABBA:true,
    pixelEqual:true,pixelSha256:rows[0].pixelSha256,
    originalP50Ms:average("baseline","p50Ms"),
    candidateP50Ms:average("candidate","p50Ms"),
    originalP95Ms:average("baseline","p95Ms"),
    candidateP95Ms:average("candidate","p95Ms"),trials:rows});
  }finally{
   if(b.id)await wd(b,"DELETE","/session/"+b.id).catch(()=>{});
  }
 }
 assert.equal(results.results.length,2);
 await writeFile(join(dest,"original-red-lion-world3c-stage-ab.json"),
  JSON.stringify(results,null,2)+"\n");
 console.log("GRAPHICS3B_NATIVE_STAGE_AB_PASS "+JSON.stringify(results.results.map(x=>({
  browser:x.browser,originalP50Ms:x.originalP50Ms,candidateP50Ms:x.candidateP50Ms,
  originalP95Ms:x.originalP95Ms,candidateP95Ms:x.candidateP95Ms,pixelEqual:x.pixelEqual
 }))));
}catch(error){
 console.error("GRAPHICS3B_NATIVE_STAGE_AB_FAIL "+String(error.stack||error));
 process.exitCode=1;
}finally{
 for(const proc of drivers)if(proc.exitCode===null)proc.kill("SIGTERM");
 if(server){server.closeAllConnections?.();await new Promise(done=>server.close(done))}
}
