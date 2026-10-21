#!/usr/bin/env node
// Moon Games Graphics 3C P0: genuine Chrome/Firefox 3B art over 3C terrain.
// ONLY source-art QA. The browser demo uses explicitly synthetic "ART-ONLY"
// items; no real sword ownership, player input gate, combat or pickup authority.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join,extname,basename} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {cpus,platform,release} from "node:os";
import {fileURLToPath} from "node:url";

const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const graphics3c=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const [worldPath,graphics3bPath,outArg="assets/environment/greyhaven/3c-p32-composite-review"]=process.argv.slice(2);
const world=resolve(worldPath||""),graphics3b=resolve(graphics3bPath||"");
const output=resolve(outArg);
const pins={
 world:"07060f981b8a1dac89184b621b6893dd970a08ae",
 graphics3b:"2a11b923591a682bbae3cffe6d9f70b0d2036de8"
};
function head(dir){return execFileSync("git",["-C",dir,"rev-parse","HEAD"],{encoding:"utf8"}).trim();}
assert.equal(head(world),pins.world,"World checkout must be exact PR #493 source");
assert.equal(head(graphics3b),pins.graphics3b,"3B checkout must be exact PR #508 source");
const graphics3cHead=head(graphics3c);
if(process.env.GRAPHICS_3C_EXPECTED_HEAD)assert.equal(graphics3cHead,process.env.GRAPHICS_3C_EXPECTED_HEAD);

const artAllowed={
 "/web/armory-p0-world493-review.html":join(graphics3b,"web/armory-p0-world493-review.html"),
 "/web/armory-p0-world493-review.mjs":join(graphics3b,"web/armory-p0-world493-review.mjs"),
 "/src/browser/armory-rack-visual.mjs":join(graphics3b,"src/browser/armory-rack-visual.mjs"),
 "/src/browser/armory-world493-visual-bridge.mjs":join(graphics3b,"src/browser/armory-world493-visual-bridge.mjs"),
 "/src/browser/arena-viewport.mjs":join(graphics3b,"src/browser/arena-viewport.mjs"),
 "/assets/environment/greyhaven/armory-p0/armory_rack.webp":join(graphics3b,"assets/environment/greyhaven/armory-p0/armory_rack.webp"),
 "/assets/environment/greyhaven/armory-p0/armory_sword.webp":join(graphics3b,"assets/environment/greyhaven/armory-p0/armory_sword.webp")
};
const fixedWorld={
 "/__world493__/src/world/alpha-armory.mjs":join(world,"src/world/alpha-armory.mjs"),
 "/__world493__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs")
};
const versionRenderer={
 world493:join(world,"src/browser/authored-world-renderer.mjs"),
 graphics3c:join(graphics3c,"src/browser/authored-world-renderer.mjs")
};
const graphicsModules={
 "/__world493__/src/browser/greyhaven-terrain-materials.mjs":join(graphics3c,"src/browser/greyhaven-terrain-materials.mjs"),
 "/__world493__/src/browser/greyhaven-atmosphere.mjs":join(graphics3c,"src/browser/greyhaven-atmosphere.mjs")
};
const rendererRoute="/__world493__/src/browser/authored-world-renderer.mjs";
const mime={".mjs":"text/javascript; charset=utf-8",".html":"text/html; charset=utf-8",".webp":"image/webp"};
const sha=async f=>createHash("sha256").update(await readFile(f)).digest("hex");
const sourceHashes={
 worldModule:await sha(fixedWorld["/__world493__/src/world/alpha-armory.mjs"]),
 worldMap:await sha(fixedWorld["/__world493__/src/world/authored-maps.mjs"]),
 worldPainter:await sha(versionRenderer.world493),
 graphics3cPainter:await sha(versionRenderer.graphics3c),
 graphics3cMaterial:await sha(graphicsModules["/__world493__/src/browser/greyhaven-terrain-materials.mjs"]),
 graphics3cAtmosphere:await sha(graphicsModules["/__world493__/src/browser/greyhaven-atmosphere.mjs"]),
 graphics3bBridge:await sha(artAllowed["/src/browser/armory-world493-visual-bridge.mjs"]),
 graphics3bRack:await sha(artAllowed["/assets/environment/greyhaven/armory-p0/armory_rack.webp"]),
 graphics3bSword:await sha(artAllowed["/assets/environment/greyhaven/armory-p0/armory_sword.webp"])
};
assert.equal(sourceHashes.graphics3bSword,
 "795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31");
