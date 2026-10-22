// UI Department 10 — Pre-Alpha real browser Canvas layout parity, from approved Graphics 3B source.
// Read-only first-party web/index.html and styles.css at one exact CSS viewport.
// This is NOT authenticated gameplay, Knight animation or visible sword proof.
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {setTimeout as sleep} from "node:timers/promises";
import {resolve,extname,sep,join} from "node:path";
import {
 P0_CONTENT_VIEWPORT,nativeContentViewportMatches,nextNativeW3cWindowRect
} from "./graphics3b_native_viewport_parity.mjs";
import {measureGameplayCanvasFoldBudget} from "./graphics3b_gameplay_fold_budget.mjs";

const root=process.cwd();
const output=join(root,"alpha-prealpha-ui10-native-page-parity-evidence");
const engines=[{name:"chrome",port:9787},{name:"firefox",port:9788}];
const viewportTargets=Object.freeze([P0_CONTENT_VIEWPORT,Object.freeze({width:1366,height:682})]);
const children=[];
const files={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
 ".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp",
 ".png":"image/png",".ogg":"audio/ogg",".mp3":"audio/mpeg",".woff2":"font/woff2"};
let site;
async function w3c(browser,method,path,body,ms=16000){
 const response=await fetch(browser.base+path,{
  method,headers:body===undefined?undefined:{"content-type":"application/json"},
  body:body===undefined?undefined:JSON.stringify(body),
  signal:AbortSignal.timeout(ms)});
 const parsed=await response.json();
 if(!response.ok||parsed.value?.error)
  throw new Error(browser.name+" WebDriver "+path+": "+JSON.stringify(parsed).slice(0,250));
 return parsed.value??parsed;
}
const execute=(browser,source)=>w3c(browser,"POST","/session/"+browser.id+"/execute/sync",{script:source,args:[]});
const nativeSize=browser=>execute(browser,
 "return {innerWidth:window.innerWidth,innerHeight:window.innerHeight,outerWidth:window.outerWidth,outerHeight:window.outerHeight};");
