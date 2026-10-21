#!/usr/bin/env node
// Graphics 3C P46: real local Rust WebTransport server + real web/online-game.mjs.
// Host-local ephemeral endpoints only. Native browser rendering and snapshot HUD.
// NO mock server, no gameplay source changes, no public network, no Alpha GO.
import assert from "node:assert/strict";
import {spawn,execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {readFile,stat,mkdir,writeFile} from "node:fs/promises";
import {resolve,join,sep,extname,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {setTimeout as sleep} from "node:timers/promises";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const sourcePin="0a1e622a356007c70030bff190dd7abf44df4501";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",sourcePin,"HEAD"]);
const runtimeSourceDiff=execFileSync("git",["-C",root,"diff","--name-only",sourcePin,"HEAD","--",
 "web/online-game.mjs","src/browser/authored-world-renderer.mjs","src/world/authored-maps.mjs","src/world/building-presentation.mjs","server"],{encoding:"utf8"}).trim();
assert.equal(runtimeSourceDiff,"","P46 child may not modify the pinned actual client/server graphics/authority");
const bin=resolve(process.env.P46_SERVER_BIN||"");
assert.ok(bin!==resolve(""),"P46_SERVER_BIN must refer to a pinned local-built server binary");
const chrome=process.env.P46_CHROME_EXECUTABLE;
assert.ok(chrome,"P46_CHROME_EXECUTABLE required");
const clients=Number(process.env.P46_CLIENTS||1);
assert.ok(Number.isInteger(clients)&&clients>=1&&clients<=4);
const measureMs=Number(process.env.P46_MEASURE_MS||4500);
assert.ok(Number.isInteger(measureMs)&&measureMs>=1500&&measureMs<=15000);
const out=resolve(process.argv[2]||"p46_live_loopback.json");
const mime={".mjs":"text/javascript;charset=utf-8",".js":"text/javascript;charset=utf-8",
 ".html":"text/html;charset=utf-8",".css":"text/css;charset=utf-8",".json":"application/json",
 ".webp":"image/webp",".png":"image/png",".svg":"image/svg+xml",".ogg":"audio/ogg",".mp3":"audio/mpeg"};
const web=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1/");
  if(url.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const path=resolve(root,"."+decodeURIComponent(url.pathname==="/"?"/web/index.html":url.pathname));
  if(!path.startsWith(root+sep))return res.writeHead(403).end();
  if(!(await stat(path)).isFile())return res.writeHead(404).end();
  res.writeHead(200,{"content-type":mime[extname(path)]||"application/octet-stream","cache-control":"no-store"});
  res.end(await readFile(path));
 }catch(e){res.writeHead(e?.code==="ENOENT"?404:500);res.end("unavailable")}
});
await new Promise(ok=>web.listen(0,"127.0.0.1",ok));
const proc=spawn(bin,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0"},stdio:["ignore","pipe","pipe"]});
let gameOutput="",stderr="",endpoint=null,cert=null;
proc.stdout.setEncoding("utf8");proc.stderr.setEncoding("utf8");
proc.stdout.on("data",s=>{gameOutput+=s;for(const line of gameOutput.split(/\r?\n/)){
 const url=line.match(/listening on (https:\/\/[^\s]+)/)?.[1];if(url)endpoint=url;
 if(line.includes("development certificate SHA-256:")){
  const hex=line.split("development certificate SHA-256:").at(-1).trim().replace(/[^a-fA-F0-9]/g,"");
  if(hex.length===64)cert=hex.toLowerCase();
 }
}});
proc.stderr.on("data",s=>{stderr+=s});
const launched=[];
const report={type:"P46 actual client+Rust local authoritative smoke and RAF gap telemetry",
 sourceHead:sourcePin,serverBinary:bin.split("/").at(-1),host:"127.0.0.1",
 browsersIndependentHosts:false,serverAuthoritative:true,worldFlag:true,
 clientsRequested:clients,measureMs,results:[],errors:[]};
try{
 const start=Date.now();
 while(Date.now()-start<35000 &&(!endpoint||!cert)&&proc.exitCode===null)await sleep(125);
 if(!endpoint||!cert)throw new Error("Local Rust server never reported URL/certificate: "+stderr.slice(-1100)+" / "+gameOutput.slice(-1100));
 assert.match(endpoint,/^https:\/\/127\.0\.0\.1:/,"Server must bind loopback, never public");
 for(let i=0;i<clients;i++){
  const browser=await puppeteer.launch({executablePath:chrome,headless:true,
   args:["--no-sandbox","--disable-dev-shm-usage","--disable-background-timer-throttling",
    "--disable-renderer-backgrounding","--disable-backgrounding-occluded-windows"]});
  launched.push(browser);
  const page=await browser.newPage();
  await page.setViewport({width:960,height:720,deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url())});
  await page.evaluateOnNewDocument(()=>{
   const s={worldTileDraws:0,rafGaps:[],lastRaf:null,
    gameFrameMs:[],worldTileBlitMs:0,tileBlitCalls:0,observedNames:[]};
   // Wrap ONLY the actual online module's `function frame(now)` callback,
   // without replacing the client's source or frame scheduling decision.
   const rawRaf=window.requestAnimationFrame.bind(window);
   window.requestAnimationFrame=function(callback){
    const actualFrame=callback.name==="frame";
    if(s.observedNames.length<20&&!s.observedNames.includes(callback.name))
      s.observedNames.push(callback.name);
    if(!actualFrame)return rawRaf(callback);
    return rawRaf((stamp)=>{
     const start=performance.now();
     try{return callback(stamp);}
     finally{
      if(s.gameFrameMs.length<2500)s.gameFrameMs.push(performance.now()-start);
     }
    });
   };
   Object.defineProperty(window,"__P46_QA__",{value:s,configurable:false});
   const orig=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(...args){
    const originalTile=this.canvas?.id==="arena"&&args[0]?.width===512&&args[0]?.height===512;
    if(!originalTile)return orig.apply(this,args);
    const start=performance.now();
    try{return orig.apply(this,args)}
    finally{
     s.worldTileDraws++;
     s.tileBlitCalls++;
     s.worldTileBlitMs+=performance.now()-start;
    }
   };
   const collect=(t)=>{
    if(s.lastRaf!==null &&s.rafGaps.length<2500)s.rafGaps.push(t-s.lastRaf);
    s.lastRaf=t;requestAnimationFrame(collect);
   };
   requestAnimationFrame(collect);
  });
  const url=new URL("http://127.0.0.1:"+web.address().port+"/web/index.html");
  url.searchParams.set("server",endpoint);
  url.searchParams.set("cert",cert);
  url.searchParams.set("world","1");
  url.searchParams.set("netstats","1");
  await page.goto(url.toString(),{waitUntil:"domcontentloaded",timeout:20000});
  await page.waitForFunction(()=>document.querySelector("#event-text")?.textContent?.startsWith("Online - player #"),{timeout:18000,polling:200});
  report.results.push({index:i+1,errors,page,client:await page.evaluate(()=>({
   status:document.querySelector("#event-text")?.textContent,
   canvasOpaque:document.querySelector("#arena")?.getContext("2d")?.getContextAttributes?.()?.alpha===false,
   title:document.title
  }))});
 }
 // Unlike real independent-host acceptance, these are four local browser processes.
 const movementKeys=["w","a","s","d"];
 for(const [i,browser] of launched.entries()){
  const page=(await browser.pages()).at(-1);
  try{await page.click("#arena");await page.keyboard.down(movementKeys[i]);}
  catch(e){report.errors.push("focus/movement "+String(e))}
 }
 await sleep(650);
 for(const [i,browser] of launched.entries()){
  const page=(await browser.pages()).at(-1);
  try{await page.keyboard.up(movementKeys[i]);}
  catch(e){report.errors.push("release "+String(e))}
 }
 for(const browser of launched){
  const page=(await browser.pages()).at(-1);
  await page.evaluate(()=>{
   const s=window.__P46_QA__;
   s.rafGaps=[];s.lastRaf=null;s.worldTileDraws=0;
   s.gameFrameMs=[];s.worldTileBlitMs=0;s.tileBlitCalls=0;
  });
 }
 await sleep(measureMs);
 for(const [i,browser] of launched.entries()){
  const page=(await browser.pages()).at(-1);
  const row=report.results[i];
  const results=await page.evaluate(()=>{
   const s=window.__P46_QA__, gaps=s?.rafGaps||[];
   const sorted=gaps.filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
   const frames=(s?.gameFrameMs||[]).filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
   const q=(values,p)=>values.length?Math.round(values[Math.min(values.length-1,Math.max(0,Math.ceil(values.length*p)-1))]*100)/100:null;
   return {
    status:document.querySelector("#event-text")?.textContent,
    scoreboard:Array.from(document.querySelectorAll("#scoreboard-list li")).map(x=>x.textContent),
    diagnostics:document.querySelector("#network-diagnostics")?.textContent,
    opaqueCanvas:document.querySelector("#arena")?.getContext("2d")?.getContextAttributes?.()?.alpha===false,
    tileCanvasDrawCalls:s?.worldTileDraws??0,
    rAFGapP50Ms:q(sorted,.5),rAFGapP95Ms:q(sorted,.95),rAFGapMaxMs:sorted.at(-1)||null,
    rAFSamples:sorted.length,
    actualGameFrameP50Ms:q(frames,.5),actualGameFrameP95Ms:q(frames,.95),
    actualGameFrameMaxMs:q(frames,1),actualGameFrameSamples:frames.length,
    worldTileBlitMs:Math.round(s.worldTileBlitMs*100)/100,
    worldTileBlitCalls:s.tileBlitCalls,
    measuredCallbackNames:s.observedNames,
    documentHidden:document.hidden,
    note:"Game frame synchronous JS callback measured by requestAnimationFrame wrapper; NOT GPU presented frame time or true FPS"
   };
  });
  delete row.page;
  row.measurement=results;
  if(!results.status?.startsWith("Online - player #"))row.errors.push("Missing live connection");
  if(results.tileCanvasDrawCalls<1)row.errors.push("Authored world tile never drawn");
  if(results.actualGameFrameSamples<50)row.errors.push("Actual online render callback not measured");
  if(!results.opaqueCanvas)row.errors.push("Real game Canvas is not opaque");
  if(results.scoreboard.length<clients)row.errors.push("Insufficient shared authoritative scoreboard rows");
  // P45 already includes an actual browser screenshot. P46 strictly measures
  // main-thread JS on the real online client, not another art/screenshot PR.
 }
 const playerIds=report.results.map(r=>r.measurement?.status?.match(/Online - player #(\d+)/)?.[1]);
 if(playerIds.some(x=>!x)||new Set(playerIds).size!==clients)
  report.errors.push("Distinct authoritative net IDs not confirmed across client processes");
} catch(e){report.errors.push(String(e));}
finally{
 for(const row of report.results)delete row.page;
 for(const browser of launched)try{await browser.close()}catch{}
 proc.kill("SIGTERM");
 await new Promise(ok=>setTimeout(ok,500));
 if(proc.exitCode===null)proc.kill("SIGKILL");
 await new Promise(ok=>web.close(ok));
 // Preserve fail-closed observable authenticated IDs without committing
 // ephemeral certificate hashes, local UDP port numbers or session tokens.
 const serverIds=[...gameOutput.matchAll(/assigned player (\d+)/g)].map(x=>Number(x[1]));
 report.serverSummary={endpointLoopback:!!endpoint&&endpoint.startsWith("https://127.0.0.1:"),
  admittedPlayerIds:serverIds,clientCount:serverIds.length};
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify({head:report.sourceHead,clientCount:report.results.length,
  endpoints:"loopback only",errors:report.errors,
  clients:report.results.map(r=>({i:r.index,status:r.measurement?.status,
   tiles:r.measurement?.tileCanvasDrawCalls,opaque:r.measurement?.opaqueCanvas,
   rAFSamples:r.measurement?.rAFSamples,p95Ms:r.measurement?.rAFGapP95Ms,
   gameFrameP95Ms:r.measurement?.actualGameFrameP95Ms,
   gameFrameSamples:r.measurement?.actualGameFrameSamples,
   blitMs:r.measurement?.worldTileBlitMs,
   scoreboard:r.measurement?.scoreboard,errors:r.errors}))}));
if(report.errors.length||report.results.length!==clients||report.results.some(r=>r.errors.length))
 process.exitCode=1;