const servlets=[];
for(const variant of ["world493","graphics3c"]){
 const server=createServer(async(req,res)=>{
  try{
   if(req.method!=="GET"){res.writeHead(405);res.end();return;}
   const u=new URL(req.url,"http://127.0.0.1");
   const p=decodeURIComponent(u.pathname);
   const files={
    ...artAllowed,...fixedWorld,
    ...(variant==="graphics3c"?graphicsModules:{}),
    [rendererRoute]:versionRenderer[variant]
   };
   const src=files[p];
   if(!src){res.writeHead(404);res.end("Denied QA route");return;}
   const data=await readFile(src);
   res.writeHead(200,{"Content-Type":mime[extname(src)]||"application/octet-stream",
     "Cache-Control":"no-store"});
   res.end(data);
  }catch(err){res.writeHead(500);res.end("QA source unavailable");}
 });
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 servlets.push({variant,server,url:"http://127.0.0.1:"+server.address().port+"/web/armory-p0-world493-review.html"});
}
const report={
 milestone:"First Playable Graphics3C original World493 + 3B508 rendered-source composite QA",
 pins:{...pins,graphics3c:graphics3cHead},sourceHashes,
 host:{platform:platform(),release:release(),cpu:cpus()[0]?.model??"unknown"},
 scope:"ART-ONLY-NO-SERVER visual samples. No real item ownership or gameplay.",
 release:{actualServerSwordItems:false,realFourPlayerAcceptance:false,
   nativeOnlineGameIntegrated:false,productionApproved:false},
 cases:[]
};
await mkdir(output,{recursive:true});
async function run(browserName,variant){
 const selected=servlets.find(x=>x.variant===variant);
 let browser;
 try{
  const options={headless:true,
    executablePath:browserName==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
  assert.ok(options.executablePath,"Required browser executable missing: "+browserName);
  if(browserName==="chrome")options.args=["--no-sandbox","--disable-gpu-sandbox",
    ...(process.env.P0_QA_DISABLE_GPU==="1"?["--disable-gpu","--disable-dev-shm-usage"]:[])];
  if(process.env.P0_QA_DISABLE_GPU==="1")options.protocolTimeout=90000;
  else{options.browser="firefox";options.protocol="webDriverBiDi";}
  browser=await puppeteer.launch(options);
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(String(e)));
  page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
  await page.setViewport({width:1100,height:880,deviceScaleFactor:1});
  const resp=await page.goto(selected.url,{waitUntil:"networkidle0",timeout:45000});
  assert.equal(resp.status(),200);
  try{
   await page.waitForFunction(()=>window.__world493ArmoryReview?.()?.ready,{timeout:75000});
  }catch(e){
   const detail=await page.$eval("#status",el=>el.textContent).catch(()=>"(status absent)");
   throw new Error(browserName+"/"+variant+" art review did not become ready; status="+detail+"; pageErrors="+JSON.stringify(errors)+"; "+e.message);
  }
  const initial=await page.evaluate(()=>window.__world493ArmoryReview());
  assert.equal(initial.realWorldTerrainRenderer,true);
  assert.equal(initial.renderedSwords,4);
  assert.equal(initial.authenticatedServerItems,false);
  assert.equal(initial.productionApproved,false);
  assert.ok(initial.cachedTiles>0 && initial.cachedTiles<=24);
  assert.deepEqual(initial.officialSwordAnchors,[[3740,4038],[3780,4038],[3820,4038],[3860,4038]]);
  assert.deepEqual(initial.officialSocketIds,[1,2,3,4].map(i=>"greyhaven-rack-"+i));
  // Low-end Linux Chromium may load and paint successfully yet deadlock its
  // CDP Page.captureScreenshot. A *separate* explicitly no-screenshot smoke
  // reads the actual Canvas pixel bytes via 2D getImageData and exercises
  // native pointer input; NEVER claim a screenshot or full visual acceptance.
  const noScreenshot=process.env.P0_QA_NO_SCREENSHOT==="1";
  const canvasFNV=await page.$eval("#scene",c=>{
   const d=c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,640,640).data;
   let hash=2166136261;
   for(let i=0;i<d.length;i++)hash=Math.imul(hash^d[i],16777619);
   return (hash>>>0).toString(16).padStart(8,"0");
  });
  const image=noScreenshot?null:variant+"_"+browserName+"_real_source_composite.png";
  const canvasImg=noScreenshot?null:variant+"_"+browserName+"_canvas.png";
  let canvasSHA256=null;
  if(!noScreenshot){
   await page.screenshot({path:join(output,image),fullPage:true});
   const canvas=await page.$("#scene");
   const png=await canvas.screenshot({path:join(output,canvasImg)});
   canvasSHA256=createHash("sha256").update(png).digest("hex");
  }
  // Genuine opaque source alpha WebP hit with native browser pointer events.
  const first=initial.swordRects.find(x=>x.id==="ART-ONLY-NO-SERVER-0");
  assert.ok(first);
  const rect=await page.$eval("#scene",e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  const toScreen=(x,y)=>({x:rect.x+x*rect.w/640,y:rect.y+y*rect.h/640});
  const opaque=toScreen(first.x+20.5,first.y+13.5);
  await page.mouse.click(opaque.x,opaque.y);
  const hit=await page.evaluate(()=>window.__world493ArmoryReview());
  assert.equal(hit.clicks,1);
  assert.equal(hit.lastCandidate,"ART-ONLY-NO-SERVER-0");
  const transparent=toScreen(first.x+.5,first.y+.5);
  await page.mouse.click(transparent.x,transparent.y);
  const miss=await page.evaluate(()=>window.__world493ArmoryReview());
  assert.equal(miss.lastCandidate,null);
  assert.equal(miss.clicks,1);
  assert.deepEqual(errors,[]);
  report.cases.push({browser:browserName,browserVersion:await browser.version(),
    variant,pinnedRendererHash:sourceHashes[variant==="world493"?"worldPainter":"graphics3cPainter"],
    canvasSha256:canvasSHA256,canvasPixelFnv32:canvasFNV,
    screenshotsCaptured:!noScreenshot,screenCaptured:canvasImg,fullScreenshot:image,
    cachedTiles:initial.cachedTiles,createdTiles:initial.createdTiles,
    rackRect:initial.rackRect,swordRects:initial.swordRects,
    syntheticArtItems:4,realCommittedItems:0,
    actualSwordAlphaClickCandidate:hit.lastCandidate,
    transparentClickRejected:miss.lastCandidate===null,
    actualCombatAttacks:0,actualPickupRequests:0,
    pageErrors:errors});
 }finally{await browser?.close();}
}
const engines=(process.env.P0_QA_BROWSERS||"chrome,firefox").split(",").map(s=>s.trim());
assert.ok(engines.length>0 && engines.every(x=>x==="chrome"||x==="firefox") && new Set(engines).size===engines.length);
try{
 for(const browser of engines){
  for(const variant of ["world493","graphics3c"])await run(browser,variant);
 }
 for(const browser of engines){
  const cases=report.cases.filter(c=>c.browser===browser);
  assert.equal(cases.length,2);
  if(process.env.P0_QA_NO_SCREENSHOT==="1")
   assert.notEqual(cases[0].canvasPixelFnv32,cases[1].canvasPixelFnv32,
     "Expected actual Canvas pixel readback to differ when 3C environment is enabled");
  else assert.notEqual(cases[0].canvasSha256,cases[1].canvasSha256,
    "Expected visible Graphics 3C changes to World-only authored background, not identical screenshot");
 }
 report.status=process.env.P0_QA_NO_SCREENSHOT==="1"
   ?"ART_ONLY_NO_SCREENSHOT_INPUT_PASS":
   engines.includes("chrome")&&engines.includes("firefox")
   ?"ART_ONLY_CROSS_BROWSER_COMPOSITE_PASS":"ART_ONLY_SINGLE_ENGINE_COMPOSITE_PASS";
 await writeFile(join(output,"p32_original_source_composite_browser.json"),
   JSON.stringify(report,null,2)+"\n");
 console.log(JSON.stringify({
   status:report.status,
   cases:report.cases.map(x=>({browser:x.browser,variant:x.variant,version:x.browserVersion,
     tiles:x.cachedTiles,canvasSha256:x.canvasSha256,
     artClick:x.actualSwordAlphaClickCandidate,errors:x.pageErrors}))
 },null,2));
}finally{
 await Promise.all(servlets.map(x=>new Promise(ok=>x.server.close(ok))));
}
