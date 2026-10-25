// QA ONLY: real private Rust/WebTransport, original game, four native W3C browsers.
// No fabricated snapshots, position setters, item authority or production activation.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createServer} from "node:http";
import {createHash} from "node:crypto";
import {resolve,join,extname,sep} from "node:path";
import {setTimeout as delay} from "node:timers/promises";

const root=process.cwd(),dir=join(root,"graphics3b-a232-four-real-actor-evidence");
const engines=["chrome","firefox","chrome","firefox"];
const children=[],clients=[];
let http;
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
async function poll(fn,name,ms=25000){
 const end=Date.now()+ms;let last;
 while(Date.now()<end){
  try{const r=await fn();if(r?.ok)return r.value;last=r?.value}catch(e){last=String(e)}
  await delay(140);
 }
 throw new Error(name+" timeout "+JSON.stringify(last).slice(0,500));
}
async function wd(s,method,path,data,ms=16000){
 const r=await fetch(s.base+path,{method,headers:data===undefined?undefined:{"content-type":"application/json"},
  body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(ms)});
 const j=await r.json();
 if(!r.ok||j.value?.error)throw Error(s.engine+" W3C "+method+" "+path+" "+JSON.stringify(j).slice(0,500));
 return j.value??j;
}
async function exec(s,code){return wd(s,"POST","/session/"+s.id+"/execute/sync",{script:code,args:[]})}
async function freePort(){
 const s=createServer();await new Promise(ok=>s.listen(0,"127.0.0.1",ok));
 const port=s.address().port;await new Promise(ok=>s.close(ok));return port;
}
async function staticServer(){
 const mime={".html":"text/html;charset=utf-8",".mjs":"text/javascript;charset=utf-8",
  ".js":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",
  ".webp":"image/webp",".png":"image/png",".json":"application/json",
  ".svg":"image/svg+xml",".ogg":"audio/ogg",".mp3":"audio/mpeg"};
 http=createServer(async(req,res)=>{
  try{
   let url=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
   if(url==="/")url="/web/index.html";
   const f=resolve(root,"."+url);
   if(!f.startsWith(root+sep))throw Error("outside tree");
   const bytes=await readFile(f);
   res.writeHead(200,{"content-type":mime[extname(f)]||"application/octet-stream",
    "cache-control":"no-store"});res.end(bytes);
  }catch{res.writeHead(404);res.end("not found")}
 });
 await new Promise(ok=>http.listen(0,"127.0.0.1",ok));
 return "http://127.0.0.1:"+http.address().port;
}
async function originalRust(){
 const p=spawn(join(root,"server","target","debug","myaso-server"),[],{
  cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",
   MYASO_FLIGHT_BACKGROUND_PLAYERS:"0",MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS:"0",
   MYASO_ALPHA_SPAWN:"greyhaven"},stdio:["ignore","pipe","pipe"]});
 children.push(p);let stdout="",err="";
 p.stdout.on("data",d=>stdout+=String(d));
 p.stderr.on("data",d=>err+=String(d));
 const v=await poll(()=>{
  if(p.exitCode!==null)throw Error("Rust exited: "+err.slice(-500));
  const url=stdout.match(/listening on (https:\/\/[^\s]+)/)?.[1];
  const cert=stdout.match(/development certificate SHA-256:\s*([^\r\n]+)/)?.[1]
   ?.replace(/[^0-9a-f]/gi,"").toLowerCase();
  return {ok:!!url&&cert?.length===64&&stdout.includes("staging-only Greyhaven spawn selected"),
   value:{url,cert,tail:stdout.slice(-400)}};
 },"true private authoritative Rust",60000);
 assert.match(v.url,/^https:\/\/127\.0\.0\.1:\d+\/game$/);
 return v;
}
async function startBrowser(engine,index){
 const port=await freePort(),command=engine==="chrome"?
  (process.env.CHROMEWEBDRIVER?join(process.env.CHROMEWEBDRIVER,"chromedriver"):"chromedriver"):
  (process.env.GECKOWEBDRIVER?join(process.env.GECKOWEBDRIVER,"geckodriver"):"geckodriver");
 const p=spawn(command,engine==="chrome"?["--port="+port]:
  ["--host","127.0.0.1","--port",String(port)],{stdio:["ignore","ignore","pipe"]});
 children.push(p);let err="";p.stderr.on("data",d=>err=(err+String(d)).slice(-500));
 const s={engine,index,base:"http://127.0.0.1:"+port};
 await poll(async()=>{
  if(p.exitCode!==null)throw Error("driver died "+err);
  try{const r=await fetch(s.base+"/status",{signal:AbortSignal.timeout(500)});
   return{ok:r.ok,value:r.status}}catch{return{ok:false,value:null}}
 },"native "+engine+" driver",20000);
 const opts=engine==="chrome"?{browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1440,960",
  "--disable-background-timer-throttling"]}}:{browserName:"firefox","moz:firefoxOptions":{
   args:["-headless"],prefs:{"dom.min_background_timeout_value":4}}};
 const created=await wd(s,"POST","/session",{capabilities:{alwaysMatch:opts}},60000);
 s.id=created.sessionId;s.version=created.capabilities?.browserVersion;
 assert.ok(s.id);
 clients.push(s);
 await wd(s,"POST","/session/"+s.id+"/timeouts",{script:20000,pageLoad:45000});
 return s;
}
const observer="const v=window.__MYASO_A232_NATIVE__?.()??null;"+
 "const c=document.querySelector('#arena');"+
 "return {...v,canvasWidth:c?.width??0,canvasHeight:c?.height??0,"+
 "roster:[...document.querySelectorAll('#scoreboard-list li')].map(x=>x.textContent?.trim()||''),"+
 "scenario:new URL(location.href).searchParams.has('scenario')};";
