// Moon Games Graphics 3C P0 -- diagnostic only; NOT a game test.
// Loads pinned World #493 and Graphics 3B #508 review, injects timing
// logs into the served review script *in memory*, not on disk.
// Optional P0_DIAG_WARMUPS=1 is intentionally NOT full review acceptance.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join,extname,dirname} from "node:path";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createRequire} from "node:module";
import {platform,cpus} from "node:os";

const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const [wdir,adir,reportArg="assets/environment/greyhaven/3c-p34-first-frame-diagnostic.json"]=process.argv.slice(2);
assert.ok(wdir&&adir,"Pass pinned World and Graphics 3B worktrees");
const world=resolve(wdir),art=resolve(adir),out=resolve(reportArg);
const expected={world:"07060f981b8a1dac89184b621b6893dd970a08ae",
 art:"2a11b923591a682bbae3cffe6d9f70b0d2036de8"};
function git(p){return execFileSync("git",["-C",p,"rev-parse","HEAD"],{encoding:"utf8"}).trim()}
assert.equal(git(world),expected.world);assert.equal(git(art),expected.art);
const variant=process.env.P0_DIAG_VARIANT||"world493";
assert.ok(variant==="world493"||variant==="graphics3c");
const maxWarmups=Number(process.env.P0_DIAG_WARMUPS||"6");
assert.ok(maxWarmups===1||maxWarmups===6);
const gfx=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const paths={
 "/__world493__/src/world/alpha-armory.mjs":join(world,"src/world/alpha-armory.mjs"),
 "/__world493__/src/world/authored-maps.mjs":join(world,"src/world/authored-maps.mjs"),
 "/src/browser/armory-rack-visual.mjs":join(art,"src/browser/armory-rack-visual.mjs"),
 "/src/browser/armory-world493-visual-bridge.mjs":join(art,"src/browser/armory-world493-visual-bridge.mjs"),
 "/src/browser/arena-viewport.mjs":join(art,"src/browser/arena-viewport.mjs"),
 "/web/armory-p0-world493-review.html":join(art,"web/armory-p0-world493-review.html"),
 "/web/armory-p0-world493-review.mjs":join(art,"web/armory-p0-world493-review.mjs"),
 "/assets/environment/greyhaven/armory-p0/armory_rack.webp":join(art,"assets/environment/greyhaven/armory-p0/armory_rack.webp"),
 "/assets/environment/greyhaven/armory-p0/armory_sword.webp":join(art,"assets/environment/greyhaven/armory-p0/armory_sword.webp"),
 "/__world493__/src/browser/authored-world-renderer.mjs":join(variant==="world493"?world:gfx,"src/browser/authored-world-renderer.mjs")
};
if(variant==="graphics3c"){
 paths["/__world493__/src/browser/greyhaven-terrain-materials.mjs"]=join(gfx,"src/browser/greyhaven-terrain-materials.mjs");
 paths["/__world493__/src/browser/greyhaven-atmosphere.mjs"]=join(gfx,"src/browser/greyhaven-atmosphere.mjs");
}
const reviewSrc=await readFile(paths["/web/armory-p0-world493-review.mjs"],"utf8");
const target="for(let i=0;i<6;i++)draw();";
assert.ok(reviewSrc.includes(target),"3B review source changed");
let modified=reviewSrc
 .replace("const assets=await Promise.all(",
   'console.log("P0_TRACE image:begin",performance.now());\n const assets=await Promise.all(')
 .replace("const [rackImg,swordImg]=assets;",
   'console.log("P0_TRACE image:decoded",performance.now());\n const [rackImg,swordImg]=assets;')
 .replace(target,'for(let i=0;i<'+maxWarmups+';i++){\n'+
   'const start=performance.now();console.log("P0_TRACE draw:begin",i,start);\n'+
   'draw();console.log("P0_TRACE draw:end",i,performance.now()-start,"cached",world.stats.cached);\n'+
   '}');
assert.ok(modified.includes("P0_TRACE draw:end"));
const trace=[],errors=[],served=[];
const log=t=>{trace.push(t);console.log("P0_DIAG "+t)};
const server=createServer(async(req,res)=>{
 try{
  if(req.method!=="GET"){res.writeHead(405);res.end();return;}
  const pathname=new URL(req.url,"http://127.0.0.1").pathname;
  served.push({path:pathname,at:Date.now()});
  console.log("P0_DIAG_ROUTE "+pathname);
  const file=paths[pathname];
  if(!file){res.writeHead(404);res.end("Unlisted QA route");return;}
  const bytes=pathname==="/web/armory-p0-world493-review.mjs"?Buffer.from(modified):await readFile(file);
  const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",".webp":"image/webp"};
  res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream","Cache-Control":"no-store"});
  res.end(bytes);
 }catch(e){errors.push("http: "+e.message);res.writeHead(500);res.end("QA file missing")}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const report={status:"NOT_RUN",variant,maxWarmups,heads:expected,
  host:{platform:platform(),cpu:cpus()[0]?.model??"unknown"},
  injectedLogsInMemory:true,productionEdited:false,realItemOwnershipTested:false,
  screenshotAttempted:false,pixelsRead:false,frameBudgetClaim:false,trace,served,errors};
let browser;
try{
 assert.ok(process.env.CHROME_EXECUTABLE);
 browser=await puppeteer.launch({
  executablePath:process.env.CHROME_EXECUTABLE,headless:true,protocolTimeout:120000,
  args:["--no-sandbox","--disable-gpu","--disable-gpu-sandbox","--disable-dev-shm-usage"]
 });
 const page=await browser.newPage();
 page.on("console",m=>{if(m.text().startsWith("P0_TRACE"))log(m.text())});
 page.on("pageerror",e=>errors.push("page: "+String(e)));
 page.on("requestfailed",r=>errors.push("request failed: "+r.url()+" "+r.failure()?.errorText));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url())});
 await page.setViewport({width:1100,height:880,deviceScaleFactor:1});
 const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-world493-review.html";
 const first=await page.goto(url,{waitUntil:"domcontentloaded",timeout:35000});
 log("html HTTP "+first.status());
 try{
  await page.waitForFunction(()=>document.querySelector("#status")?.dataset.ready==="1",
    {timeout:Number(process.env.P0_DIAG_TIMEOUT_MS||"100000"),polling:1000});
  const ready=await page.evaluate(()=>window.__world493ArmoryReview?.());
  report.status="INSTRUMENTED_READY";
  report.cachedTiles=ready.cachedTiles;
  report.createdTiles=ready.createdTiles;
  report.renderedArtOnlySwords=ready.renderedSwords;
 }catch(e){
  report.status="INSTRUMENTED_TIMEOUT";
  errors.push("wait: "+e.message);
  try{report.statusText=await page.$eval("#status",el=>el.textContent)}catch(e2){errors.push("status: "+e2.message)}
 }
 report.chrome=await browser.version();
}catch(e){
 report.status="DIAGNOSTIC_ERROR";
 errors.push(String(e.stack||e));
}finally{
 try{await browser?.close()}catch(e){errors.push("close: "+e.message)}
 await new Promise(ok=>server.close(ok));
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify({status:report.status,variant,maxWarmups,
  cachedTiles:report.cachedTiles,trace,errors},null,2));
if(report.status!=="INSTRUMENTED_READY")process.exitCode=1;
