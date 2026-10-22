// Source-authentic browser smoke of the EXACT Red Lion opt-in game-art module.
// Real World9 + Graphics3C pixels, native Chrome/Firefox, real WebP HTTP/errors.
// No Rust, actor spoof, fake items or production deployment.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {resolve,relative,isAbsolute,extname,join} from "node:path";
import {createHash} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
const base=process.cwd();
const dest=resolve(process.argv[2]||"graphics3b-a232-live-optin-native-evidence");
const cases=["normal","pan","fail-day","tamper-day"];
let mode="normal",server=null;
const drivers=[];
function mime(file){return extname(file)===".mjs"?"text/javascript; charset=utf-8":
 extname(file)===".html"?"text/html; charset=utf-8":
 extname(file)===".webp"?"image/webp":"application/octet-stream";}
const digest=data=>createHash("sha256").update(data).digest("hex");
async function wd(b,method,path,data,ms=24000){
 const req=await fetch(b.url+path,{method,body:data===undefined?undefined:JSON.stringify(data),
  headers:data===undefined?undefined:{"content-type":"application/json"},
  signal:AbortSignal.timeout(ms)});
 const json=await req.json();
 if(!req.ok||json.value?.error)throw Error(b.name+" W3C "+method+" "+path+" "+JSON.stringify(json).slice(0,600));
 return json.value??json;
}
async function exe(b,js){return wd(b,"POST","/session/"+b.id+"/execute/sync",{script:js,args:[]});}
async function start(name,port){
 const chrome=name==="chrome";
 const env=chrome?process.env.CHROMEWEBDRIVER:process.env.GECKOWEBDRIVER;
 const bin=env?join(env,chrome?"chromedriver":"geckodriver"):chrome?"chromedriver":"geckodriver";
 const args=chrome?["--port="+port]:["--host","127.0.0.1","--port",String(port)];
 const p=spawn(bin,args,{stdio:["ignore","ignore","pipe"]});drivers.push(p);
 let stderr="";p.stderr.on("data",d=>stderr=(stderr+String(d)).slice(-1000));
 for(let i=0;i<90;i++){
  if(p.exitCode!==null)throw Error(name+" driver exited "+stderr);
  try{if((await fetch("http://127.0.0.1:"+port+"/status",{signal:AbortSignal.timeout(400)})).ok)break}
  catch{}
  await sleep(150);
  if(i===89)throw Error(name+" WebDriver unavailable "+stderr);
 }
 const b={name,url:"http://127.0.0.1:"+port};
 const browser=chrome?{browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1440,960"
 ]}}:{browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
 const session=await wd(b,"POST","/session",{capabilities:{alwaysMatch:browser}},60000);
 assert.ok(session.sessionId);b.id=session.sessionId;b.version=session.capabilities?.browserVersion;
 return b;
}
async function sourceCases(browser,page){
 const trials=[];
 for(const choice of cases){
  mode=choice;
  await wd(browser,"POST","/session/"+browser.id+"/url",{url:page+"?mode="+choice},30000);
  let report=null;
  for(let i=0;i<100;i++){
   report=await exe(browser,"return window.__graphics3bLiveArtSmoke??null");
   if(report?.ready===true||report?.ready===false)break;
   await sleep(90);
  }
  assert.ok(report?.ready, browser.name+" "+choice+" first-party browser smoke failed "+JSON.stringify(report));
  const accepted=choice==="normal"||choice==="pan";
  assert.equal(report.actualCameraPan,choice==="pan");
  assert.equal(report.cameraX,choice==="pan"?4465:4365);
  assert.equal(report.cameraY,choice==="pan"?4115:4075);
  assert.equal(report.originalSourceBlender,true);
  assert.equal(report.realMultiplayerActors,false);
  assert.equal(report.realGameAuthority,false);
  assert.equal(report.originalSourceHashValidated,accepted);
  assert.equal(report.canonicalReplacement,accepted);
  assert.equal(report.sourceArtState,accepted?"ready":"failed");
  assert.equal(report.unchangedWorldFallback,!accepted);
  if(accepted)assert.ok(report.changedRgb>5000,"native source must draw different original Red Lion facade");
  else assert.equal(report.changedRgb,0,"failed source art must keep PIXEL-IDENTICAL canonical World placeholder");
  assert.equal(report.changedAlpha,0);
  const el=await wd(browser,"POST","/session/"+browser.id+"/element",
   {using:"css selector",value:"#composed"});
  const id=el["element-6066-11e4-a52e-4f735466cecf"];
  assert.ok(id);
  const png=Buffer.from(await wd(browser,"GET","/session/"+browser.id+"/element/"+id+"/screenshot"),"base64");
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.ok(png.length>10000);
  const imageFile=browser.name+"-"+choice+"-actual-a232-red-lion.png";
  await writeFile(join(dest,imageFile),png);
  trials.push({browser:browser.name,version:browser.version,mode:choice,report,
   screenshot:imageFile,screenshotSha256:digest(png)});
  console.log("GRAPHICS3B_A232_ACTUAL_LIVE_ART_BROWSER_CASE_PASS "+JSON.stringify({
   browser:browser.name,mode:choice,changedPixels:report.changedRgb,originalWorldFallback:report.unchangedWorldFallback}));
 }
 return trials;
}
let failure;
try{
 await mkdir(dest,{recursive:true});
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,"http://localhost").pathname;
   const absolute=resolve(base,"."+decodeURIComponent(path));
   const rel=relative(base,absolute);
   if(rel.startsWith("..")||isAbsolute(rel)){res.writeHead(403);res.end();return}
   if(mode==="fail-day" && path.endsWith("/red_lion_a232_day_ironwork.webp")){
    res.writeHead(503,{"cache-control":"no-store"});res.end("deliberate QA Red Lion missing day art");return;
   }
   const buf=await readFile(absolute);
   if(mode==="tamper-day" && path.endsWith("/red_lion_a232_day_ironwork.webp")){
    const bad=Buffer.from(buf);bad[100]^=1;
    res.writeHead(200,{"content-type":"image/webp","cache-control":"no-store"});res.end(bad);return;
   }
   res.writeHead(200,{"content-type":mime(absolute),"cache-control":"no-store"});res.end(buf);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok)});
 const page="http://127.0.0.1:"+server.address().port+"/web/graphics3b-red-lion-live-art-smoke.html";
 const trials=[];
 for(const [name,port] of [["chrome",9899],["firefox",9900]]){
  const b=await start(name,port);
  try{trials.push(...await sourceCases(b,page))}
  finally{if(b.id)await wd(b,"DELETE","/session/"+b.id).catch(()=>{})}
 }
 assert.equal(trials.length,8);
 await writeFile(join(dest,"graphics3b-a232-native-live-art-source-report.json"),
  JSON.stringify({actualOriginalSource:true,eightGenuineBrowserScenarios:true,
   productionIntegrationOnlyWhenOptedIn:true,actualMultiplayerProof:false,actorDepthCertified:false,
   trials},null,2)+"\n");
 console.log("GRAPHICS3B_A232_NATIVE_LIVE_ART_OPTIN_PASS "+JSON.stringify({
  cases:trials.length,chromium:trials.filter(t=>t.browser==="chrome").length,
  firefox:trials.filter(t=>t.browser==="firefox").length,
  realWebPArtAccepted:trials.filter(t=>t.mode==="normal"||t.mode==="pan").length,
  exactOriginalFallback:trials.filter(t=>t.mode!=="normal").length}));
}catch(e){failure=e;console.error("GRAPHICS3B_A232_NATIVE_LIVE_ART_OPTIN_FAIL "+String(e.stack||e))}
finally{
 for(const p of drivers)if(p.exitCode===null)p.kill("SIGTERM");
 if(server){server.closeAllConnections?.();await new Promise(done=>server.close(done))}
}
if(failure)process.exitCode=1;
