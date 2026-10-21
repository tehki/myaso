#!/usr/bin/env node
// P42 exploratory/offline diagnostic only. No original rendering source edits.
// Compare ordinary 512px Canvas cache to OffscreenCanvas and transferred ImageBitmap
// under EXACT same authored World #521 camera/zoom (pixel-perfect requirement).
import assert from "node:assert/strict";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createServer} from "node:http";
import {resolve,join,extname,dirname} from "node:path";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const world=resolve(process.argv[2]);
const output=resolve(process.argv[3]||"p42_tile_source_qa.json");
const head=dir=>execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
const baseline="433d6151d5148b3a4c38300df14cffa19e3aa003";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",baseline,"HEAD"]);
assert.equal(execFileSync("git",["-C",root,"diff","--name-only",baseline,"HEAD","--","src/browser/authored-world-renderer.mjs"],{encoding:"utf8"}).trim(),"","Pinned shipping 3C painter differs from P40 baseline");
assert.equal(head(world),"3178b9aad8757ceb3594ff04b9e3099dced6b729");
const routes={
 "/src/browser/authored-world-renderer.mjs":join(root,"src/browser/authored-world-renderer.mjs"),
 "/src/browser/greyhaven-terrain-materials.mjs":join(root,"src/browser/greyhaven-terrain-materials.mjs"),
 "/src/browser/greyhaven-atmosphere.mjs":join(root,"src/browser/greyhaven-atmosphere.mjs"),
 "/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/src/world/building-presentation.mjs":join(world,"src/world/building-presentation.mjs")
};
const source=await readFile(routes["/src/browser/authored-world-renderer.mjs"],"utf8");
const marker="    return texture;";
assert.equal(source.split(marker).length,2);
const bitmapSource=source.replace(marker,
  "    return texture.transferToImageBitmap(); // QA-only OffscreenCanvas bitmap test");
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  if(url.pathname==="/"){res.writeHead(200,{"Content-Type":"text/html"});res.end("<!doctype html><title>P42 source QA</title>");return;}
  if(url.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const file=routes[url.pathname];if(!file){res.writeHead(404);res.end();return;}
  const data=url.searchParams.get("bitmap")==="1"&&url.pathname==="/src/browser/authored-world-renderer.mjs"?bitmapSource:await readFile(file);
  res.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-store"});res.end(data);
 }catch(e){res.writeHead(500);res.end(String(e))}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const report={experiment:"P42 3C exact original vs OffscreenCanvas and transferToImageBitmap",
 worldHead:head(world),graphicsHead:head(root),noShippedChanges:true,runs:[]};
try{
 for(const engine of ["chrome","firefox"]){
  const args={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
  assert.ok(args.executablePath);
  if(engine==="chrome")args.args=["--no-sandbox","--disable-gpu-sandbox"];
  else{args.browser="firefox";args.protocol="webDriverBiDi";}
  const browser=await puppeteer.launch(args);
  try{
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:800,height:640,deviceScaleFactor:1});
   await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
   const data=await page.evaluate(async()=>{
    const [{createAuthoredWorldRenderer:make}, {createAuthoredWorldRenderer:makeBitmap},
      {MAP_IDS}]=await Promise.all([
       import("/src/browser/authored-world-renderer.mjs"),
       import("/src/browser/authored-world-renderer.mjs?bitmap=1"),
       import("/src/world/authored-maps.mjs")
    ]);
    const width=640,height=480,results=[],frames=32;
    if(typeof OffscreenCanvas!=="function")return {offscreenSupported:false};
    for(const zoom of [.84,1,1.2]){
     for(const [name,makeAlt,opts] of [
       ["offscreen",make,{makeCanvas:()=>new OffscreenCanvas(512,512)}],
       ["bitmap",makeBitmap,{makeCanvas:()=>new OffscreenCanvas(512,512)}]
     ]){
      const orig=make({buildLimit:3,cacheCap:24});
      const alt=makeAlt({buildLimit:3,cacheCap:24,...opts});
      const originalCanvas=document.createElement("canvas"),alteredCanvas=document.createElement("canvas");
      originalCanvas.width=alteredCanvas.width=width;originalCanvas.height=alteredCanvas.height=height;
      const origCtx=originalCanvas.getContext("2d",{willReadFrequently:true});
      const altCtx=alteredCanvas.getContext("2d",{willReadFrequently:true});
      let differingBytes=0,differingFrames=0,maxPixelDiffs=0,firstMismatch=null;
      let normalMs=0,alternativeMs=0,normalWarmMs=0,altWarmMs=0;
      let cachedMin=Infinity,cachedMax=0,coldTiles=0;
      for(let i=0;i<frames;i++){
       const camera=i%2===0
        ?{x:4365+Math.sin(i/3)*85,y:4035+Math.cos(i/4)*60}
        :{x:4050+i*8,y:4035+Math.sin(i/5)*28};
       function draw(ctx,r){
        ctx.clearRect(0,0,width,height);
        ctx.save();
        ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);
        ctx.translate(-width/2,-height/2);
        const t=performance.now();
        r.draw(ctx,MAP_IDS.overworld,camera,width,height,1);
        const ms=performance.now()-t;
        ctx.restore();return ms;
       }
       const a=draw(origCtx,orig),b=draw(altCtx,alt);
       normalMs+=a;alternativeMs+=b;
       if(i>=10){normalWarmMs+=a;altWarmMs+=b}
       coldTiles+=alt.stats.created;
       cachedMin=Math.min(cachedMin,alt.stats.cached);cachedMax=Math.max(cachedMax,alt.stats.cached);
       const aa=origCtx.getImageData(0,0,width,height).data;
       const bb=altCtx.getImageData(0,0,width,height).data;
       let bad=0;
       for(let p=0;p<aa.length;p++)if(aa[p]!==bb[p])bad++;
       if(bad){differingFrames++;differingBytes+=bad;maxPixelDiffs=Math.max(maxPixelDiffs,bad);firstMismatch??={frame:i,bad,zoom,name};}
      }
      results.push({name,zoom,frames,differingFrames,differingBytes,maxPixelDiffs,firstMismatch,
       totalBaselineMs:+normalMs.toFixed(2),totalAlternativeMs:+alternativeMs.toFixed(2),
       warmBaselineMs:+normalWarmMs.toFixed(2),warmAlternativeMs:+altWarmMs.toFixed(2),
       coldTiles,cachedMin,cachedMax});
     }
    }
    return {offscreenSupported:true,results};
   });
   report.runs.push({engine,version:await browser.version(),errors,...data});
   console.log(JSON.stringify({engine,version:await browser.version(),errors,results:data.results}));
  }finally{await browser.close()}
 }
}finally{
 await new Promise(r=>server.close(r));
 await mkdir(dirname(output),{recursive:true});
 await writeFile(output,JSON.stringify(report,null,2)+"\n");
}
