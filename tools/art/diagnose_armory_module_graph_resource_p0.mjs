#!/usr/bin/env node
/**
 * Original first-party WebP loading vs exact pinned World #493 OR #521
 * and original 3B module graph. Five source-isolation modes, bounded runs.
 * This is optional source QA, NOT low-end X230i approval and not gameplay.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,relative,join,extname} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {platform,cpus,totalmem,freemem,hostname} from "node:os";
import {pinnedSourceLineEndingDigests} from "./pinned-source-line-endings-p0.mjs";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2],"Need independently pinned original World #493 or #521 source");
const world=resolve(process.argv[2]);
const out=resolve(process.argv[3]||join(repo,".p0-module-graph-load-report.json"));
const allowedWorldHeads=Object.freeze({
 "07060f981b8a1dac89184b621b6893dd970a08ae":
  "db5274b9ad3ea8e28f4a2ef44358cfed247d0625785dc353577a3ee6d136f9e9",
 "3178b9aad8757ceb3594ff04b9e3099dced6b729":
  "2006dbff24401cc5e262363fb11f89546bbf769cb11bcffddcbeb8819dd4ca7a"
});
const checkedWorldHead=execFileSync("git",["-C",world,"rev-parse","HEAD"],
 {encoding:"utf8"}).trim();
assert.ok(Object.hasOwn(allowedWorldHeads,checkedWorldHead),
 "Source head not in exact verified World #493/#521 allowlist");
const heads={world:checkedWorldHead,
 graphicsAncestor:"40112c3d3f0eeeb441a3206beba7c5d21e292852"};
assert.equal(execFileSync("git",["-C",world,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),heads.world);
execFileSync("git",["-C",repo,"merge-base","--is-ancestor",heads.graphicsAncestor,"HEAD"]);
const xref={
 "/__worldsource__/src/browser/authored-world-renderer.mjs":join(world,"src/browser/authored-world-renderer.mjs"),
 "/__worldsource__/src/world/alpha-armory.mjs":join(world,"src/world/alpha-armory.mjs"),
 "/__worldsource__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs")
};
if(checkedWorldHead==="3178b9aad8757ceb3594ff04b9e3099dced6b729")
 xref["/__worldsource__/src/world/building-presentation.mjs"]=
  join(world,"src/world/building-presentation.mjs");
const allow=new Set([
 "web/armory-p0-graph-load-probe.html","web/armory-p0-graph-load-probe.mjs",
 "src/browser/armory-world493-visual-bridge.mjs","src/browser/armory-rack-visual.mjs",
 "src/browser/armory-sword-alpha-sampler.mjs","src/browser/armory-rack-presented-frame.mjs",
 "src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/armory-p0/armory_rack.webp",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp"
]);
const sha=async(path)=>createHash("sha256").update(await readFile(path)).digest("hex");
// The historical reference digests were pinned from CRLF Windows checkouts.
// Verify *exactly* equivalent native LF or CRLF source bytes before applying
// those same strict SHA256 pins. Mixed newline/source mutations fail closed.
const originalSources=Object.fromEntries(await Promise.all(Object.entries(xref).map(async([url,path])=>{
 return [url,pinnedSourceLineEndingDigests(await readFile(path),url)];
})));
const originals=Object.fromEntries(Object.entries(originalSources).map(([url,d])=>[url,d.canonicalCrLfSha256]));
assert.equal(originals["/__worldsource__/src/world/alpha-armory.mjs"],
 "305a7764d67af9115d85000bde5e922cbae64db2455e15fbf7d3d22b01c5c3bf");
assert.equal(originals["/__worldsource__/src/world/authored-maps.mjs"],
 "21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144");
assert.equal(originals["/__worldsource__/src/browser/authored-world-renderer.mjs"],
 allowedWorldHeads[checkedWorldHead]);
const originalAssets={
 "assets/environment/greyhaven/armory-p0/armory_rack.webp":
   "83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8",
 "assets/environment/greyhaven/armory-p0/armory_sword.webp":
   "795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31"
};
for(const [p,h] of Object.entries(originalAssets))assert.equal(await sha(join(repo,p)),h);
const mime={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".webp":"image/webp"};
const requests=[];
const injectedFailureRoute=process.env.P0_GRAPH_FAIL_ROUTE||null;
if(injectedFailureRoute!==null)
 assert.ok(Object.hasOwn(xref,injectedFailureRoute),
  "Fault injection route must be one of the EXACT original World module paths");
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1");
 const pathString=decodeURIComponent(url.pathname);
 requests.push({path:pathString,method:req.method,atMs:Date.now()});
 if(injectedFailureRoute===pathString){
  res.writeHead(503,{"Content-Type":"text/plain","Cache-Control":"no-store"});
  res.end("INTENTIONAL QA-ONLY SOURCE FAILURE");return;
 }
 try{
  const path=xref[pathString]??resolve(repo,"."+pathString);
  if(!xref[pathString]&&!allow.has(relative(repo,path).replaceAll("\\","/"))){
   res.writeHead(404);res.end("Not allowed");return;
  }
  const bytes=await readFile(path);
  res.writeHead(200,{"Content-Type":mime[extname(path)]??"application/octet-stream",
   "Content-Length":bytes.length,"Cache-Control":"no-store"});
  res.end(bytes);
 }catch(e){res.writeHead(500);res.end("Source read failed");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-graph-load-probe.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const repeat=Number(process.env.P0_GRAPH_REPEAT||2);
assert.ok(Number.isSafeInteger(repeat)&&repeat>=1&&repeat<=3);
const drawBudget=Number(process.env.P0_GRAPH_DRAWS||1);
assert.ok([1,6].includes(drawBudget));
const variants=["minimal","world","graphics","graph","draw"];
const engines=process.env.P0_GRAPH_ENGINE==="chrome"?["chrome"]:["chrome","firefox"];
const timeoutMs=Number(process.env.P0_GRAPH_TIMEOUT_MS||20000);
assert.ok(Number.isSafeInteger(timeoutMs)&&timeoutMs>=3000&&timeoutMs<=45000,
 "P0_GRAPH_TIMEOUT_MS must be 3000..45000");
const results=[], report={
 milestone:"P0 Graphics 3B exact #493/#521 first-party images vs isolated World/Graphics module requests",
 sourceHeads:heads,sourceSha256:originals,sourceNativeSha256:Object.fromEntries(
  Object.entries(originalSources).map(([url,d])=>[url,d.nativeSha256])),
 sourceLineEndings:Object.fromEntries(Object.entries(originalSources).map(([url,d])=>[url,d.lineEndings])),
 sourceHashPolicy:"strict original Windows-CRLF SHA256 pins with exact LF/CRLF-only normalization",
 sourceAssetSha256:originalAssets,
 host:{platform:platform(),hostname:hostname(),cpu:cpus()[0]?.model,totalMemory:totalmem(),
  availableMemoryAtStart:freemem()},
 conditions:{repeat,variants,drawBudget,browsers:engines,timeoutMs,
  faultInjectionRoute:injectedFailureRoute,
  experimentalFaultInjection:injectedFailureRoute!==null,localhostOnly:true},
 results,requests,actualX230iTested:platform()==="linux"&&hostname().toLowerCase()==="x230i",productionEdited:false,
 gameClientExecuted:false,hasServerOwnedItemIds:false,performancePassed:false
};
try{
 for(const engine of engines){
  let browser;
  try{
   const options={headless:true,executablePath:engine==="chrome"?
     process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(engine==="chrome"){
    assert.ok(options.executablePath,"CHROME_EXECUTABLE required");
    options.args=["--no-sandbox","--disable-gpu-sandbox","--disable-dev-shm-usage"];
   }else{
    assert.ok(options.executablePath,"FIREFOX_EXECUTABLE required");
    options.browser="firefox";options.protocol="webDriverBiDi";
   }
   browser=await puppeteer.launch(options);
   const version=await browser.version();
   for(let repetition=1;repetition<=repeat;repetition++){
    for(const variant of variants){
     const page=await browser.newPage(),errors=[],responses=[];
     const t0=Date.now();
     try{
      page.on("pageerror",e=>errors.push("pageerror "+e.message));
      page.on("requestfailed",req=>errors.push("requestfailed "+req.url()+" "+req.failure()?.errorText));
      page.on("response",r=>{responses.push({status:r.status(),url:new URL(r.url()).pathname});
       if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
      await page.goto(url+"?mode="+variant+"&draws="+drawBudget,
       {waitUntil:"domcontentloaded",timeout:timeoutMs});
      await page.waitForFunction(()=>window.__graphProbe?.done,{timeout:timeoutMs});
      const parsed=await page.evaluate(()=>({
       probe:window.__graphProbe,
       resources:performance.getEntriesByType("resource").map(v=>({
        url:new URL(v.name).pathname,durationMs:v.duration,transferSize:v.transferSize,
        decodedBodySize:v.decodedBodySize,responseEnd:v.responseEnd
       }))
      }));
      results.push({engine,version,repetition,variant,elapsedWallMs:Date.now()-t0,
       probe:parsed.probe,resources:parsed.resources,responses,errors,
       fullWorldSourceGraphLoaded:["world","graph","draw"].includes(variant),
       graphicsSourceModulesLoaded:["graphics","graph","draw"].includes(variant),
       worldDrawTested:variant==="draw",
       genuinelyLowEndHost:report.actualX230iTested,serverItemEvents:0});
      if(parsed.probe.phase!=="DONE"||errors.length)throw Error("Source probe did not complete without browser errors");
     }catch(e){
      if(!results.some(r=>r.engine===engine&&r.repetition===repetition&&r.variant===variant))
       results.push({engine,version,repetition,variant,elapsedWallMs:Date.now()-t0,
        errors:[...errors,String(e)],responses,sourceProbeFailed:true});
      // Keep remaining independent source groups measurable after one
      // Chromium request failure. Explicit report status stays red.
     }finally{
       try{await page.close()}catch(closeError){
         errors.push("page close "+String(closeError));
       }
     }
    }
   }
  }finally{await browser?.close();}
 }
}finally{
 await new Promise(ok=>server.close(ok));
 report.completedRuns=results.filter(r=>r.probe?.phase==="DONE"&&r.errors.length===0).length;
 report.successfulOnTestedHost=report.completedRuns===engines.length*repeat*variants.length;
 await mkdir(resolve(out,".."),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+"\n");
}
console.log("GRAPH_RESOURCE_DIAG="+JSON.stringify({
 complete:report.completedRuns,expected:engines.length*repeat*variants.length,
 details:results.map(r=>({engine:r.engine,repetition:r.repetition,variant:r.variant,
  wallMs:r.elapsedWallMs,stage:r.probe?.phase,requests:r.responses?.length,
  drawMs:r.probe?.log?.filter(e=>e.stage==="draw:complete").map(e=>e.ms),
  errors:r.errors})),actualX230iTested:report.actualX230iTested
}));
if(!report.successfulOnTestedHost)process.exitCode=1;