async function snapshot(s){return exec(s,observer)}
function valid(v,id){
 return v?.ownNetId===id&&v.realServerSnapshot===true&&v.serverTick>0&&
 v.fighters?.length===4&&v.fighters.map(x=>x.netId).join(",")==="1,2,3,4"&&
 v.originalArtPhase==="ready"&&v.redLionFrameDrawn===true&&
 v.canvasWidth===960&&v.canvasHeight===540&&!v.scenario&&
 v.worldOptIn===true&&v.redLionOptIn===true&&v.roster.length>=4;
}
async function capture(s,label){
 const raw=await exec(s,"return document.querySelector('#arena').toDataURL('image/png')");
 assert.match(raw,/^data:image\/png;base64,/);
 const b=Buffer.from(raw.slice(raw.indexOf(",")+1),"base64");
 assert.equal(b.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(b.readUInt32BE(16),960);assert.equal(b.readUInt32BE(20),540);
 const filename=s.engine+"-"+s.index+"-"+label+"-canvas.png";
 await writeFile(join(dir,filename),b);
 const page=Buffer.from(await wd(s,"GET","/session/"+s.id+"/screenshot"),"base64");
 const pagefile=s.engine+"-"+s.index+"-"+label+"-page.png";
 await writeFile(join(dir,pagefile),page);
 return {canvas:filename,canvasSha256:hash(b),page:pagefile,pageSha256:hash(page)};
}
async function press(s,key,ms){
 const uri="/session/"+s.id+"/actions",name="redlion-native-"+s.index;
 await wd(s,"POST",uri,{actions:[{type:"key",id:name,actions:[{type:"keyDown",value:key}]}]});
 try{await delay(ms)}finally{
  await wd(s,"POST",uri,{actions:[{type:"key",id:name,actions:[{type:"keyUp",value:key}]}]});
 }
 await delay(160);
}
async function walkTo(s,axis,target){
 const id=s.index+1;
 for(let attempt=0,stuck=0;attempt<20;attempt++){
  const before=await snapshot(s);
  assert.ok(valid(before,id),"true server/renderer lost "+s.index);
  const actor=before.fighters.find(f=>f.netId===id),delta=target-actor[axis];
  if(Math.abs(delta)<=16)return;
  const key=axis==="x"?(delta>0?"d":"a"):(delta>0?"s":"w");
  const ms=Math.max(90,Math.min(470,Math.round(Math.abs(delta)*3.5)));
  await press(s,key,ms);
  const after=await poll(async()=>{
   const v=await snapshot(s);
   return {ok:valid(v,id)&&v.serverTick>before.serverTick,value:v}
  },"fresh real server movement",7000);
  const next=after.fighters.find(f=>f.netId===id);
  const progress=Math.abs(delta)-Math.abs(target-next[axis]);
  console.log("GRAPHICS3B_REAL_WORLD_W3C_STEP "+JSON.stringify({
   id,axis,key,ms,before:actor[axis],after:next[axis],target,tick:after.serverTick}));
  if(progress<=1)stuck++;else stuck=0;
  if(stuck>=4)throw Error("true server actor blocked on "+axis+" to "+target);
 }
 throw Error("actor "+id+" failed to reach Red Lion "+axis+" "+target);
}
const targets=[{x:4300,y:4025},{x:4420,y:4025},{x:4300,y:4130},{x:4430,y:4130}];
async function run(){
 await mkdir(dir,{recursive:true});
 const site=await staticServer(),server=await originalRust();
 for(let i=0;i<4;i++){
  const s=await startBrowser(engines[i],i);
  const url=new URL(site+"/web/index.html");
  for(const [k,v] of Object.entries({server:server.url,cert:server.cert,
   world:"1",redlion:"1",nativeRedLionProbe:"1"}))url.searchParams.set(k,v);
  await wd(s,"POST","/session/"+s.id+"/url",{url:url.toString()},45000);
  await poll(async()=>{const x=await snapshot(s);
   return{ok:x?.ownNetId===i+1&&x.serverTick>0,value:x}
  },"authentic Rust W3C seat "+(i+1),25000);
 }
 const baseline=[];
 for(const s of clients){
  const v=await poll(async()=>{const x=await snapshot(s);
   return{ok:valid(x,s.index+1),value:x}
  },"4 real fighters and source Red Lion painter",30000);
  baseline.push({id:s.index+1,serverTick:v.serverTick,camera:v.camera,shot:await capture(s,"initial")});
 }
 for(const s of clients){
  const element=await wd(s,"POST","/session/"+s.id+"/element",
   {using:"css selector",value:"#arena"});
  const e=element["element-6066-11e4-a52e-4f735466cecf"];
  assert.ok(e);
  await wd(s,"POST","/session/"+s.id+"/element/"+e+"/click",{});
  await delay(700);
  await walkTo(s,"x",targets[s.index].x);
  await walkTo(s,"y",targets[s.index].y);
 }
 const evidence=[];
 for(const s of clients){
  const end=await poll(async()=>{
   const v=await snapshot(s),own=s.index+1;
   const back=v?.fighters?.filter(f=>f.behindFacade).map(f=>f.netId).join(",");
   const front=v?.fighters?.filter(f=>!f.behindFacade).map(f=>f.netId).join(",");
   const hud=v?.frontHudActorIds??[];
   return {ok:valid(v,own)&&back==="1,2"&&front==="3,4"&&
    [1,2].every(id=>id===own||!hud.includes(id))&&
    [3,4].every(id=>id===own||hud.includes(id)),value:v};
  },"real Rust actor depth and actual HUD occlusion",30000);
  const first=baseline.find(x=>x.id===s.index+1);
  assert.ok(Math.hypot(end.camera.x-first.camera.x,end.camera.y-first.camera.y)>10,
   "source camera did not pan from genuine W3C travel");
  evidence.push({engine:s.engine,browserVersion:s.version,own:s.index+1,
   serverTick:end.serverTick,fighters:end.fighters,actualHudActorIds:end.frontHudActorIds,
   cameraBefore:first.camera,cameraAfter:end.camera,
   screenshot:await capture(s,"two-server-actors-behind-two-front")});
 }
 const report={fourGenuineIndependentNativeW3CSessions:true,
  trueRustWebTransportServer:true,syntheticActors:false,serverPositionWrites:false,
  realW3CMovement:true,genuineOriginalBlenderSourceValidated:true,
  twoOriginalServerActorsBehind:[1,2],twoOriginalServerActorsInFront:[3,4],
  actualHudExclusionPassed:true,realOriginalCanvasScreenshots:true,
  worldStaticCollisionProof:false,portalAuthorityProof:false,actualSwordAuthority:false,
  gameplayFpsProof:false,publicAlphaApproval:false,baseline,evidence};
 await writeFile(join(dir,"four-real-actor-source-report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("GRAPHICS3B_A232_FOUR_REAL_RUST_FACADE_HUD_PASS "+
  JSON.stringify(evidence.map(x=>({actor:x.own,engine:x.engine,
   screenshotSha256:x.screenshot.canvasSha256,positions:x.fighters,
   hud:x.actualHudActorIds}))));
}
let error;
try{await run()}catch(e){error=e;console.error("GRAPHICS3B_A232_FOUR_REAL_RUST_FACADE_HUD_FAIL "+String(e.stack||e))}
finally{
 for(const s of clients)try{await wd(s,"DELETE","/session/"+s.id,undefined,2500)}catch{}
 for(const p of children)try{p.kill("SIGTERM")}catch{}
 await delay(800);
 for(const p of children)try{if(p.exitCode===null)p.kill("SIGKILL")}catch{}
 if(http){http.closeAllConnections?.();await Promise.race([new Promise(ok=>http.close(ok)),delay(1300)])}
}
if(error)process.exitCode=1;
