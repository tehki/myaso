// P0 Graphics 3C test only: original World #521 validator, real 3C painter.
// No gameplay, actor, server, item, portal activation or production changes.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join,extname} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const world=resolve(process.argv[2]||"");
const out=resolve(process.argv[3]||"assets/environment/greyhaven/3c-p37-world521-review");
const worldHead="3178b9aad8757ceb3594ff04b9e3099dced6b729";
const gfx=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const head=p=>execFileSync("git",["-C",p,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(head(world),worldHead,"World source must be exact #521 SHA");
const graphicsHead=head(gfx);
if(process.env.GRAPHICS_3C_EXPECTED_HEAD)
 assert.equal(graphicsHead,process.env.GRAPHICS_3C_EXPECTED_HEAD);
const files={
 "/src/browser/authored-world-renderer.mjs":join(gfx,"src/browser/authored-world-renderer.mjs"),
 "/src/browser/greyhaven-terrain-materials.mjs":join(gfx,"src/browser/greyhaven-terrain-materials.mjs"),
 "/src/browser/greyhaven-atmosphere.mjs":join(gfx,"src/browser/greyhaven-atmosphere.mjs"),
 "/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/src/world/building-presentation.mjs":join(world,"src/world/building-presentation.mjs")
};
const sha=async f=>createHash("sha256").update(await readFile(f)).digest("hex");
assert.equal(await sha(join(gfx,"src/world/authored-maps.mjs")),
 await sha(files["/src/world/authored-maps.mjs"]),
 "Graphics 3C World map and pinned World #521 source must match");
const hashes={};
for(const [name,path] of Object.entries(files))hashes[name]=await sha(path);
const html='<!doctype html><meta charset="utf-8"><title>3C World facade ART ONLY</title>'+
 '<style>body{background:#151a17;color:white;font:13px Arial;margin:8px}#view{display:grid;grid-template-columns:640px 640px;gap:5px}figure{margin:0}figcaption{padding:5px}</style>'+
 '<div id="view"></div>';
const server=createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,"http://127.0.0.1").pathname;
  if(p==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(html);return;}
  if(p==="/favicon.ico"){res.writeHead(204);res.end();return;}
  const file=files[p];
  if(!file){res.writeHead(404);res.end("Not on source allowlist");return;}
  const bytes=await readFile(file);
  res.writeHead(200,{"Content-Type":extname(file)===".mjs"?"text/javascript; charset=utf-8":"application/octet-stream","Cache-Control":"no-store"});
  res.end(bytes);
 }catch(e){res.writeHead(500);res.end("Source unavailable")}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
