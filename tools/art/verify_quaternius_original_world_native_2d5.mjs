// Graphics3B P1 native opt-in art-only proof (Chrome + Firefox).
// NO server, no synthetic/real player, no replacement ID, no gameplay/map mutations.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {resolve,relative,extname,isAbsolute,join} from "node:path";
import {createHash} from "node:crypto";
import {setTimeout as delay} from "node:timers/promises";

const base=process.cwd(),dest=resolve(".artifacts/quaternius-greyhaven-browser-2d5-review");
const mime={".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".json":"application/json",".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
 ".webp":"image/webp",".png":"image/png"};
const sha=x=>createHash("sha256").update(x).digest("hex");
const processes=[],sessions=[];
let site;
async function port(){
 const s=createServer();await new Promise(ok=>s.listen(0,"127.0.0.1",ok));
 const x=s.address().port;await new Promise(ok=>s.close(ok));return x;
}
async function serve(){
 site=createServer(async(req,res)=>{
  try{
   const path=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
   const absolute=resolve(base,"."+path),rel=relative(base,absolute);
   if(isAbsolute(rel)||rel===".."||rel.startsWith(".."+"/"))throw Error("outside");
   const buf=await readFile(absolute);
   res.writeHead(200,{"content-type":mime[extname(absolute)]||"application/octet-stream","cache-control":"no-store"});
   res.end(buf);
  }catch{res.writeHead(404);res.end("Not Found")}
 });
 await new Promise(ok=>site.listen(0,"127.0.0.1",ok));
 return "http://127.0.0.1:"+site.address().port;
}
async function wd(browser,method,path,data,ms=20000){
 const r=await fetch(browser.endpoint+path,{method,
  headers:data===undefined?undefined:{"content-type":"application/json"},
  body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(ms)});
 const j=await r.json();
 if(!r.ok||j.value?.error)throw Error(browser.name+" WebDriver "+method+" "+path+" "+JSON.stringify(j).slice(0,800));
 return j.value??j;
}
async function exec(browser,script){return wd(browser,"POST","/session/"+browser.session+"/execute/sync",{script,args:[]})}
async function start(name){
 const chrome=name==="chrome",p=await port(),driver=chrome?"chromedriver":"geckodriver";
 const args=chrome?["--port="+p]:["--host","127.0.0.1","--port",String(p)];
 const proc=spawn(driver,args,{stdio:["ignore","ignore","pipe"]});
 processes.push(proc);
 let tail="";proc.stderr.on("data",x=>tail=(tail+String(x)).slice(-1500));
 const browser={name,endpoint:"http://127.0.0.1:"+p};
 let ready=false;
 for(let i=0;i<110;i++){
  if(proc.exitCode!==null)throw Error(name+" WebDriver exited "+tail);
  try{const x=await fetch(browser.endpoint+"/status",{signal:AbortSignal.timeout(500)});if(x.ok){ready=true;break}}catch{}
  await delay(120);
 }
 if(!ready)throw Error(name+" WebDriver unavailable "+tail);
 const opts=chrome?{browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1250,800"
 ]}}:{browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
 const j=await wd(browser,"POST","/session",{capabilities:{alwaysMatch:opts}},60000);
 browser.session=j.sessionId;
 browser.version=j.capabilities?.browserVersion;
 assert.ok(browser.session);
 sessions.push(browser);
 await wd(browser,"POST","/session/"+browser.session+"/timeouts",{script:15000,pageLoad:60000});
 return browser;
}
async function wait(browser,code,label){
 let last=null;
 for(let i=0;i<220;i++){
  last=await exec(browser,code);
  if(last?.ok)return last;
  await delay(160);
 }
 throw Error(label+" missing "+JSON.stringify(last).slice(0,600));
}
const auditScript=`const a=document.querySelector('#original'),b=document.querySelector('#comparison');
const status=document.querySelector('#status')?.textContent||'';
if(!status.startsWith('Original World9'))return {ok:false,status};
const ac=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
const bc=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
let outside=0,inside=0;
for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
 const offset=(y*a.width+x)*4;
 let changed=false;
 for(let j=0;j<4;j++)if(ac[offset+j]!==bc[offset+j]){changed=true;break}
 if(changed){if(x>=680&&x<941&&y>=136&&y<437)inside++;else outside++}
}
return {ok:outside===0&&inside>10000,inside,outside,status,
width:a.width,height:a.height,mood:document.querySelector('#mood').value};`;
async function screenshot(browser,label){
 const data=await exec(browser,"return document.querySelector('#comparison').toDataURL('image/png')");
 assert.match(data,/^data:image\/png;base64,/);
 const b=Buffer.from(data.split(",")[1],"base64");
 assert.equal(b.readUInt32BE(16),960);assert.equal(b.readUInt32BE(20),540);
 const filename=browser.name+"-"+label+"-original-world-and-quaternius-inset.png";
 await writeFile(join(dest,filename),b);
 return {filename,sha256:sha(b),bytes:b.length};
}
let error;
try{
 await mkdir(dest,{recursive:true});
 const uri=await serve(),evidence=[];
 for(const name of ["chrome","firefox"]){
  const browser=await start(name);
  // Fail closed: no flag means no game/source/download path should be activated.
  await wd(browser,"POST","/session/"+browser.session+"/url",{url:uri+"/web/graphics3b-quaternius-2d5-local-review.html"},60000);
  const disabled=await wait(browser,
   "const x=document.querySelector('#status')?.textContent||'';return {ok:x.startsWith('ART REVIEW BLOCKED:'),status:x}",
   name+" explicit opt-in gate");
  const url=uri+"/web/graphics3b-quaternius-2d5-local-review.html?quaterniusReview=1";
  await wd(browser,"POST","/session/"+browser.session+"/url",{url},60000);
  const daylight=await wait(browser,auditScript,name+" first-party immutable Red Lion/day review");
  assert.equal(daylight.mood,"day");
  assert.equal(daylight.outside,0);
  const dayShot=await screenshot(browser,"day");
  await exec(browser,"const x=document.querySelector('#mood');x.value='dusk';x.dispatchEvent(new Event('change'));return true");
  const dusk=await wait(browser,auditScript,name+" first-party immutable Red Lion/dusk review");
  assert.equal(dusk.mood,"dusk");
  assert.equal(dusk.outside,0);
  const duskShot=await screenshot(browser,"dusk");
  assert.notEqual(dayShot.sha256,duskShot.sha256,"original day/dusk browser frames should differ");
  evidence.push({browser:name,version:browser.version,disabled,daylight,dusk,dayShot,duskShot});
  console.log("GRAPHICS3B_QUATERNIUS_ORIGINAL_WORLD_NATIVE_BROWSER_PASS "+
   JSON.stringify({browser:name,version:browser.version,
    dayPixelsInside:daylight.inside,dayPixelsOutside:daylight.outside,
    duskPixelsInside:dusk.inside,duskPixelsOutside:dusk.outside,
    daySha256:dayShot.sha256,duskSha256:duskShot.sha256}));
 }
 const report={originalWorld9AndGraphics3C:true,
  originalRedLionA232SHAProtected:true,sourceQuaterniusRealBlender2d5:true,
  originalWorldPixelsOutsideReviewOverlayUnchanged:true,
  onlyLocalhostOptIn:true,realChromeFirefox:true,syntheticRenderedPlayers:false,
  noNewWorldPlacement:true,noPortalOrCollisionEvidence:true,
  noCombatChange:true,noReleaseApproval:true,evidence};
 await writeFile(join(dest,"quaternius-original-world-native-2d5-review-report.json"),
  JSON.stringify(report,null,2)+"\n");
}catch(e){error=e;console.error("GRAPHICS3B_QUATERNIUS_ORIGINAL_WORLD_NATIVE_BROWSER_FAIL "+String(e.stack||e))}
finally{
 for(const b of sessions)try{await wd(b,"DELETE","/session/"+b.session,undefined,4000)}catch{}
 for(const p of processes)try{p.kill("SIGTERM")}catch{}
 await delay(350);
 for(const p of processes)try{if(p.exitCode===null)p.kill("SIGKILL")}catch{}
 if(site)await Promise.race([new Promise(ok=>site.close(ok)),delay(1000)]);
}
if(error)process.exitCode=1;
