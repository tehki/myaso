// Graphics 3B P0: opt-in original Blender EMPTY rack in the actual four
// authenticated rendered Greyhaven Chrome/Firefox WebDriver clients.
// Fork of unchanged Core8A source W3C acceptance. No canonical sword feed,
// pickups, combat suppression, multi-host, or release proof.
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {createHash} from "node:crypto";
import {readFile,stat,mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {setTimeout as sleep} from "node:timers/promises";
import {parseNativeWorldLiveness,nativeWorldLivenessAdvanced} from "./alpha_p0_native_world_liveness.mjs";
const root=process.cwd(),deadline=Date.now()+160000;
const children=new Set(),clients=[];
let http;
const dir=path.join(root,"alpha-p0-real-greyhaven-armory-preview-evidence");
const browsers=[{name:"chrome-1",family:"chrome",port:9751},{name:"firefox-2",family:"firefox",port:9752},{name:"chrome-3",family:"chrome",port:9753},{name:"firefox-4",family:"firefox",port:9754}];
function check(p,msg){if(!p)throw Error(msg)}
function kill(child,signal="SIGTERM"){
 if(!child?.pid)return;
 try{if(process.platform==="win32")child.kill(signal);else process.kill(-child.pid,signal)}catch{}
}
async function poll(fn,what,ms=20000){
 const until=Math.min(deadline,Date.now()+ms);let last;
 while(Date.now()<until){last=await fn();if(last?.ok)return last.value;await sleep(150)}
 throw Error(what+" timed out; last="+JSON.stringify(last?.value).slice(0,600));
}
async function w3c(s,method,uri,data,ms=12000){
 const r=await fetch(s.base+uri,{method,headers:data===undefined?undefined:{"content-type":"application/json"},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(ms)});
 const response=await r.json();
 if(!r.ok||response.value?.error)throw Error("W3C "+method+" "+uri+": "+JSON.stringify(response).slice(0,500));
 return response.value??response;
}
async function execute(s,code){return w3c(s,"POST","/session/"+s.id+"/execute/sync",{script:code,args:[]})}
async function pageServer(){
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,"http://127.0.0.1/");
   const requested=decodeURIComponent(url.pathname);
   const relative=requested.endsWith("/")?requested+"index.html":requested;
   const pathname=path.resolve(root,"."+relative);
   if(!pathname.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
   if(!(await stat(pathname)).isFile()){res.writeHead(404);res.end();return}
   const ext=path.extname(pathname);
   res.setHeader("content-type",({".html":"text/html; charset=utf-8",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2",".ogg":"audio/ogg",".mp3":"audio/mpeg"})[ext]||"application/octet-stream");
   res.setHeader("cache-control","no-store");res.end(await readFile(pathname));
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
 return server;
}
async function gameServer(){
 const env={...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",MYASO_FLIGHT_BACKGROUND_PLAYERS:"0",MYASO_FLIGHT_NEAR_PRESSURE_PLAYERS:"0",MYASO_ALPHA_SPAWN:"greyhaven",MYASO_ALPHA_STATIC_COLLISION:"reviewed-static-only"};
 const child=spawn(path.join(root,"server","target","debug","myaso-server"),[],{cwd:root,env,stdio:["ignore","pipe","pipe"],detached:process.platform!=="win32"});
 children.add(child);let output="",url,hash;
 child.stdout.on("data",d=>{
  output+=d;process.stdout.write("[real-rust] "+d);
  const match=output.match(/listening on (https:\/\/[^\s]+)/);
  if(match)url=match[1];
  const pin=output.match(/development certificate SHA-256: ([^\r\n]+)/);
  if(pin){const normalized=pin[1].replace(/[^0-9a-f]/gi,"");if(normalized.length===64)hash=normalized.toLowerCase()}
 });
 child.stderr.on("data",d=>process.stderr.write("[real-rust-err] "+d));
 await poll(async()=>({ok:!!url&&!!hash&&output.includes("myaso admission cap: 4 concurrent players")&&output.includes("staging-only Greyhaven spawn selected")&&output.includes("staging-only Greyhaven fixed static sweep enabled"),value:{url,hash}}),"verified authority staging",45000);
 check(url.startsWith("https://127.0.0.1:")&&url.endsWith("/game"),"server must bind only loopback");
 return {url,hash};
}
async function driver(item){
 const chrome=item.family==="chrome";
 const exe=chrome?(process.env.CHROMEWEBDRIVER?path.join(process.env.CHROMEWEBDRIVER,"chromedriver"):"chromedriver"):(process.env.GECKOWEBDRIVER?path.join(process.env.GECKOWEBDRIVER,"geckodriver"):"geckodriver");
 const args=chrome?["--port="+item.port]:["--host","127.0.0.1","--port",String(item.port)];
 const child=spawn(exe,args,{cwd:root,stdio:["ignore","pipe","pipe"],detached:process.platform!=="win32"});
 children.add(child);child.stderr.on("data",d=>process.stderr.write("["+item.name+"] "+d));
 const s={...item,child,base:"http://127.0.0.1:"+item.port};
 await poll(async()=>{if(child.exitCode!==null)throw Error(item.name+" driver exited");
  try{const r=await fetch(s.base+"/status",{signal:AbortSignal.timeout(700)});return{ok:r.ok,value:r.status}}catch{return{ok:false,value:0}}
 },item.name+" driver",16000);
 const caps=chrome?{browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,900","--disable-background-timer-throttling","--disable-backgrounding-occluded-windows"]}}:{browserName:"firefox","moz:firefoxOptions":{args:["-headless"],prefs:{"dom.min_background_timeout_value":4,"dom.timeout.enable_budget_timer_throttling":false}}};
 const created=await w3c(s,"POST","/session",{capabilities:{alwaysMatch:caps}},30000);
 s.id=created.sessionId??created.value?.sessionId;check(s.id,item.name+" no W3C session");
 clients.push(s);
 await w3c(s,"POST","/session/"+s.id+"/timeouts",{script:15000,pageLoad:30000,implicit:0});
 return s;
}
const snapshotCode=[
 "const c=document.querySelector('#arena'),ctx=c?.getContext('2d');",
 "const rows=[...document.querySelectorAll('#scoreboard-list li')];",
 "const id=r=>Number((r?.querySelector('span')?.textContent??'').match(/^#(\\d+)$/)?.[1]??0);",
 "const own=rows.filter(r=>r.dataset.own==='true');",
 "const status=document.querySelector('#event-text')?.textContent??'';",
 "const telemetry=document.querySelector('#network-diagnostics')?.textContent??'';",
 "let green=0;",
 "if(ctx)for(let y=65;y<c.height-65;y+=67)for(let x=65;x<c.width-65;x+=67){",
 "const p=ctx.getImageData(x,y,1,1).data;",
 "if(p[1]>p[0]+8&&p[1]>p[2]+8&&p[1]>=55&&p[1]<=195)green++;}",
 "const search=new URL(location.href).searchParams;",
 "const liveness=window.__MYASO_WORLD_LIVENESS__?.snapshot(Date.now())??null;",
 "const rack=window.__MYASO_ARMORY_RACK_REVIEW__?.()??null;",
 "return {liveness,armory:rack,own:own.length===1?id(own[0]):0,ownCount:own.length,ids:rows.map(id).sort((a,b)=>a-b),tick:Number(status.match(/server tick (\\d+)/)?.[1]??0),telemetry,green,width:c?.width??0,height:c?.height??0,world:search.get('world')==='1',scenario:search.has('scenario'),acceptance:!!window.__MYASO_ACCEPTANCE_STATE__};"
].join("\n");
async function snapshot(s){
 const values=await execute(s,snapshotCode);
 return {...values,...parseNativeWorldLiveness(values.telemetry)};
}
function valid(s,id){
 return s.own===id&&s.ownCount===1&&s.ids.join(",")==="1,2,3,4"&&s.valid===true&&s.tick>0&&s.green>=8&&s.width>=800&&s.height>=500&&s.world&&!s.scenario&&!s.acceptance&&
   s.armory?.ready===true&&s.armory.painted>0&&s.armory.actualCanvas===true&&
   s.armory.drawnSwords===0&&s.armory.canonicalItems===false&&
   s.armory.serverTryPickup===false&&s.armory.productionApproved===false;
}
async function screenshot(s){
 const raw=await w3c(s,"GET","/session/"+s.id+"/screenshot");
 const png=Buffer.from(raw,"base64");
 check(png.length>1000&&png.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")),"real WebDriver PNG not captured");
 const filename=s.name+"-original-greyhaven-empty-armory-rack.png";
 await writeFile(path.join(dir,filename),png);
 return {filename,bytes:png.length,sha256:createHash("sha256").update(png).digest("hex")};
}
async function move(s){
 const element=await w3c(s,"POST","/session/"+s.id+"/element",{using:"css selector",value:"#arena"});
 const id=element["element-6066-11e4-a52e-4f735466cecf"];
 check(id,"native game canvas missing");
 await w3c(s,"POST","/session/"+s.id+"/element/"+id+"/click",{});
 const uri="/session/"+s.id+"/actions";
 await w3c(s,"POST",uri,{actions:[{type:"key",id:"native-world",actions:[{type:"keyDown",value:"a"}]}]});
 try{await sleep(800)}finally{
  await w3c(s,"POST",uri,{actions:[{type:"key",id:"native-world",actions:[{type:"keyUp",value:"a"}]}]});
 }
}
async function run(){
 await mkdir(dir,{recursive:true});http=await pageServer();const game=await gameServer();
 for(let i=0;i<browsers.length;i++){
  const s=await driver(browsers[i]);
  const u=new URL("http://127.0.0.1:"+http.address().port+"/web/index.html");
  u.searchParams.set("server",game.url);u.searchParams.set("cert",game.hash);u.searchParams.set("world","1");
  u.searchParams.set("armoryart","1");
  u.searchParams.set("netstats","1");
  u.searchParams.set("uiLivenessProbe","1");
  check(!u.searchParams.has("scenario"),"must render genuine world without acceptance scenario");
  await w3c(s,"POST","/session/"+s.id+"/url",{url:u.href},30000);
  await poll(async()=>{const x=await snapshot(s);return{ok:x.own===i+1&&x.valid===true,value:x}},s.name+" authentic QUIC roster",19000);
 }
 const before=await Promise.all(clients.map((s,i)=>poll(async()=>{
  const v=await snapshot(s);return {ok:valid(v,i+1),value:v};
 },s.name+" full real painted city and 4-player roster",26000)));
 const captures=[];
 for(let i=0;i<clients.length;i++)captures.push({browser:clients[i].name,playerId:before[i].own,greenSamples:before[i].green,image:await screenshot(clients[i])});
 console.log("ALPHA_P0_WORLD_LIVENESS_BEFORE "+JSON.stringify(before.map((value,i)=>({browser:clients[i].name,uiTick:value.tick,probe:value.liveness}))));
 await move(clients[0]);
 let after;
 try {
  after=await Promise.all(clients.map((s,i)=>poll(async()=>{
   const v=await snapshot(s);
   return {ok:valid(v,i+1)&&nativeWorldLivenessAdvanced(before[i],v)&&v.tick>before[i].tick,value:v};
  },s.name+" living city after actual W3C gesture",12000)));
 } catch(error) {
  // Preserve the original strict HUD/tick requirement. Never accept a newer
  // snapshot as a substitute for a stale on-screen tick or missing canvas.
  const checked=await Promise.allSettled(clients.map(snapshot));
  console.error("ALPHA_P0_WORLD_LIVENESS_FAILURE "+JSON.stringify(checked.map((result,i)=>({
   browser:clients[i].name,baselineTick:before[i].tick,
   value:result.status==="fulfilled"?{uiTick:result.value.tick,probe:result.value.liveness}:null,
   captureError:result.status==="rejected"?String(result.reason):null,
  }))));
  throw error;
 }
 console.log("ALPHA_P0_WORLD_LIVENESS_AFTER "+JSON.stringify(after.map((value,i)=>({browser:clients[i].name,uiTick:value.tick,probe:value.liveness}))));
 const proof={realRustAuthority:true,sourceAuthoredWorldRenderer:true,
  trueWorldQueryWithoutScenario:true,genuineFourChromeFirefoxW3cClients:true,
  allFourSharedAuthoritativeRoster:[1,2,3,4],
  trueNativeKeyboardGesture:true,
  independentFreshNetworkProgress:after.map((x,i)=>({
    id:x.own,ackCountBefore:before[i].ackCount,ackCountAfter:x.ackCount,
    receivedSnapshotsBefore:before[i].snapshotCount,
    receivedSnapshotsAfter:x.snapshotCount,statusTickForContextOnly:x.tick,
  })),
  renderedGreenSampleCounts:before.map(x=>x.green),captures,
  serverOwnedGreyhavenProfile:true,reviewed23StaticSolids:true,
  scope:"single-host loopback canvas art + real QUIC; NOT sword art, armed PvP, identity gear or independent hosts"};
 console.log("ALPHA_P0_FOUR_REAL_RENDERED_GREYHAVEN_BROWSERS_PASS "+JSON.stringify(proof));
 await writeFile(path.join(dir,"report.json"),JSON.stringify(proof,null,2));
}
let failed=false;
try{await run()}catch(error){failed=true;console.error("ALPHA_P0_FOUR_REAL_RENDERED_GREYHAVEN_BROWSERS_FAIL "+(error.stack??error))}
finally{
 for(const s of clients)try{await w3c(s,"DELETE","/session/"+s.id,undefined,1500)}catch{}
 for(const child of children)kill(child);
 await sleep(1200);for(const child of children)kill(child,"SIGKILL");
 if(http){http.closeAllConnections?.();await Promise.race([new Promise(resolve=>http.close(resolve)),sleep(1600)])}
}
if(failed)process.exitCode=1;
