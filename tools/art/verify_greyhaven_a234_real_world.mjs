#!/usr/bin/env node
// A2.34: first-party World #336 renderer imported directly, exact SHA-pinned.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,join,relative,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2]&&process.argv[3]&&process.argv[4],
 "Pass independently pinned World #336, Graphics 3C and Knight checkouts, then output dir");
const world=resolve(process.argv[2]),c3=resolve(process.argv[3]),
 knight=resolve(process.argv[4]),out=resolve(process.argv[5]||join(repo,".a234-review"));
const pins={world:"260a7b85a33b7a51663a70af8d410e0d33e0e236",
 c3:"8e85584b6007b38e1a00155b77473e92b0afec6a",
 knight:"c74fcf90e227f3bc4788728f000cfe6aa083c7ef"};
for(const [path,k] of [[world,"world"],[c3,"c3"],[knight,"knight"]])
 assert.equal(execFileSync("git",["-C",path,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),pins[k]);
const delegated={
 "/src/browser/authored-world-renderer.mjs":join(world,"src/browser/authored-world-renderer.mjs"),
 "/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/__a234_3c__/greyhaven-atmosphere.mjs":join(c3,"src/browser/greyhaven-atmosphere.mjs"),
 "/__a234_knights__/silver_idle.webp":join(knight,"web/assets/knights/silver_idle.webp")
};
const dig=async path=>createHash("sha256").update(await readFile(path)).digest("hex");
assert.equal(await dig(delegated["/__a234_knights__/silver_idle.webp"]),
 "828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
const sourceHashes=Object.fromEntries(await Promise.all(Object.entries(delegated).map(
 async ([uri,path])=>[uri,await dig(path)])));
const local=new Set([
 "web/greyhaven-a234-real-world-review.html","web/greyhaven-a234-real-world-review.mjs",
 "src/browser/arena-viewport.mjs","src/browser/red-lion-visual-depth-review.mjs",
 "assets/environment/greyhaven/a231-review/greyhaven_a231_lighting_handoff.json",
 "assets/environment/greyhaven/a232-review/greyhaven_a232_threshold_actor_alpha_report.json",
 "assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp",
 "assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp"]);
const types={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",
 ".json":"application/json",".webp":"image/webp"};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let path=delegated[pathname];
  if(!path){path=resolve(repo,"."+pathname);
   if(!local.has(relative(repo,path).replaceAll("\\","/"))){
    res.writeHead(404);res.end("not found");return;}
  }
  if(!existsSync(path)){res.writeHead(404);res.end("not found");return;}
  const bytes=await readFile(path);
  res.writeHead(200,{"Content-Type":types[extname(path)]||"application/octet-stream",
   "Cache-Control":"no-store"});res.end(bytes);
 }catch(e){res.writeHead(500);res.end("isolated art file server error");}
});
await mkdir(out,{recursive:true});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/greyhaven-a234-real-world-review.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
function p95(arr){const sorted=[...arr].sort((a,b)=>a-b);return sorted[Math.ceil(.95*sorted.length)-1];}
const results=[];
try{
 for(const browserName of ["chrome","firefox"]){
  let browser;
  try{
   const opts={headless:true,executablePath:browserName==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(browserName==="chrome")opts.args=["--no-sandbox","--disable-gpu-sandbox"];
   else {opts.browser="firefox";opts.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(opts);
   const page=await browser.newPage(),errors=[];
   await page.setViewport({width:1430,height:1030,deviceScaleFactor:1});
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.goto(url,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>window.__a234Review?.()?.ready,{timeout:18000});
   // 3 tiles/render, populate all visible tiles before inspecting screenshots.
   for(let i=0;i<7;i++)await page.evaluate(()=>window.__a234RenderNext());
   const captures=[];
   for(const [dy,cameraEast,label] of [[-20,0,"north"],[20,0,"south"],[-20,80,"camera-east"]]){
    const state=await page.evaluate(async({dy,cameraEast})=>{
     for(const [key,value] of Object.entries({actorY:dy,cameraEast})){
      const el=document.getElementById(key);el.value=String(value);
      el.dispatchEvent(new Event("input",{bubbles:true}));
     }
     await new Promise(r=>requestAnimationFrame(r));
     for(let i=0;i<5;i++)await window.__a234RenderNext();
     return window.__a234Review();
    },{dy,cameraEast});
    assert.equal(state.ready,true);
    assert.equal(state.dy,dy);
    assert.equal(state.cameraEast,cameraEast);
    assert.equal(state.realWorld336RendererUsed,true);
    assert.equal(state.world336OptInSourcePresent,true);
    assert.equal(state.placeholderTavernStillDrawnByWorld336,true);
    assert.equal(state.rawWorldBuildingDepthSortingPresent,false);
    assert.equal(state.actualOnlineGameExecuted,false);
    assert.equal(state.liveServerAttached,false);
    assert.deepEqual(state.originalWorldEntrance??state.authoredWorldEntrance,[4365,4060]);
    assert.deepEqual(state.threeCFixtureWorldXY,[4365,4045]);
    assert.ok(state.actorXYErrorPx<0.001);
    assert.deepEqual(state.proposedBehindIds,dy<0?["knight"]:[]);
    assert.deepEqual(state.proposedFrontIds,dy>=0?["knight"]:[]);
    for(const stat of Object.values(state.sourceRendererStats)){
     assert.ok(stat.tilesCreated<=3);
     assert.ok(stat.tilesCached<=24);
     assert.ok(stat.tilesVisible>0);
    }
    const screenshot="greyhaven_a234_"+browserName+"_"+label+".png";
    await page.screenshot({path:join(out,screenshot),fullPage:true});
    captures.push({screenshot,state});
   }
   const warmSamples=[];
   for(let i=0;i<20;i++){
    const s=await page.evaluate(()=>window.__a234RenderNext());
    warmSamples.push(s.sourceRendererStats);
   }
   assert.deepEqual(errors,[]);
   results.push({engine:browserName,version:await browser.version(),errors,captures,
    warmSampleCount:20,worldWarmP95Ms:p95(warmSamples.map(x=>x.world.ms)),
    composedWarmP95Ms:p95(warmSamples.map(x=>x.composite.ms)),
    worldTilesCreatedMax:Math.max(...warmSamples.map(x=>x.world.tilesCreated)),
    cacheBound:24,buildBound:3,
    gameFrameTimeClaimed:false,liveServerTested:false});
  }finally{await browser?.close();}
 }
 const report={milestone:"Blood & Iron A2.34 genuine first-party World #336 canvas renderer and artist-depth integration review",
  pinnedHeads:pins,sourceHashes,originalWorldRendererModuleLoaded:true,
  originalWorldUnmodified:true,redLionWorldPlaceholderStillDrawn:true,
  realOnlineClientExecuted:false,actualMultiplayerNetworkConnected:false,
  screenshots:results.reduce((s,b)=>s+b.captures.length,0),results,
  unmergedWorldBranchUsed:true,productionApproved:false};
 await writeFile(join(out,"greyhaven_a234_world_renderer_review_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("A234_WORLD="+JSON.stringify(results.map(r=>({engine:r.engine,version:r.version,
   screenshots:r.captures.length,errors:r.errors,
   worldP95Ms:r.worldWarmP95Ms,compositeP95Ms:r.composedWarmP95Ms,
   worldCreatedMax:r.worldTilesCreatedMax}))));
}finally{await new Promise(ok=>server.close(ok));}
