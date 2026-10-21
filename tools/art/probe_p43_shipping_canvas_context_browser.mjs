#!/usr/bin/env node
// Original Graphics 3C/World only. Optional LOCAL source QA, no shipping source edits.
// Compare live game {alpha:false} to prior QA {willReadFrequently:true} without
// putting getImageData() on the timed rendering contexts.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const world=resolve(process.argv[2]),out=resolve(process.argv[3]||"p43_shipping_context_original.json");
const head=dir=>execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
const pinnedParent="b52a787ecb1958b885c4c96fbef737a8e45d7599";
execFileSync("git",["-C",root,"merge-base","--is-ancestor",pinnedParent,"HEAD"]);
assert.equal(head(world),"3178b9aad8757ceb3594ff04b9e3099dced6b729");
assert.match(await readFile(join(root,"web/online-game.mjs"),"utf8"),
 /const ctx = canvas.getContext\("2d", \{ alpha: false \}\);/);
const files={
 "/src/browser/authored-world-renderer.mjs":join(root,"src/browser/authored-world-renderer.mjs"),
 "/src/browser/greyhaven-terrain-materials.mjs":join(root,"src/browser/greyhaven-terrain-materials.mjs"),
 "/src/browser/greyhaven-atmosphere.mjs":join(root,"src/browser/greyhaven-atmosphere.mjs"),
 "/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/src/world/building-presentation.mjs":join(world,"src/world/building-presentation.mjs")
};
const server=createServer(async(req,res)=>{
 const name=new URL(req.url,"http://127.0.0.1").pathname;
 if(name==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end("<!doctype html><title>P43 original Canvas context QA</title>");return;}
 if(name==="/favicon.ico"){res.writeHead(204);res.end();return;}
 if(!files[name]){res.writeHead(404);res.end();return;}
 try{const bytes=await readFile(files[name]);res.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-store"});res.end(bytes);}
 catch{res.writeHead(500);res.end("source unavailable");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const selectedEngines=process.env.P43_BROWSER_ENGINE
 ?[process.env.P43_BROWSER_ENGINE]:["chrome","firefox"];
assert.ok(selectedEngines.every(e=>e==="chrome"||e==="firefox"),
 "P43_BROWSER_ENGINE must be chrome or firefox");
const report={
 browserEngineSelection:selectedEngines,
 completeTwoBrowserMatrix:selectedEngines.length===2,
 purpose:"P43 shipping alpha:false vs prior willReadFrequently:true original Canvas timing",
 sources:{gfx3cParent:pinnedParent,world:head(world)},
 onlineGameContextPinned:true,gameClientRunning:false,noSourceEdits:true,runs:[]
};
try{
 for(const engine of selectedEngines){
  const options={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
  assert.ok(options.executablePath);
  if(engine==="chrome")options.args=["--no-sandbox","--disable-gpu-sandbox"];
  else{options.browser="firefox";options.protocol="webDriverBiDi";}
  const browser=await puppeteer.launch(options);
  try{
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   page.on("requestfailed",r=>errors.push("requestfailed "+r.url()));
   await page.setViewport({width:800,height:600,deviceScaleFactor:1});
   await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
   const data=await page.evaluate(async()=>{
    const [{createAuthoredWorldRenderer},{MAP_IDS}]=await Promise.all([
     import("/src/browser/authored-world-renderer.mjs"),
     import("/src/world/authored-maps.mjs")
    ]);
    const width=640,height=480,frames=48;
    const variants=[
     {name:"shipping-opaque",options:{alpha:false}},
     {name:"opaque-readfrequent",options:{alpha:false,willReadFrequently:true}},
     {name:"prior-qa-transparent-readfrequent",options:{willReadFrequently:true}},
     {name:"default-transparent",options:{}}
    ];
    function sample(i){return {x:4365+Math.sin(i/3)*85+i*2,y:4035+Math.cos(i/5)*68};}
    function createCase(variant){
     const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
     const ctx=canvas.getContext("2d",variant.options);
     const renderer=createAuthoredWorldRenderer({cacheCap:24,buildLimit:3});
     return {ctx,renderer,attrs:ctx.getContextAttributes?.()||null};
    }
    function draw(instance,i,zoom){
     const {ctx,renderer}=instance;
     ctx.clearRect(0,0,width,height);
     ctx.save();ctx.translate(width/2,height/2);ctx.scale(zoom,zoom);
     ctx.translate(-width/2,-height/2);
     const begin=performance.now();
     renderer.draw(ctx,MAP_IDS.overworld,sample(i),width,height,1);
     const elapsed=performance.now()-begin;ctx.restore();
     if(renderer.stats.created>3||renderer.stats.cached>24)throw Error("Original tile cache bound violated");
     return {ms:+elapsed.toFixed(3),coldTiles:renderer.stats.created,cached:renderer.stats.cached};
    }
    const percentile=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)];
    const results=[];
    for(const zoom of [.84,1]){
     // Use throwaway canvases with readback for strict pixel parity; these are
     // never reused by the benchmark. A separate control for each candidate.
     for(const q of variants.slice(1)){
      const base=createCase(variants[0]),candidate=createCase(q);
      let differingBytes=0,differingFrames=0,maxChanged=0;
      for(let i=0;i<16;i++){
       draw(base,i,zoom);draw(candidate,i,zoom);
       const a=base.ctx.getImageData(0,0,width,height).data;
       const b=candidate.ctx.getImageData(0,0,width,height).data;
       let changed=0;for(let j=0;j<a.length;j++)if(a[j]!==b[j])changed++;
       if(changed){differingFrames++;differingBytes+=changed;maxChanged=Math.max(maxChanged,changed);}
      }
      results.push({phase:"pixel",zoom,name:q.name,frames:16,differingBytes,differingFrames,maxChanged});
     }
     // No getImageData on any of these timing contexts: avoid a readback-induced
     // software path contaminating the very Canvas performance being measured.
     for(let trial=0;trial<2;trial++){
      const sequence=trial===0?variants:[...variants].reverse();
      for(const v of sequence){
       const instance=createCase(v),measures=[];
       for(let i=0;i<frames;i++)measures.push(draw(instance,i,zoom));
       const warm=measures.filter(x=>x.coldTiles===0).map(x=>x.ms);
       results.push({phase:"timing",zoom,trial,name:v.name,attrs:instance.attrs,
        frames,created:measures.reduce((a,x)=>a+x.coldTiles,0),warmFrames:warm.length,
        warmTotalMs:+warm.reduce((a,b)=>a+b,0).toFixed(3),
        warmP95Ms:warm.length?percentile(warm,.95):null,
        totalMs:+measures.reduce((a,x)=>a+x.ms,0).toFixed(3),
        samples:measures});
      }
     }
    }
    return {results};
   });
   report.runs.push({engine,version:await browser.version(),errors,...data});
   console.log(JSON.stringify({engine,version:await browser.version(),errors,
     metrics:data.results.filter(r=>r.phase==="timing").map(r=>({name:r.name,zoom:r.zoom,trial:r.trial,total:r.totalMs,warm:r.warmTotalMs,warmP95:r.warmP95Ms})),
     parity:data.results.filter(r=>r.phase==="pixel")}));
  }finally{await browser.close()}
 }
}finally{
 await new Promise(ok=>server.close(ok));
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+"\n");
}