async function measureContentViewport(browser,target){
 for(let attempt=0;attempt<4;attempt++){
  const v=await nativeSize(browser);
  if(nativeContentViewportMatches(v,target))return v;
  const rect=nextNativeW3cWindowRect(v,target);
  await w3c(browser,"POST","/session/"+browser.id+"/window/rect",rect);
  await sleep(200);
 }
 const v=await nativeSize(browser);
 if(!nativeContentViewportMatches(v,target))
  throw Error(browser.name+" cannot match real CSS viewport "+JSON.stringify({v,target}));
 return v;
}
async function runLocalPageServer(){
 const s=createServer(async(request,response)=>{
  try {
   const p=new URL(request.url,"http://127.0.0.1").pathname;
   const file=resolve(root,"."+decodeURIComponent(p));
   if(!file.startsWith(root+sep)||(await stat(file)).isFile()!==true){
    response.writeHead(404);response.end();return;
   }
   response.writeHead(200,{"content-type":files[extname(file)]||"application/octet-stream","cache-control":"no-store"});
   response.end(await readFile(file));
  }catch{response.writeHead(404);response.end()}
 });
 await new Promise((yes,no)=>{s.once("error",no);s.listen(0,"127.0.0.1",yes)});
 return s;
}
async function launch(name,port){
 const chrome=name==="chrome";
 const binary=chrome?(process.env.CHROMEWEBDRIVER?join(process.env.CHROMEWEBDRIVER,"chromedriver"):"chromedriver"):(process.env.GECKOWEBDRIVER?join(process.env.GECKOWEBDRIVER,"geckodriver"):"geckodriver");
 const command=chrome?["--port="+port]:["--host","127.0.0.1","--port",String(port)];
 const proc=spawn(binary,command,{stdio:["ignore","ignore","pipe"]});
 children.push(proc);
 let stderr="";
 proc.stderr.on("data",data=>{stderr+=String(data);stderr=stderr.slice(-1500)});
 proc.on("error",error=>{stderr+=String(error);stderr=stderr.slice(-1500)});
 const browser={name,base:"http://127.0.0.1:"+port,proc};
 let up=false;
 for(let i=0;i<80;i++){
  if(proc.exitCode!==null)throw Error(name+" WebDriver exited: "+stderr);
  try { const status=await fetch(browser.base+"/status",{signal:AbortSignal.timeout(450)});
   if(status.ok){up=true;break}
  }catch{}
  await sleep(150);
 }
 if(!up)throw Error(name+" WebDriver did not start: "+stderr);
 const caps=chrome?{browserName:"chrome","goog:chromeOptions":{args:[
  "--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--disable-background-timer-throttling","--window-size=1280,900"
 ]}}:{browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
 const created=await w3c(browser,"POST","/session",{capabilities:{alwaysMatch:caps}},60000);
 browser.id=created.sessionId;
 if(!browser.id)throw Error(name+" no genuine W3C session");
 return browser;
}
const pageScript=[
 "const c=document.querySelector('#arena');",
 "const h=document.querySelector('.masthead'),hud=document.querySelector('.hud'),controls=document.querySelector('.controls');",
 "if(!c||!h||!hud||!controls)throw Error('actual myaso page markup missing');",
 "const r=c.getBoundingClientRect(),mh=h.getBoundingClientRect(),hh=hud.getBoundingClientRect();",
 "const visibleW=Math.max(0,Math.min(innerWidth,r.right)-Math.max(0,r.left));",
 "const visibleH=Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top));",
 "return {innerWidth,innerHeight,canvas:{left:r.left,top:r.top,width:r.width,height:r.height},",
 "  masthead:{top:mh.top,height:mh.height},hud:{top:hh.top,height:hh.height},",
 "  visibleCanvasFraction:Math.round(1e6*visibleW*visibleH/(r.width*r.height))/1e6,",
 "  controlsItems:controls.children.length,hasOriginalCss:getComputedStyle(c).display==='block',",
 "  scrolledY:window.scrollY,gameplayAuthorityVerified:false};"
].join("\n");
async function inspect(browser,target){
 const dimensions=await measureContentViewport(browser,target);
 const metrics=await execute(browser,pageScript);
 if(metrics.innerWidth!==target.width||metrics.innerHeight!==target.height)
  throw Error(browser.name+" content viewport changed after CSS page load");
 if(!metrics.hasOriginalCss||metrics.controlsItems<10)
  throw Error(browser.name+" did not use original authored myaso UI");
 const foldBudget=measureGameplayCanvasFoldBudget({viewportHeight:metrics.innerHeight,
  canvasTop:metrics.canvas.top,canvasHeight:metrics.canvas.height});
 if(Math.abs(foldBudget.visibleCanvasFraction-metrics.visibleCanvasFraction)>0.000002)
  throw Error(browser.name+" browser DOM fold and source budget mismatch");
 if(process.env.MYASO_P0_GAME_FIRST_LAYOUT==="1"){
  if(!foldBudget.canvasFullyInPage)
   throw Error(browser.name+" original Canvas still falls below the real browser fold "+JSON.stringify({target,foldBudget}));
  const expectedRatio=16/9;
  if(Math.abs(metrics.canvas.width/metrics.canvas.height-expectedRatio)>0.02)
   throw Error(browser.name+" game Canvas CSS aspect distorted");
  const before=await execute(browser, "const d=document.querySelector('.controls-disclosure'),s=d?.querySelector('summary');return {closed:d?.open===false,summary:s?.textContent,controls:d?.querySelector('.controls')?.children.length};");
  if(!before.closed||!before.summary?.includes("Controls")||before.controls!==14)
   throw Error(browser.name+" keyboard-accessible original 14 controls unavailable "+JSON.stringify(before));
  const element=await w3c(browser,"POST","/session/"+browser.id+"/element",{using:"css selector",value:".controls-disclosure summary"});
  const id=element["element-6066-11e4-a52e-4f735466cecf"];
  if(!id)throw Error(browser.name+" W3C control disclosure missing");
  await w3c(browser,"POST","/session/"+browser.id+"/element/"+id+"/click",{});
  const opened=await execute(browser,"return {open:document.querySelector('.controls-disclosure')?.open,items:document.querySelector('.controls-disclosure .controls')?.children.length};");
  if(opened.open!==true||opened.items!==14)
   throw Error(browser.name+" original combat instructions did not expand");
  await w3c(browser,"POST","/session/"+browser.id+"/element/"+id+"/click",{});
  const closed=await execute(browser,"return {open:document.querySelector('.controls-disclosure')?.open,scrollY:window.scrollY};");
  if(closed.open!==false||closed.scrollY!==0)
   throw Error(browser.name+" control disclosure blocked source game window");
  console.log("GRAPHICS3B_P0_GAME_FIRST_LAYOUT_ACCEPT "+JSON.stringify({browser:browser.name,viewport:target,canvas:metrics.canvas,foldBudget,controlsNative:true,controlsCount:14,noArtificialScroll:true}));
 }
 const screenshot=await w3c(browser,"GET","/session/"+browser.id+"/screenshot");
 const pixels=Buffer.from(screenshot,"base64");
 if(pixels.length<1000||!pixels.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))
  throw Error(browser.name+" screenshot unavailable");
 const name=browser.name+"-real-myaso-page-"+target.width+"x"+target.height+".png";
 await writeFile(join(output,name),pixels);
 return {browser:browser.name,viewportTarget:target,dimensions,metrics,foldBudget,screenshot:name,
  screenshotSha256:createHash("sha256").update(pixels).digest("hex")};
}
async function main(){
 await mkdir(output,{recursive:true});
 site=await runLocalPageServer();
 const url="http://127.0.0.1:"+site.address().port+"/web/index.html";
 const result=[];
 for(const {name,port} of engines){
  const browser=await launch(name,port);
  try{
   await w3c(browser,"POST","/session/"+browser.id+"/url",{url},30000);
   for(const target of viewportTargets)result.push(await inspect(browser,target));
  }finally{if(browser.id)await w3c(browser,"DELETE","/session/"+browser.id).catch(()=>{})}
 }
 const report={source:"actual web/index.html + web/styles.css; local no-authority preview",
  actualNativeBrowsers:true,sameCssViewport:true,viewports:viewportTargets,
  fourAuthenticatedPlayers:false,originalRackRendered:false,
  silverKnightVisibilityCertified:false,worldOrItemWriterTouched:false,result};
 await writeFile(join(output,"layout-parity-report.json"),JSON.stringify(report,null,2));
 console.log("GRAPHICS3B_P0_ACTUAL_BROWSER_LAYOUT_PARITY_PASS "+JSON.stringify(report));
 console.log("GRAPHICS3B_P0_LAYOUT_RECLAIM_REQUIRED "+JSON.stringify(result.map(v=>({
  browser:v.browser,viewport:v.viewportTarget,minimumUpwardLayoutReclaimPx:v.foldBudget.minimumUpwardLayoutReclaimPx,
  canvasFullyInPage:v.foldBudget.canvasFullyInPage,
  canvasCenterInsidePage:v.foldBudget.canvasCenterInsidePage}))));
}
let error;
try{await main()}catch(e){error=e;console.error("GRAPHICS3B_P0_ACTUAL_BROWSER_LAYOUT_PARITY_FAIL "+String(e.stack||e))}
finally{
 for(const proc of children)if(proc.exitCode===null)proc.kill("SIGTERM");
 if(site){site.closeAllConnections?.();await new Promise(done=>site.close(done))}
}
if(error)process.exitCode=1;
