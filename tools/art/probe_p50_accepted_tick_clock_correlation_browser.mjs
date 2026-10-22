#!/usr/bin/env node
// Graphics 3C P50: real local Rust WebTransport server + real web/online-game.mjs.
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
const sourcePin="e7fd51e3e423a9f04a62c187482820b14796a894";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",sourcePin,"HEAD"]);
const runtimeSourceDiff=execFileSync("git",["-C",root,"diff","--name-only",sourcePin,"HEAD","--",
 "web/online-game.mjs","web/authoritative-client.mjs","web/network-transport.mjs",
 "src/browser/smooth-motion.mjs","src/browser/render-gap-telemetry.mjs",
 "src/network/constants.mjs","src/network/snapshot-codec.mjs",
 "src/browser/authored-world-renderer.mjs","src/world/authored-maps.mjs",
 "src/world/building-presentation.mjs","server"],{encoding:"utf8"}).trim();
assert.equal(runtimeSourceDiff,"","P50 child may not modify the pinned actual client/server graphics/authority");
const bin=resolve(process.env.P50_SERVER_BIN||"");
assert.ok(bin!==resolve(""),"P50_SERVER_BIN must refer to a pinned local-built server binary");
const chrome=process.env.P50_CHROME_EXECUTABLE;
assert.ok(chrome,"P50_CHROME_EXECUTABLE required");
const clients=Number(process.env.P50_CLIENTS||1);
assert.ok(Number.isInteger(clients)&&clients>=1&&clients<=4);
const measureMs=Number(process.env.P50_MEASURE_MS||4500);
assert.ok(Number.isInteger(measureMs)&&measureMs>=1500&&measureMs<=15000);
const out=resolve(process.argv[2]||"p50_live_loopback.json");
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
  let bytes=await readFile(path);
  // Transparent STRICT test-only in-memory instrumented ORIGINAL modules.
  // Files on disk, original logic branches, packet bytes and authority never change.
  function appendAfterOnce(source,marker,added){
   assert.equal(source.split(marker).length,2,"Original exact-source marker drift: "+marker);
   return source.replace(marker,marker+added);
  }
  if(url.pathname==="/web/authoritative-client.mjs"){
   let src=bytes.toString("utf8");
   src=appendAfterOnce(src,"        latestServerTick = snapshotResult.serverTick;",
    "\n        window.__P50_QA__?.noteAccepted(\"realtime\",latestServerTick);");
   src=appendAfterOnce(src,"        latestServerTick = reliableSnapshotResult.serverTick;",
    "\n        window.__P50_QA__?.noteAccepted(\"reliable\",latestServerTick);");
   bytes=Buffer.from(src);
  }
  if(url.pathname==="/web/online-game.mjs"){
   let src=bytes.toString("utf8");
   src=appendAfterOnce(src,
    "  const renderServerTick = snapshotRenderClock.sample(networkClient.latestServerTick, nowMs);",
    "\n  window.__P50_QA__?.noteClock(nowMs,networkClient.latestServerTick,renderServerTick,snapshotRenderClock.metrics().targetGapTicks,snapshotRenderClock.metrics().boundedCatchups);");
   bytes=Buffer.from(src);
  }
  res.writeHead(200,{"content-type":mime[extname(path)]||"application/octet-stream","cache-control":"no-store"});
  res.end(bytes);
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
const report={type:"P50 actual client+Rust local authoritative smoke and RAF gap telemetry",
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
    gameFrameMs:[],worldTileBlitMs:0,tileBlitCalls:0,observedNames:[],
    frameTrace:[],lastFrameStart:null,longTasks:[],longTaskObserverStatus:"unavailable",
    incoming:[],snapshotHooks:0,snapshotPackets:0,otherPackets:0,
    accepted:[],acceptedRealtime:0,acceptedReliable:0,clock:[],lastClockSample:null,
    ingressSource:"WebTransport.datagrams.readable.getReader() unmodified read results"};
   s.noteAccepted=(kind,tick)=>{
    if(kind==="realtime")s.acceptedRealtime++;
    else if(kind==="reliable")s.acceptedReliable++;
    if(s.accepted.length<4000)s.accepted.push({
     t:+performance.now().toFixed(3),kind,tick});
   };
   s.noteClock=(at,latest,render,gap,catchups)=>{
    if(s.lastClockSample!==null&&at-s.lastClockSample<95)return;
    s.lastClockSample=at;
    if(s.clock.length<2000)s.clock.push({
     t:+at.toFixed(3),tick:latest,renderTick:+render.toFixed(4),
     debtMs:+(gap/60*1000).toFixed(3),catchups});
   };
   // Passive QUIC datagram ingress timestamps, BEFORE the original
   // authoritative-client packet processing callback. No packet mutation,
   // replay, artificial jitter or interception of snapshot server authority.
   const OriginalWebTransport=window.WebTransport;
   if(typeof OriginalWebTransport==="function"){
    window.WebTransport=new Proxy(OriginalWebTransport,{
     construct(target,args){
      const transport=Reflect.construct(target,args);
      const readable=transport.datagrams?.readable;
      if(readable){
       const actualGetReader=readable.getReader.bind(readable);
       readable.getReader=function(...getArgs){
        const reader=actualGetReader(...getArgs);
        const actualRead=reader.read.bind(reader);
        s.snapshotHooks++;
        reader.read=function(...readArgs){
         return actualRead(...readArgs).then(result=>{
          const data=result?.value;
          if(data instanceof Uint8Array&&data.byteLength>=14&&data[1]===2&&data[0]===1){
           // Original packet header: byte1=SNAPSHOT (2),
           // uint16LE sequence at 4 and uint32LE server tick at 8.
           const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
           const t=performance.now();
           s.snapshotPackets++;
           if(s.incoming.length<4000)s.incoming.push({
            t:+t.toFixed(3),sequence:view.getUint16(4,true),
            tick:view.getUint32(8,true),length:data.byteLength});
          }else if(data instanceof Uint8Array)s.otherPackets++;
          return result; // exact same object and same bytes to real client
         });
        };
        return reader;
       };
      }
      return transport;
     }
    });
   }
   if(typeof PerformanceObserver!=="undefined"){
    try{
     const observer=new PerformanceObserver(list=>{
      for(const entry of list.getEntries()){
       if(s.longTasks.length<2500)
        s.longTasks.push({start:+entry.startTime.toFixed(3),duration:+entry.duration.toFixed(3)});
      }
     });
     observer.observe({type:"longtask",buffered:true});
     s.longTaskObserverStatus="observing";
    }catch(error){s.longTaskObserverStatus="unsupported";}
   }
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
     const sinceLast=s.lastFrameStart===null?null:start-s.lastFrameStart;
     s.lastFrameStart=start;
     const previousBlitMs=s.worldTileBlitMs,previousBlitCount=s.tileBlitCalls;
     try{return callback(stamp);}
     finally{
      const finish=performance.now(),duration=finish-start;
      if(s.gameFrameMs.length<2500)s.gameFrameMs.push(duration);
      if(s.frameTrace.length<2500)s.frameTrace.push({
       start:+start.toFixed(3),duration:+duration.toFixed(3),
       delta:sinceLast===null?null:+sinceLast.toFixed(3),
       tileBlitMs:+(s.worldTileBlitMs-previousBlitMs).toFixed(3),
       tileBlitCalls:s.tileBlitCalls-previousBlitCount
      });
     }
    });
   };
   Object.defineProperty(window,"__P50_QA__",{value:s,configurable:false});
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
   const s=window.__P50_QA__;
   s.rafGaps=[];s.lastRaf=null;s.worldTileDraws=0;
   s.gameFrameMs=[];s.worldTileBlitMs=0;s.tileBlitCalls=0;
   s.frameTrace=[];s.lastFrameStart=null;s.longTasks=[];
   s.incoming=[];s.snapshotPackets=0;s.otherPackets=0;
   s.accepted=[];s.acceptedRealtime=0;s.acceptedReliable=0;s.clock=[];s.lastClockSample=null;
  });
 }
 await sleep(measureMs);
 for(const [i,browser] of launched.entries()){
  const page=(await browser.pages()).at(-1);
  const row=report.results[i];
  const results=await page.evaluate(()=>{
   const s=window.__P50_QA__, gaps=s?.rafGaps||[];
   const sorted=gaps.filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
   const frames=(s?.gameFrameMs||[]).filter(x=>Number.isFinite(x)&&x>=0).sort((a,b)=>a-b);
   const trace=s.frameTrace.filter(x=>x.delta!==null&&x.delta>0);
   const taskOverlap=gap=>s.longTasks.some(task=>
    task.start<gap.start&&task.start+task.duration>gap.start-gap.delta);
   const severe=trace.filter(x=>x.delta>=50);
   const moreSevere=trace.filter(x=>x.delta>=100);
   const q=(values,p)=>values.length?Math.round(values[Math.min(values.length-1,Math.max(0,Math.ceil(values.length*p)-1))]*100)/100:null;
   const ingress=s.incoming;
   const ingressGaps=[],ingressTickJumps=[],observed=[];
   for(let i=1;i<ingress.length;i++){
    const a=ingress[i-1],b=ingress[i];
    const dt=b.t-a.t,step=(b.tick-a.tick)>>>0;
    ingressGaps.push(dt);
    ingressTickJumps.push(step);
    if(dt>=100||step>=9)observed.push({
      dt:+dt.toFixed(2),tickJump:step,
      relativeAt:+(b.t-ingress[0].t).toFixed(2)});
   }
   ingressGaps.sort((a,b)=>a-b);
   ingressTickJumps.sort((a,b)=>a-b);
   const accepted=s.accepted,byChannel={realtime:0,reliable:0};
   const acceptedGaps=[],acceptedJump=[];
   for(let i=0;i<accepted.length;i++){
    byChannel[accepted[i].kind]++;
    if(i>0){
     acceptedGaps.push(accepted[i].t-accepted[i-1].t);
     acceptedJump.push((accepted[i].tick-accepted[i-1].tick)>>>0);
    }
   }
   acceptedGaps.sort((a,b)=>a-b);
   acceptedJump.sort((a,b)=>a-b);
   const clocks=s.clock,debts=clocks.map(x=>x.debtMs).sort((a,b)=>a-b);
   const worst=clocks.slice().sort((a,b)=>b.debtMs-a.debtMs).slice(0,5);
   const clockWindows=worst.map(point=>({
    ...point,nearbyAccepted:accepted.filter(x=>Math.abs(x.t-point.t)<=450).slice(-25)
   }));
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
    actualGameFrameGapOver33:trace.filter(x=>x.delta>=33).length,
    actualGameFrameGapOver50:severe.length,
    actualGameFrameGapOver100:moreSevere.length,
    callbackOver16Ms:trace.filter(x=>x.duration>=16.67).length,
    severeFrameGapsWithTaskOverlap:severe.filter(taskOverlap).length,
    severeFrameGapsWithoutTaskOverlap:severe.filter(x=>!taskOverlap(x)).length,
    severeFrameGapsWithShortNextCallback:severe.filter(x=>x.duration<5).length,
    observedLongTaskCount:s.longTasks.length,
    observedLongTaskMaxMs:s.longTasks.length?Math.max(...s.longTasks.map(x=>x.duration)):0,
    longTaskObserverStatus:s.longTaskObserverStatus,
    snapshotReaderHooks:s.snapshotHooks,
    actualSnapshotPacketCount:s.snapshotPackets,
    otherRealtimePacketCount:s.otherPackets,
    ingressSource:s.ingressSource,
    ingressIntervals:ingressGaps.length,
    ingressGapP50Ms:q(ingressGaps,.5),
    ingressGapP95Ms:q(ingressGaps,.95),
    ingressGapMaxMs:q(ingressGaps,1),
    ingressTickJumpP95:q(ingressTickJumps,.95),
    ingressTickJumpMax:q(ingressTickJumps,1),
    ingressIntervalsOver100Ms:ingressGaps.filter(x=>x>=100).length,
    ingressIntervalsOver250Ms:ingressGaps.filter(x=>x>=250).length,
    ingressIntervalsOver400Ms:ingressGaps.filter(x=>x>=400).length,
    eventBursts:observed.slice(0,35),
    acceptedRealtimeCount:s.acceptedRealtime,
    acceptedReliableCount:s.acceptedReliable,
    acceptedTotalCount:accepted.length,
    acceptedGapP95Ms:q(acceptedGaps,.95),
    acceptedGapMaxMs:q(acceptedGaps,1),
    acceptedTickJumpMax:q(acceptedJump,1),
    acceptedGapOver100:acceptedGaps.filter(x=>x>=100).length,
    acceptedGapOver400:acceptedGaps.filter(x=>x>=400).length,
    sampledClockCount:clocks.length,
    sampledClockDebtP95Ms:q(debts,.95),
    sampledClockDebtMaxMs:q(debts,1),
    sampledClockCatchupMax:clocks.reduce((max,x)=>Math.max(max,x.catchups),0),
    clockCorrelationWindows:clockWindows,
    eventBursts:observed.slice(0,35),
    topFrameGaps:[...severe].sort((a,b)=>b.delta-a.delta).slice(0,12),
    documentHidden:document.hidden,
    note:"Game frame synchronous JS callback measured by requestAnimationFrame wrapper; NOT GPU presented frame time or true FPS"
   };
  });
  delete row.page;
  row.measurement=results;
  if(!results.status?.startsWith("Online - player #"))row.errors.push("Missing live connection");
  if(results.tileCanvasDrawCalls<1)row.errors.push("Authored world tile never drawn");
  if(results.actualGameFrameSamples<50)row.errors.push("Actual online render callback not measured");
  if(results.snapshotReaderHooks!==1||results.actualSnapshotPacketCount<20)
   row.errors.push("Actual WebTransport ingress stream not captured, cannot make packet gap claims");
  if(results.acceptedRealtimeCount<20||results.sampledClockCount<20)
   row.errors.push("No actual accepted authoritative ticks and original frame-clock telemetry");
  if(!results.opaqueCanvas)row.errors.push("Real game Canvas is not opaque");
  if(results.scoreboard.length<clients)row.errors.push("Insufficient shared authoritative scoreboard rows");
  // P45 already includes an actual browser screenshot. P50 strictly measures
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
   severeGaps:r.measurement?.actualGameFrameGapOver50,
   ingressPackets:r.measurement?.actualSnapshotPacketCount,
   acceptedRealtime:r.measurement?.acceptedRealtimeCount,
   acceptedReliable:r.measurement?.acceptedReliableCount,
   acceptedMaxGap:r.measurement?.acceptedGapMaxMs,
   clockDebtMax:r.measurement?.sampledClockDebtMaxMs,
   clockDebtP95:r.measurement?.sampledClockDebtP95Ms,
   ingressGapMaxMs:r.measurement?.ingressGapMaxMs,
   ingressTickJumpMax:r.measurement?.ingressTickJumpMax,
   ingressOver100:r.measurement?.ingressIntervalsOver100Ms,
   gap100:r.measurement?.actualGameFrameGapOver100,
   longTasks:r.measurement?.observedLongTaskCount,
   shortCallbackGaps:r.measurement?.severeFrameGapsWithShortNextCallback,
   blitMs:r.measurement?.worldTileBlitMs,
   scoreboard:r.measurement?.scoreboard,errors:r.errors}))}));
if(report.errors.length||report.results.length!==clients||report.results.some(r=>r.errors.length))
 process.exitCode=1;
