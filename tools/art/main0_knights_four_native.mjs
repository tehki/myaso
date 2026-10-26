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
assert.ok([2,4].includes(engines.length),"only 2 or 4 authentic original W3C browser sessions accepted");
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
window.__arenaLiteNative={frames:[],drawDurationMs:[],last:null,knightWebPDraws:0,knightSources:{}};
const proto=CanvasRenderingContext2D.prototype,real=proto.drawImage;
proto.drawImage=function(...args){
 const isFloorBlit=this.canvas===canvas&&args[0] instanceof HTMLCanvasElement&&args[0].width===960&&args[0].height===540;
 const floorStartMs=isFloorBlit?performance.now():null;
 if(isFloorBlit){
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
 const originalResult=real.apply(this,args);
 if(isFloorBlit){
   const times=window.__arenaLiteNative.drawDurationMs;
   times.push(performance.now()-floorStartMs);
   if(times.length>600)times.shift();
 }
 return originalResult;
};return true;`;
const stats=String.raw`
const x=window.__arenaLiteNative;if(!x?.last)return null;
const ms=x.frames.slice(1).map((v,i)=>v-x.frames[i]).filter(v=>v>=0);
ms.sort((a,b)=>a-b);
const p=(sorted,q)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))]:null;
const drawMs=[...x.drawDurationMs].sort((a,b)=>a-b);
return {floor:x.last,frames:x.frames.length,frameIntervalP50Ms:p(ms,.5),frameIntervalP95Ms:p(ms,.95),over33ms:ms.filter(v=>v>33).length,
 floorBlitDurationP50Ms:p(drawMs,.5),floorBlitDurationP95Ms:p(drawMs,.95),floorBlitSampleCount:drawMs.length,
knightWebPDraws:x.knightWebPDraws,knightSources:x.knightSources,
knightsFlag:new URLSearchParams(location.search).get("knights"),knightArt:new URLSearchParams(location.search).get("knightArt"),
roster:[...document.querySelectorAll("#scoreboard-list li")].map(li=>li.textContent?.trim()||""),
status:document.querySelector("#event-text")?.textContent||"",innerWidth:innerWidth,innerHeight:innerHeight,
canvasWidth:document.querySelector("#arena")?.width,canvasHeight:document.querySelector("#arena")?.height,diagnosticsText:document.querySelector("#network-diagnostics")?.textContent||""};`;
await mkdir(output,{recursive:true});
try{
 const {url:rustUrl,cert}=await startOriginalRust(),host=await startStatic();
 const actors=[];
 for(let i=0;i<engines.length;i++){
  const s=await startW3C(engines[i],i);const flag="0";
  const u=new URL(host+"/web/index.html");u.searchParams.set("server",rustUrl);u.searchParams.set("cert",cert);u.searchParams.set("knights","1");u.searchParams.set("knightArt","relit");u.searchParams.set("netstats","1");
  await request(s.base,"POST","/session/"+s.id+"/url",{url:u.toString()},45000);
  const actor=await waitFor(async()=>{let t=await evaluate(s,"return document.querySelector('#event-text')?.textContent||'';");const m=t?.match(/Online - player #(\d+) - server tick (\d+)/);return m?{id:Number(m[1]),tick:Number(m[2])}:null},16000);
  assert.equal(actor.id,i+1,"genuine sequential Rust actor IDs required");
  assert.ok(await evaluate(s,hook),"read-only original Canvas image observer");
  actors.push({s,actor,flag});
 }
 // Real W3C keyboard input, never document.dispatchEvent or fabricated
 // World positions. Verify one authenticated Silver fighter actually paints
 // an original walk/sprint WebP, not just the idle atlas.
 const motionSession=actors[0].s;
 assert.equal(await evaluate(motionSession,
   "const canvas=document.querySelector('#arena');canvas.focus();return document.activeElement===canvas;"),
   true,"original Canvas must own focus before real keyboard movement");
 const motionActionPath="/session/"+motionSession.id+"/actions";
 const motionSource={type:"key",id:"graphics3c-authentic-movement",actions:[{type:"keyDown",value:"d"}]};
 await request(motionSession.base,"POST",motionActionPath,{actions:[motionSource]});
 let genuineMotionSource;
 try{
  genuineMotionSource=await waitFor(async()=>{
   const data=await evaluate(motionSession,
    "const x=window.__arenaLiteNative?.knightSources||{};return {walk:x['silver_walk_relit.webp']||0,sprint:x['silver_sprint_relit.webp']||0};");
   return data&&data.walk+data.sprint>=8?data:null;
  },4500);
 }finally{
  await request(motionSession.base,"POST",motionActionPath,{
   actions:[{type:"key",id:"graphics3c-authentic-movement",actions:[{type:"keyUp",value:"d"}]}]
  });
 }
 assert.ok(genuineMotionSource.walk+genuineMotionSource.sprint>=8,
   "genuine native KeyD must cause a source-authentic Silver locomotion WebP draw");
 // An independent real W3C Space gesture must draw Blender-source Jump,
 // not a fabricated DOM event or synthetic sprite/raster sample. Give the
 // original authoritative server time to leave the locomotion state first.
 await sleeps(500);
 const jumpBefore=await evaluate(motionSession,
   "return window.__arenaLiteNative?.knightSources?.['silver_jump_relit.webp']||0;");
 assert.ok(Number.isInteger(jumpBefore)&&jumpBefore>=0);
 await request(motionSession.base,"POST",motionActionPath,{
  actions:[{type:"key",id:"graphics3c-authentic-jump",actions:[
   {type:"keyDown",value:" "},{type:"pause",duration:150},{type:"keyUp",value:" "}
  ]}]
 });
 const jumpAfter=await waitFor(async()=>{
  const draws=await evaluate(motionSession,
   "return window.__arenaLiteNative?.knightSources?.['silver_jump_relit.webp']||0;");
  return Number.isInteger(draws)&&draws-jumpBefore>=3?draws:null;
 },4500);
 const genuineJumpSource={browser:motionSession.engine,actorId:actors[0].actor.id,
  key:"Space",before:jumpBefore,after:jumpAfter,draws:jumpAfter-jumpBefore};
 assert.ok(genuineJumpSource.draws>=3,
   "real native Space must paint original Silver Jump source WebP frames");
 // Original first-party negative wheel is Roll (positive wheel is guard).
 // Use a real W3C wheel input targeted at the visible original Canvas;
 // do not synthesize WheelEvent, force fighter action or paint fake art.
 await sleeps(2400);
 const wheelPoint=await evaluate(motionSession,String.raw`
