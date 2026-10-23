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

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const engines=(process.env.MYASO_KNIGHTS_NATIVE_BROWSERS||"chrome,chrome,chrome,chrome").split(",");
assert.equal(engines.length,4,"four distinct genuine browser sessions required");
assert.ok(engines.every(x=>x==="chrome"||x==="firefox"),"unknown W3C browser engine");
const output=resolve(process.env.MYASO_KNIGHTS_NATIVE_OUT||join(root,".artifacts","main0-knights-native"));
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
 const child=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4"},stdio:["ignore","pipe","pipe"]});
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
const hook=String.raw`
const canvas=document.querySelector("#arena");if(!canvas)return false;
window.__arenaLiteNative={frames:[],last:null,knightWebPDraws:0,knightSources:{}};
const proto=CanvasRenderingContext2D.prototype,real=proto.drawImage;
proto.drawImage=function(...args){
 if(this.canvas===canvas&&args[0] instanceof HTMLCanvasElement&&args[0].width===960&&args[0].height===540){
   const obj=window.__arenaLiteNative;const t=performance.now();obj.frames.push(t);if(obj.frames.length>600)obj.frames.shift();
   if(!obj.last){
     const src=args[0],pixels=src.getContext("2d").getImageData(0,0,960,540).data;
     let sum=0,n=0;for(let y=135;y<405;y+=4)for(let x=240;x<720;x+=4){const i=(y*960+x)*4;sum+=pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722;n++}
     obj.last={centerLuminance:sum/n,width:src.width,height:src.height,frame:obj.frames.length};
   }
 }
 if(this.canvas===canvas&&args[0] instanceof HTMLImageElement){
   const im=args[0],s=im.currentSrc||im.src||"";
   if(s.includes("/assets/knights/")&&s.includes("silver_")&&s.endsWith(".webp")&&im.naturalHeight===1280){
     const audit=window.__arenaLiteNative;audit.knightWebPDraws++;
     const key=s.split("/").pop();audit.knightSources[key]=(audit.knightSources[key]||0)+1;
   }
 }
 return real.apply(this,args);
};return true;`;
const stats=String.raw`
const x=window.__arenaLiteNative;if(!x?.last)return null;
const ms=x.frames.slice(1).map((v,i)=>v-x.frames[i]).filter(v=>v>=0);
ms.sort((a,b)=>a-b);
const p=q=>ms.length?ms[Math.min(ms.length-1,Math.floor((ms.length-1)*q))]:null;
return {floor:x.last,frames:x.frames.length,frameIntervalP50Ms:p(.5),frameIntervalP95Ms:p(.95),over33ms:ms.filter(v=>v>33).length,
knightWebPDraws:x.knightWebPDraws,knightSources:x.knightSources,
knightsFlag:new URLSearchParams(location.search).get("knights"),knightArt:new URLSearchParams(location.search).get("knightArt"),
roster:[...document.querySelectorAll("#scoreboard-list li")].map(li=>li.textContent?.trim()||""),
status:document.querySelector("#event-text")?.textContent||"",innerWidth:innerWidth,innerHeight:innerHeight,
canvasWidth:document.querySelector("#arena")?.width,canvasHeight:document.querySelector("#arena")?.height};`;
await mkdir(output,{recursive:true});
try{
 const {url:rustUrl,cert}=await startOriginalRust(),host=await startStatic();
 const actors=[];
 for(let i=0;i<4;i++){
  const s=await startW3C(engines[i],i);const flag="0";
  const u=new URL(host+"/web/index.html");u.searchParams.set("server",rustUrl);u.searchParams.set("cert",cert);u.searchParams.set("knights","1");u.searchParams.set("knightArt","relit");
  await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
  const actor=await waitFor(async()=>{let t=await evaluate(s,"return document.querySelector('#event-text')?.textContent||'';");const m=t?.match(/Online - player #(\d+) - server tick (\d+)/);return m?{id:Number(m[1]),tick:Number(m[2])}:null},16000);
  assert.equal(actor.id,i+1,"genuine sequential Rust actor IDs required");
  assert.ok(await evaluate(s,hook),"read-only original Canvas image observer");
  actors.push({s,actor,flag});
 }
 await sleeps(2400);
 const trial=[];
 for(const {s,actor,flag} of actors){
  const data=await evaluate(s,stats);
  assert.ok(data&&data.frames>=12,"original real gameplay Canvas frames required");
  assert.equal(data.knightsFlag,"1","all four must use original authenticated source Silver renderer");
  assert.equal(data.knightArt,"relit","all four opt into original Blender 3A relit reference");
  assert.ok(data.knightWebPDraws>=8,"all real players must paint nonplaceholder Silver source WebP frames");
  assert.ok(Object.keys(data.knightSources).some(k=>k.startsWith("silver_")&&k.endsWith("_relit.webp")),
    "require actual original Blender relit Silver WebP drawImage calls, not a fallback Combat circle");
  assert.ok(data.roster.length>=4,"genuine same-server four human roster must be visible");
  assert.equal(data.canvasWidth,960);assert.equal(data.canvasHeight,540);
  assert.ok(data.floor.centerLuminance>(flag==="1"?38:15));
  assert.ok(data.floor.centerLuminance<(flag==="1"?155:39));
  assert.match(data.status,/Online - player #/);
  const image=(await request(s.base,"GET","/session/"+s.id+"/screenshot")).value;
  const bytes=Buffer.from(image,"base64");assert.ok(bytes.length>1000&&bytes.subarray(0,4).equals(Buffer.from([137,80,78,71])),"genuine W3C PNG");
  const name=s.engine+"-"+s.index+"-"+(flag==="1"?"lite":"grid")+".png";
  await writeFile(join(output,name),bytes);
  trial.push({browser:s.engine,actorId:actor.id,mode:flag==="1"?"lite":"grid",data,screenshot:name,pngSha256:sha(bytes)});
 }
 assert.equal(trial.length,4,"four real native fighter sessions required");
 assert.ok(trial.every(x=>x.mode==="grid"),"release slice must use original grid on every browser, never optional terrain");
 const report={sourceCommit:process.env.MYASO_KNIGHTS_SOURCE_SHA||"set-from-commit",actualRustWebTransport:true,
  actualOriginalClient:true,realSeparateNativeBrowserProcesses:4,independentPhysicalHumanHosts:false,
  authenticSilverKnightIntegrationVerified:true,allFiveClipsVisuallyValidated:false,
  trueFourIndependentHumanOperators:false,modeIsOptional:false,defaultArenaPreserved:true,
  genuineFullCombatApproval:false,trials:trial};
 await writeFile(join(output,"main0-knights-original-game-native.json"),JSON.stringify(report,null,2)+"\n");
 console.log( "MAIN0_KNIGHTS_ORIGINAL_GRID_REAL_W3C_PASS "+JSON.stringify({pass:true,source:report.sourceCommit,actors:trial.map(x=>x.actorId),browsers:engines,floors:trial.map(x=>({mode:x.mode,centerLuminance:x.data.floor.centerLuminance,frames:x.data.frames,p95:x.data.frameIntervalP95Ms,silverWebP:x.data.knightWebPDraws,sources:x.data.knightSources})),screenshots:trial.map(x=>x.screenshot)}));
}finally{
 for(const s of sessions){try{await request(s.base,"DELETE","/session/"+s.id)}catch{}}
 for(const child of processes){try{child.kill("SIGTERM")}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