await mkdir(out,{recursive:true});
const report={
 pins:{world521:worldHead,graphics3cAtCapture:graphicsHead},sourceHashes:hashes,
 scope:"Original World validator + actual 3C cached Canvas pixel test only",
 results:[],release:{actualPlayers:false,actualRedLionFacadeAsset:false,
 authoritativeZones:false,actualItemPickup:false,productionApproved:false}
};
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const options={headless:true,
    executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   assert.ok(options.executablePath,"Missing "+engine+" executable");
   if(engine==="firefox"){options.browser="firefox";options.protocol="webDriverBiDi";}
   else options.args=["--no-sandbox","--disable-gpu-sandbox"];
   browser=await puppeteer.launch(options);
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(String(e)));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url())});
   await page.setViewport({width:1300,height:1100,deviceScaleFactor:1});
   const resp=await page.goto("http://127.0.0.1:"+server.address().port+"/",{waitUntil:"domcontentloaded"});
   assert.equal(resp.status(),200);
   const outcome=await page.evaluate(async()=>{
    const {createAuthoredWorldRenderer}=await import("/src/browser/authored-world-renderer.mjs");
    const {MAP_IDS,getAuthoredMap}=await import("/src/world/authored-maps.mjs");
    const {normalizeWorldBuildingReplacementIds,WORLD_ALPHA_REPLACEABLE_BUILDING_IDS}=
       await import("/src/world/building-presentation.mjs");
    const map=getAuthoredMap(MAP_IDS.overworld);
    if(JSON.stringify(WORLD_ALPHA_REPLACEABLE_BUILDING_IDS)!=='["red-lion"]')throw Error("World original allowlist changed");
    const red=map.buildings.find(b=>b.id==="red-lion"),smith=map.buildings.find(b=>b.id==="smith");
    if(!red||!smith)throw Error("Original authored city building missing");
    const neg=[()=>createAuthoredWorldRenderer({replacedBuildingIds:["red-lion"]}),
      ()=>createAuthoredWorldRenderer({replacedBuildingIds:["smith"],worldReplacementValidator:normalizeWorldBuildingReplacementIds}),
      ()=>createAuthoredWorldRenderer({replacedBuildingIds:["red-lion","red-lion"],worldReplacementValidator:normalizeWorldBuildingReplacementIds})];
    for(const f of neg){let fails=false;try{f()}catch(e){fails=e instanceof RangeError}if(!fails)throw Error("Unapproved replacement accepted");}
    const view=document.querySelector("#view");
    function paint(label,b,replace){
     const fig=document.createElement("figure"),heading=document.createElement("figcaption");
     heading.textContent=label+" (ART-ONLY)";fig.appendChild(heading);
     const c=document.createElement("canvas");c.width=640;c.height=480;fig.appendChild(c);view.appendChild(fig);
     const ctx=c.getContext("2d",{willReadFrequently:true});
     const renderer=createAuthoredWorldRenderer({
       buildLimit:8,cacheCap:24,
       ...(replace?{replacedBuildingIds:["red-lion"],worldReplacementValidator:normalizeWorldBuildingReplacementIds}:{})
     });
     renderer.draw(ctx,MAP_IDS.overworld,{x:b.x+b.w/2,y:b.y+b.h/2},640,480,1);
     if(renderer.stats.created===0)throw Error("Missing canvas tiles");
     return {pixels:ctx.getImageData(0,0,640,480).data,
       created:renderer.stats.created,ids:[...renderer.replacedBuildingIds]};
    }
    const redDefault=paint("Red Lion World placeholder ON",red,false);
    const redReplaced=paint("Red Lion World placeholder OFF",red,true);
    const smithDefault=paint("Blacksmith normal",smith,false);
    const smithReplaced=paint("Blacksmith same under Red Lion-only option",smith,true);
    function difference(a,b){
      let count=0;
      for(let i=0;i<a.length;i+=4)
       if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])count++;
      return count;
    }
    return {redLionChanged:difference(redDefault.pixels,redReplaced.pixels),
      smithChanged:difference(smithDefault.pixels,smithReplaced.pixels),
      createdTiles:[redDefault.created,redReplaced.created,smithDefault.created,smithReplaced.created],
      defaultIds:redDefault.ids,normalizedIds:redReplaced.ids};
   });
   assert.deepEqual(outcome.normalizedIds,["red-lion"]);
   assert.deepEqual(outcome.defaultIds,[]);
   assert.ok(outcome.redLionChanged>500,"World approved Red Lion suppression should visibly change the facade");
   assert.equal(outcome.smithChanged,0,"Blacksmith must be byte-identical");
   assert.deepEqual(errors,[]);
   const screenshot="world521_red_lion_3c_"+engine+".png";
   await page.screenshot({path:join(out,screenshot),fullPage:true});
   report.results.push({browser:engine,version:await browser.version(),...outcome,
     screenshot,pageErrors:errors,realFacadeRendered:false,realActorsTested:false});
  }finally{await browser?.close()}
 }
 report.status="WORLD521_3C_SOURCE_PIXELS_PASS";
 await writeFile(join(out,"world521_3c_facade_pixels.json"),JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({status:report.status,results:report.results.map(x=>({
    browser:x.browser,redLionChanged:x.redLionChanged,smithChanged:x.smithChanged,tiles:x.createdTiles
 }))},null,2));
}finally{await new Promise(ok=>server.close(ok))}