const canvas=document.querySelector('#arena'),r=canvas.getBoundingClientRect();
const left=Math.max(0,r.left),top=Math.max(0,r.top);
const right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
if(!canvas||right-left<20||bottom-top<20)return null;
return {x:Math.floor((left+right)/2),y:Math.floor((top+bottom)/2)};
`);
 assert.ok(wheelPoint&&Number.isInteger(wheelPoint.x)&&Number.isInteger(wheelPoint.y),
   "real original Canvas must be visible for native W3C Roll wheel input");
 const rollBefore=await evaluate(motionSession,
   "return window.__arenaLiteNative?.knightSources?.['silver_roll.webp']||0;");
 assert.ok(Number.isInteger(rollBefore)&&rollBefore>=0);
 await request(motionSession.base,"POST",motionActionPath,{actions:[{
  type:"wheel",id:"graphics3c-authentic-roll",actions:[{
   type:"scroll",origin:"viewport",x:wheelPoint.x,y:wheelPoint.y,
   deltaX:0,deltaY:-120,duration:0
  }]
 }]});
 const rollAfter=await waitFor(async()=>{
  const draws=await evaluate(motionSession,
   "return window.__arenaLiteNative?.knightSources?.['silver_roll.webp']||0;");
  return Number.isInteger(draws)&&draws-rollBefore>=3?draws:null;
 },4500);
 const genuineRollSource={browser:motionSession.engine,actorId:actors[0].actor.id,
  wheelDeltaY:-120,atlas:"silver_roll.webp",
  before:rollBefore,after:rollAfter,draws:rollAfter-rollBefore};
 assert.ok(genuineRollSource.draws>=3,
   "native negative wheel must render original Silver Roll source atlas");
 await sleeps(500);
 const trial=[];
 for(const {s,actor,flag} of actors){
  const data=await evaluate(s,stats);
  assert.ok(data&&data.frames>=12,"original real gameplay Canvas frames required");
  // Read-only original #network-diagnostics UI: targetGapTicks-based
  // render-gap telemetry, independently of DOM RAF and single floor blit cost.
  const debt=data.diagnosticsText.match(/Extra render lag p50\s+(\d+)ms[\s\S]*?p95\s+(\d+)ms/);
  const catchUps=data.diagnosticsText.match(/Render catch-ups\s+(\d+)/);
  const sampleCount=data.diagnosticsText.match(/>\s*33ms[\s\S]*?\((\d+)\s+samples\)/);
  assert.ok(debt&&catchUps&&sampleCount,"genuine opt-in renderer clock telemetry must be sampled in native client");
  data.presentationDebtP50Ms=Number(debt[1]);
  data.presentationDebtP95Ms=Number(debt[2]);
  data.presentationBoundedCatchups=Number(catchUps[1]);
  data.presentationDebtSamples=Number(sampleCount[1]);
  assert.ok(data.presentationDebtP95Ms>=data.presentationDebtP50Ms&&data.presentationDebtSamples>=12);
  // Read the unchanged first-party `?netstats=1` HUD at the same browser
  // inspection point as the native Canvas callback/render-gap metrics.
  // Snapshot, RTT and ACK jitter use different bounded source windows;
  // this is a co-sample for diagnosis, NOT causal/time-aligned proof.
  const value="(collecting…|\\d+ms)";
  const ack=data.diagnosticsText.match(new RegExp("Input→ACK p50\\s+"+value+"\\s*·\\s*p95\\s+"+value));
  const jitter=data.diagnosticsText.match(new RegExp("Jitter p95\\s+"+value));
  const snapshots=data.diagnosticsText.match(new RegExp("Snapshots p50\\s+"+value+"\\s*·\\s*p95\\s+"+value));
  const inputSamples=data.diagnosticsText.match(/\\|\\s+Samples\\s+(\\d+)(?:\\s*\\||$)/);
  assert.ok(ack&&jitter&&snapshots&&inputSamples,
    "original source network HUD must contain actual ACK, jitter, snapshot and sample diagnostics");
  const ms=s=>s==="collecting…"?null:Number(s.slice(0,-2));
  data.networkUiCoSample={
   inputAckP50Ms:ms(ack[1]),inputAckP95Ms:ms(ack[2]),
   ackJitterP95Ms:ms(jitter[1]),
   snapshotGapP50Ms:ms(snapshots[1]),snapshotGapP95Ms:ms(snapshots[2]),
   inputAckSamples:Number(inputSamples[1]),
   source:"original?netstats=1",
   timeAlignedCausality:false,gpuPresentQualified:false,
  };
  for(const [key,value] of Object.entries(data.networkUiCoSample)){
   if(key.endsWith("Ms"))assert.ok(value===null||(Number.isFinite(value)&&value>=0),
     "original source network observation must be nonnegative or collecting");
  }
  assert.ok(Number.isInteger(data.networkUiCoSample.inputAckSamples)&&data.networkUiCoSample.inputAckSamples>=0);
  assert.equal(data.knightsFlag,"1","all four must use original authenticated source Silver renderer");
  assert.equal(data.knightArt,"relit","all four opt into original Blender 3A relit reference");
  assert.ok(data.knightWebPDraws>=8,"all real players must paint nonplaceholder Silver source WebP frames");
  assert.ok(Object.keys(data.knightSources).some(k=>k.startsWith("silver_")&&k.endsWith("_relit.webp")),
    "require actual original Blender relit Silver WebP drawImage calls, not a fallback Combat circle");
  assert.ok(data.roster.length>=engines.length,"original server-owned roster must show every real browser actor");
  assert.ok(data.floorBlitSampleCount>=12,"real original full-floor drawImage timing samples required");
  assert.ok(Number.isFinite(data.floorBlitDurationP50Ms)&&Number.isFinite(data.floorBlitDurationP95Ms));
  assert.ok(data.floorBlitDurationP95Ms>=data.floorBlitDurationP50Ms,"original floor draw cost order");
  assert.equal(data.canvasWidth,960);assert.equal(data.canvasHeight,540);
  assert.ok(data.floor.centerLuminance>(flag==="1"?38:15));
  assert.ok(data.floor.centerLuminance<(flag==="1"?155:39));
  // The actual online admission was already proven by a Rust-issued #id
  // before any input. A genuine Roll can legitimately replace the HUD's
  // transient "Online" text with authoritative collision feedback.
  // Preserve live identity via the original server-owned scoreboard instead.
  assert.ok(data.roster.some(row=>row.trim().startsWith("#"+actor.id)),
    "admitted Rust player must remain in original roster after real Roll");
  assert.doesNotMatch(data.status,/disconnected|connection lost|connecting to authoritative server/i,
    "real post-Roll HUD must not report a disconnected or connecting client");
  const image=(await request(s.base,"GET","/session/"+s.id+"/screenshot")).value;
  const bytes=Buffer.from(image,"base64");assert.ok(bytes.length>1000&&bytes.subarray(0,4).equals(Buffer.from([137,80,78,71])),"genuine W3C PNG");
  const name=s.engine+"-"+s.index+"-"+(flag==="1"?"lite":"grid")+".png";
  await writeFile(join(output,name),bytes);
  const fullData=await evaluate(s,"return document.querySelector('#arena')?.toDataURL('image/png')||null;");
  assert.ok(typeof fullData==="string"&&fullData.startsWith("data:image/png;base64,"));
  const fullBytes=Buffer.from(fullData.slice("data:image/png;base64,".length),"base64");
  assert.ok(fullBytes.length>1500&&fullBytes.subarray(0,8).toString("hex")==="89504e470d0a1a0a");
  assert.equal(fullBytes.readUInt32BE(16),960);
  assert.equal(fullBytes.readUInt32BE(20),540);
  const canvasName="canvas-"+name;
  await writeFile(join(output,canvasName),fullBytes);
  trial.push({browser:s.engine,actorId:actor.id,mode:"grid",data,screenshot:name,pngSha256:sha(bytes),
   fullCanvasScreenshot:canvasName,fullCanvasSha256:sha(fullBytes),fullCanvasBytes:fullBytes.length});
 }
 assert.equal(trial.length,engines.length,"2/4 real native fighter sessions required");
 assert.ok(trial.every(x=>x.mode==="grid"),"release slice must use original grid on every browser, never optional terrain");
 // Original live browser visual PASS is not a GPU present-frame performance GO.
 // Preserve observed 2-vsync callback and real source render-gap debt separately.
 const performanceAdvisory={
  callbackThresholdMs:33,renderDebtThresholdMs:33,
  callbackOverBudget:trial.filter(t=>t.data.frameIntervalP95Ms>33).map(t=>({
   browser:t.browser,actorId:t.actorId,p95Ms:t.data.frameIntervalP95Ms})),
  renderDebtOverBudget:trial.filter(t=>t.data.presentationDebtP95Ms>33).map(t=>({
   browser:t.browser,actorId:t.actorId,p95Ms:t.data.presentationDebtP95Ms})),
  gpuPresentQualified:false,independentPhysicalHosts:false,performanceReleaseGo:false,
 };
 const report={sourceCommit:process.env.MYASO_KNIGHTS_SOURCE_SHA||"set-from-commit",actualRustWebTransport:true,
  actualOriginalClient:true,realSeparateNativeBrowserProcesses:engines.length,independentPhysicalHumanHosts:false,
  authenticSilverKnightIntegrationVerified:true,
  genuineW3cSilverLocomotionVerified:true,
  genuineW3cLocomotion:{browser:motionSession.engine,actorId:actors[0].actor.id,key:"KeyD",...genuineMotionSource},
  genuineW3cSilverJumpVerified:true,genuineW3cJump:genuineJumpSource,
  genuineW3cSilverRollVerified:true,genuineW3cRoll:genuineRollSource,
  allFiveClipsVisuallyValidated:false,
  trueFourIndependentHumanOperators:false,modeIsOptional:false,defaultArenaPreserved:true,
  genuineFullCombatApproval:false,optionalTerrainEnabled:false,
  includesGpuPresentLatency:false,presentationClockDebtSampled:true,
  browserFrameTimingIsCallbackNotGpu:true,performanceAdvisory,trials:trial};
 await writeFile(join(output,"main0-knights-original-game-native.json"),JSON.stringify(report,null,2)+"\n");
 console.log( "MAIN0_KNIGHTS_ORIGINAL_GRID_REAL_W3C_PASS "+JSON.stringify({pass:true,source:report.sourceCommit,actors:trial.map(x=>x.actorId),browsers:engines,floors:trial.map(x=>({mode:x.mode,centerLuminance:x.data.floor.centerLuminance,frames:x.data.frames,p95:x.data.frameIntervalP95Ms,silverWebP:x.data.knightWebPDraws,sources:x.data.knightSources})),screenshots:trial.map(x=>x.screenshot),
  genuineW3cLocomotion:report.genuineW3cLocomotion,
  genuineW3cJump:report.genuineW3cJump,
  genuineW3cRoll:report.genuineW3cRoll,
  fullCanvases:trial.map(x=>x.fullCanvasScreenshot),
  floorBlitP95Ms:trial.map(x=>x.data.floorBlitDurationP95Ms),
  presentationDebtP95Ms:trial.map(x=>x.data.presentationDebtP95Ms),
  networkUiCoSamples:trial.map(x=>({browser:x.browser,actorId:x.actorId,...x.data.networkUiCoSample})),
  performanceAdvisory}));
}finally{
 for(const s of sessions){try{await request(s.base,"DELETE","/session/"+s.id)}catch{}}
 for(const child of processes){try{child.kill("SIGTERM")}catch{}}
 if(http)await new Promise(ok=>http.close(ok));
}
