#!/usr/bin/env node
// A2.30 localhost-only genuine Chrome/Firefox source geometry art acceptance.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2],"Pass independently fetched exact-head Knight PR326");
const knight=resolve(process.argv[2]),out=resolve(process.argv[3]||join(root,".a230-browser"));
const head="c74fcf90e227f3bc4788728f000cfe6aa083c7ef";
assert.equal(execFileSync("git",["-C",knight,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),head);
const originalKnightDir=join(knight,"web/assets/knights");
const sha=createHash("sha256").update(await readFile(join(originalKnightDir,"silver_idle.webp"))).digest("hex");
assert.equal(sha,"828cf05dd873d0c8f35e887f5e46c35af87f084ac321977e358c985e7a2106b4");
const allowed=new Set([
 "web/greyhaven-a230-dimensional-browser.html",
 "web/greyhaven-a230-dimensional-browser.mjs",
 "src/browser/arena-viewport.mjs",
 "assets/environment/greyhaven/red-lion-a225-architecture-handoff.json",
 "assets/environment/greyhaven/a230-review/greyhaven_a230_material_validation.json",
 "assets/environment/greyhaven/a230-review/greyhaven_a230_original_source_integrity.json",
 "assets/environment/greyhaven/a230-review/red_lion_a230_original_base.webp",
 "assets/environment/greyhaven/a230-review/red_lion_a230_dimensional_base.webp",
 "assets/environment/greyhaven/a230-review/red_lion_a230_roof_unchanged.webp"
]);
const knightFiles=new Set(["asset-build-report.json","silver_idle.webp"]);
const types={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".json":"application/json",
 ".webp":"image/webp",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const p=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let fname;
  if(p.startsWith("/__a230_knights__/")){
   const name=p.slice("/__a230_knights__/".length);
   if(!knightFiles.has(name)){res.writeHead(404);res.end();return;}
   fname=join(originalKnightDir,name);
  }else{
   fname=resolve(root,"."+p);
   const rel=relative(root,fname).replaceAll("\\","/");
   if(!allowed.has(rel)){res.writeHead(404);res.end();return;}
  }
  if(!existsSync(fname)){res.writeHead(404);res.end();return;}
  const b=await readFile(fname);
  res.writeHead(200,{"Cache-Control":"no-store","Content-Type":types[extname(fname)]||"application/octet-stream"});
  res.end(b);
 }catch(e){res.writeHead(500);res.end("local QA failure");}
});
await mkdir(out,{recursive:true});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const url="http://127.0.0.1:"+server.address().port+"/web/greyhaven-a230-dimensional-browser.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const reviews=[];
try{
 for(const mode of ["chrome","firefox"]){
  let browser;
  try{
   const opt={headless:true,executablePath:mode==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(mode==="firefox"){opt.browser="firefox";opt.protocol="webDriverBiDi";}
   else opt.args=["--no-sandbox","--disable-gpu-sandbox"];
   browser=await puppeteer.launch(opt);
   const page=await browser.newPage();
   await page.setViewport({width:1460,height:970,deviceScaleFactor:1});
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push(r.status()+" "+r.url());});
   await page.goto(url,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>window.__a230Review?.()?.ready,{timeout:12000});
   const observations=[];
   for(const [dx,dy,scenario] of [[0,0,"door"],[80,-10,"street"]]){
    const state=await page.evaluate(async ({dx,dy})=>{
     for(const [id,v] of Object.entries({east:dx,south:dy})){
      const element=document.getElementById(id);
      element.value=String(v);element.dispatchEvent(new Event("input",{bubbles:true}));
     }
     await new Promise(requestAnimationFrame);
     return window.__a230Review();
    },{dx,dy});
    assert.equal(state.ready,true);
    assert.equal(state.dx,dx);assert.equal(state.dy,dy);
    assert.equal(state.newSourceMeshes,35);
    assert.equal(state.originalBlenderSourceIntegrity,true);
    assert.equal(state.roofUnchanged,true);
    assert.equal(state.authoritativePortalValidated,false);
    assert.equal(state.automaticOcclusionValidated,false);
    assert.equal(state.actualGameRendererValidated,false);
    assert.equal(state.productionApproved,false);
    assert.ok(state.changedOnScreenRGBPixels>1000);
    assert.equal(state.onScreenAlphaDifferences,0);
    assert.ok(state.gameXYErrorPx<.001);
    const screenshot="greyhaven_a230_"+mode+"_"+scenario+".png";
    await page.screenshot({path:join(out,screenshot),fullPage:true});
    observations.push({screenshot,state});
   }
   assert.deepEqual(errors,[]);
   reviews.push({engine:mode,version:await browser.version(),screenCaptures:2,errors,observations,
      realMultiplayerValidated:false,gameplayFPSValidated:false,productionApproved:false});
  }finally{await browser?.close();}
 }
 const report={milestone:"Blood & Iron A2.30 original dimensional Blender facade Chrome/Firefox source-art review",
  authenticKnightHead:head,originalKnightSha256:sha,projection:"src/browser/arena-viewport.mjs",
  nativeBrowsers:reviews,sourceGeometryNotCollision:true,originalRoofUnchanged:true,
  dynamicRoofOcclusionValidated:false,gameRuntimeIntegrated:false,productionApproved:false};
 await writeFile(join(out,"greyhaven_a230_browser_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("A230_BROWSER="+JSON.stringify(reviews.map(v=>({engine:v.engine,version:v.version,
  screenshots:v.screenCaptures,errors:v.errors.length,
  rgb:v.observations[1].state.changedOnScreenRGBPixels,groundErrorPx:v.observations[1].state.gameXYErrorPx}))));
}finally{await new Promise(resolve=>server.close(resolve));}
