// Graphics 3C P44: bounded native Chrome/Firefox authored scene parity.
// Compare *unchanged* prior 3C P43 renderer vs adapted 571+3C candidate using
// original World #571 maps and World-owned Red Lion replacement validator.
// Does NOT connect to online game or prove actor/items/authoritative gameplay.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {join,resolve,dirname,parse} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const integration=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const gfxBaseline=resolve(process.argv[2]);
const output=resolve(process.argv[3]||"p44_world571_3c_render_parity.json");
const head=dir=>execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
const baselinePin="ef78df8b065a03399c0047e785587e707852bc07";
const worldParent="9139ce3b4290bd7b1a5efe4b90b3edcc8d15db59";
assert.equal(head(gfxBaseline),baselinePin);
execFileSync("git",["-C",integration,"merge-base","--is-ancestor",worldParent,"HEAD"]);
const files={}, sourceHashes={};
for(const version of ["baseline","candidate"]){
 const visual=version==="baseline"?gfxBaseline:integration;
 const origin=integration;
 const names={
  "src/browser/authored-world-renderer.mjs":join(visual,"src/browser/authored-world-renderer.mjs"),
  "src/browser/greyhaven-terrain-materials.mjs":join(visual,"src/browser/greyhaven-terrain-materials.mjs"),
  "src/browser/greyhaven-atmosphere.mjs":join(visual,"src/browser/greyhaven-atmosphere.mjs"),
  "src/world/authored-maps.mjs":join(origin,"src/world/authored-maps.mjs"),
  "src/world/building-presentation.mjs":join(origin,"src/world/building-presentation.mjs")
 };
 for(const [route,p] of Object.entries(names)){
  const key="/"+version+"/"+route;
  files[key]=p;
  sourceHashes[key]=createHash("sha256").update(await readFile(p)).digest("hex");
 }
}
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,"http://127.0.0.1").pathname;
 if(pathname==="/"){res.writeHead(200,{"Content-Type":"text/html"});res.end("<!doctype html><title>P44 source exact renderer comparison</title>");return;}
 if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
 if(!files[pathname]){res.writeHead(404);res.end("not allowed");return;}
 try{
  res.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-store"});
  res.end(await readFile(files[pathname]));
 }catch(e){res.writeHead(500);res.end(String(e))}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const selection=process.env.P44_BROWSER_ENGINE?[process.env.P44_BROWSER_ENGINE]:["chrome","firefox"];
assert.ok(selection.every(x=>x==="chrome"||x==="firefox"));
const report={
 purpose:"Original P43 Graphics 3C vs integrated P44 renderer city and Red Lion visual pixel parity",
 heads:{baseline:head(gfxBaseline),integrationBase:worldParent,integrationCurrent:head(integration)},
 originalWorldMapsMatch:sourceHashes["/baseline/src/world/authored-maps.mjs"]===sourceHashes["/candidate/src/world/authored-maps.mjs"],
 enginesRequested:selection,fullChromeFirefoxMatrix:selection.length===2,
 originalUnmodified:true,serverAuthoritative:false,players:0,
 sourceHashes,results:[]
};
try{
 for(const engine of selection){
  const options={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
  assert.ok(options.executablePath,"Browser missing: "+engine);
  if(engine==="chrome") options.args=["--no-sandbox","--disable-gpu-sandbox"];
  else {options.browser="firefox";options.protocol="webDriverBiDi";}
  const browser=await puppeteer.launch(options);
  try{
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push("pageerror: "+String(e)));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   await page.setViewport({width:800,height:640,deviceScaleFactor:1});
   await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
   const run=await page.evaluate(async()=>{
    const [{createAuthoredWorldRenderer:baseline},
     {createAuthoredWorldRenderer:candidate},
     {normalizeWorldBuildingReplacementIds},
     {MAP_IDS}]=await Promise.all([
     import("/baseline/src/browser/authored-world-renderer.mjs"),
     import("/candidate/src/browser/authored-world-renderer.mjs"),
     import("/candidate/src/world/building-presentation.mjs"),
     import("/candidate/src/world/authored-maps.mjs")
    ]);
    const width=640,height=480;
    const cases=[
     {id:"tavern-day",camera:{x:4365,y:4075},zoom:.84,replace:false},
     {id:"tavern-replaced",camera:{x:4365,y:4075},zoom:.84,replace:true},
     {id:"tavern-pan",camera:{x:4250,y:4010},zoom:1,replace:false},
     {id:"blacksmith",camera:{x:3780,y:3970},zoom:.84,replace:false},
     {id:"south-city",camera:{x:4185,y:4600},zoom:1.2,replace:false},
     {id:"northern-wilderness",camera:{x:2550,y:2100},zoom:.84,replace:false}
    ];
    const results=[];
    for(const spec of cases){
     const buffers=[];
     for(const build of [baseline,candidate]){
      const c=document.createElement("canvas");c.width=width;c.height=height;
      const ctx=c.getContext("2d",{alpha:false,willReadFrequently:true});
      const r=build({buildLimit:3,cacheCap:24,
       ...(spec.replace?{replacedBuildingIds:["red-lion"],
        worldReplacementValidator:normalizeWorldBuildingReplacementIds}:{})});
      for(let i=0;i<5;i++){
       ctx.clearRect(0,0,width,height);
       ctx.save();ctx.translate(width/2,height/2);
       ctx.scale(spec.zoom,spec.zoom);ctx.translate(-width/2,-height/2);
       r.draw(ctx,MAP_IDS.overworld,spec.camera,width,height,1);
       ctx.restore();
      }
      if(r.stats.cached>24||r.stats.created>3)throw Error("Cache creation contract drift");
      buffers.push({bytes:ctx.getImageData(0,0,width,height).data,cached:r.stats.cached,replacements:[...r.replacedBuildingIds]});
     }
     let diffBytes=0,diffPixels=0;
     for(let p=0;p<buffers[0].bytes.length;p+=4){
      const a=buffers[0].bytes,b=buffers[1].bytes;
      let changed=false;
      for(let k=0;k<4;k++)if(a[p+k]!==b[p+k]){diffBytes++;changed=true;}
      if(changed)diffPixels++;
     }
     results.push({id:spec.id,zoom:spec.zoom,replaced:spec.replace,
       baselineCached:buffers[0].cached,candidateCached:buffers[1].cached,
       baselineReplacements:buffers[0].replacements,candidateReplacements:buffers[1].replacements,
       changedBytes:diffBytes,changedPixels:diffPixels});
    }
    return results;
   });
   report.results.push({engine,version:await browser.version(),errors,cases:run});
   console.log(JSON.stringify({engine,version:await browser.version(),errors,cases:run}));
  }finally{await browser.close();}
 }
}finally{
 await new Promise(ok=>server.close(ok));
 const parent=dirname(output);
 if(parent!==parse(output).root)await mkdir(parent,{recursive:true});
 await writeFile(output,JSON.stringify(report,null,2)+"\n");
}
