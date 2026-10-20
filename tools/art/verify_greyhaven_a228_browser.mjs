#!/usr/bin/env node
// Genuine localhost-only A2.28 Red Lion facade/lighting review on Chrome + Firefox.
// First-party baked assets, independent pinned PR326 knight. No runtime integration.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,join,extname,relative} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";

const graphics=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const knightCheckout=resolve(process.argv[2]||"");
const out=resolve(process.argv[3]||join(graphics,".a228-browser"));
assert.ok(process.argv[2],"Pass independently pinned PR #326 checkout");
const knightHead="c74fcf90e227f3bc4788728f000cfe6aa083c7ef";
assert.equal(execFileSync("git",["-C",knightCheckout,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),knightHead);
const knightSource=await readFile(join(knightCheckout,"web/knight-sprites.mjs"),"utf8");
assert.match(knightSource,/KNIGHT_PRESENTATION_SCALE = 1\.2/);
const knightDir=join(knightCheckout,"web/assets/knights");
const allowed=new Set(["silver_idle.webp","asset-build-report.json"]);
const bytes=await readFile(join(knightDir,"silver_idle.webp"));
const atlasHash=createHash("sha256").update(bytes).digest("hex");
assert.equal(atlasHash,"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
const types={".json":"application/json",".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".webp":"image/webp",".png":"image/png"};
const server=createServer(async (request,response)=>{
 try{
  const pathname=decodeURIComponent(new URL(request.url,"http://127.0.0.1").pathname);
  let filename;
  if(pathname.startsWith("/__a228_knights__/")){
   const basename=pathname.slice("/__a228_knights__/".length);
   if(!allowed.has(basename)){response.writeHead(404);response.end();return;}
   filename=join(knightDir,basename);
  }else{
   filename=resolve(graphics,"."+pathname);
   const rel=relative(graphics,filename);
   if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")){
    response.writeHead(404);response.end();return;
   }
  }
  if(!existsSync(filename)){response.writeHead(404);response.end();return;}
  const buffer=await readFile(filename);
  response.writeHead(200,{"Content-Type":types[extname(filename)]||"application/octet-stream",
    "Cache-Control":"no-store"});
  response.end(buffer);
 }catch(error){response.writeHead(500);response.end("Local art read failed");}
});
await mkdir(out,{recursive:true});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const url="http://127.0.0.1:"+server.address().port+"/web/greyhaven-a228-facade-browser.html";
const results=[];
try{
 for(const mode of ["chrome","firefox"]){
  let browser;
  try{
   const launch={headless:true,executablePath:mode==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE,
    args:mode==="chrome"?["--no-sandbox","--disable-gpu-sandbox"]:[]};
   if(mode==="firefox"){launch.browser="firefox";launch.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(launch);
   const page=await browser.newPage();
   await page.setViewport({width:2010,height:1010,deviceScaleFactor:1});
   const errors=[];
   page.on("pageerror",error=>errors.push(error.message));
   page.on("response",response=>{if(response.status()>=400)errors.push("HTTP "+response.status()+" "+response.url());});
   await page.goto(url,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>window.__a228Review?.()?.ready,{timeout:16000});
   async function capture(dx,dy,kind){
    const state=await page.evaluate(async ({dx,dy})=>{
     for(const [key,val] of Object.entries({east:dx,south:dy})){
      const elem=document.getElementById(key);
      elem.value=String(val);
      elem.dispatchEvent(new Event("input",{bubbles:true}));
     }
     await new Promise(resolve=>requestAnimationFrame(resolve));
     return window.__a228Review();
    },{dx,dy});
    assert.equal(state.ready,true);
    assert.equal(state.sourceKnightHead,knightHead);
    assert.equal(state.dx,dx);
    assert.equal(state.dy,dy);
    assert.ok(state.gameXYErrorPx<0.001);
    assert.equal(state.sourceToDay.alphaPixelDifferences,0);
    assert.equal(state.sourceToDusk.alphaPixelDifferences,0);
    assert.ok(state.sourceToDay.changedCanvasPixels>4000);
    assert.ok(state.sourceToDusk.changedCanvasPixels>4000);
    assert.equal(state.roofBinaryIdentical,true);
    assert.equal(state.authoritativePortalValidated,false);
    assert.equal(state.dynamicRoofOcclusionValidated,false);
    assert.equal(state.networkGameplayModified,false);
    assert.equal(state.productionApproved,false);
    await page.screenshot({path:join(out,"greyhaven_a228_"+mode+"_"+kind+".png"),fullPage:true});
    return state;
   }
   const entrance=await capture(0,0,"entrance");
   const east=await capture(80,-10,"east80");
   assert.deepEqual(errors,[]);
   results.push({browser:mode,version:await browser.version(),errors,
     screenshots:2,entrance,east,
     type:"isolated Chrome/Firefox original Canvas art preview only",
     multiplayerPerformanceVerified:false,automaticLightingEngineValidated:false,
     physicalOcclusionValidated:false,productionApproved:false});
  }finally{if(browser)await browser.close();}
 }
 const report={milestone:"Blood & Iron A2.28 Chrome and Firefox original facade lighting art review",
   authenticKnightHead:knightHead,originalKnightIdleSha256:atlasHash,
   actualProjectionModule:"src/browser/arena-viewport.mjs",results,
   originalRoofModified:false,sourceBlenderModified:false,gameRuntimeModified:false,
   playerCombatReadabilityValidated:false,measuredFrameTimesNotLiveGame:true,
   productionApproved:false};
 await writeFile(join(out,"greyhaven_a228_native_browser_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("A228_BROWSER="+JSON.stringify(results.map(r=>({browser:r.browser,version:r.version,
  screenshots:r.screenshots,errors:r.errors,xyError:r.east.gameXYErrorPx,
  sourceDayPixels:r.east.sourceToDay.changedCanvasPixels,
  sampledSingleCanvasDrawMs:r.east.frameRenderSamplesMs.day}))));
}finally{await new Promise(done=>server.close(done));}
