#!/usr/bin/env node
// A2.27: LOCALHOST real Chrome art review with original independently pinned knights.
// Never copies original knight atlas into graphics PR; never touches multiplayer.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";

const graphics=resolve(fileURLToPath(new URL("../../",import.meta.url)));
assert.ok(process.argv[2],"Pass independent knight PR326 checkout");
const knightCheckout=resolve(process.argv[2]);
const out=resolve(process.argv[3]||join(graphics,".a227-browser"));
const pinnedKnight="c74fcf90e227f3bc4788728f000cfe6aa083c7ef";
const actualKnight=execFileSync("git",["-C",knightCheckout,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(actualKnight,pinnedKnight);
const source=await readFile(join(knightCheckout,"web","knight-sprites.mjs"),"utf8");
assert.match(source,/KNIGHT_PRESENTATION_SCALE = 1\.2/);
assert.match(source,/KNIGHT_ROLL_PRESENTATION_MS = 350/);
const assets=join(knightCheckout,"web","assets","knights");
const allowed=new Set(["asset-build-report.json","silver_idle.webp","silver_roll.webp","t1_roll.webp"]);
const build=JSON.parse(await readFile(join(assets,"asset-build-report.json"),"utf8"));
const hashes={};
for(const clip of ["silver_idle","silver_roll","t1_roll"]){
 const bytes=await readFile(join(assets,clip+".webp"));
 assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF");
 assert.equal(bytes.length,build[clip].bytes);
 hashes[clip]=createHash("sha256").update(bytes).digest("hex");
}
await mkdir(out,{recursive:true});
const types={".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".html":"text/html; charset=utf-8",".json":"application/json",".webp":"image/webp",
 ".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname);
  let file;
  if(path.startsWith("/__a227_knights__/")){
   const name=path.slice("/__a227_knights__/".length);
   if(!allowed.has(name)){res.writeHead(404);res.end("not found");return;}
   file=join(assets,name);
  }else{
   file=resolve(graphics,"."+path);
   const rel=relative(graphics,file);
   if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")){
    res.writeHead(404);res.end("not found");return;
   }
  }
  if(!existsSync(file)){res.writeHead(404);res.end("not found");return;}
  const bytes=await readFile(file);
  res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream",
     "Cache-Control":"no-store"});res.end(bytes);
 }catch{res.writeHead(500);res.end("local art QA failure");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1500,height:1140,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{
  if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());
 });
 const url="http://127.0.0.1:"+server.address().port+
   "/web/greyhaven-a227-roof-browser.html";
 await page.goto(url,{waitUntil:"networkidle0"});
 try { await page.waitForFunction(()=>window.__a227Review?.()?.ready,{timeout:8000}); } catch (e) { throw Error("A227 initial page error: "+JSON.stringify({status:await page.$eval("#status",el=>el.textContent),errors})+"; "+e.message); }
 async function capture(clip,dx,dy,roof,name){
  const state=await page.evaluate(async values=>{
   for(const [id,value] of Object.entries(values)){
    const el=document.getElementById(id);el.value=String(value);
    el.dispatchEvent(new Event("input",{bubbles:true}));
   }
   await new Promise(requestAnimationFrame);
   return window.__a227Review();
  },{clip,east:dx,south:dy,roof});
  assert.equal(state.ready,true);
  assert.deepEqual([state.dx,state.dy,state.clip],[dx,dy,clip]);
  assert.equal(state.originalKnightPrHead,pinnedKnight);
  assert.equal(state.knightDraw.w,clip==="silver_idle"?96:134);
  assert.equal(state.knightDraw.h,clip==="silver_idle"?96:134);
  assert.equal(state.roofTopLoweredPx,0);
  assert.equal(state.roofBottomShiftPx,0);
  assert.equal(state.originalBlenderSceneModified,false);
  assert.equal(state.productionApproved,false);
  assert.equal(state.multiplayerRuntimeIntegrated,false);
  assert.equal(state.authoritativeDoorOrColliderValidated,false);
  assert.equal(state.dynamicRoofOcclusionValidated,false);
  assert.equal(state.roofPixelComparison.alphaPixelDifferences,0);
  assert.ok(state.roofPixelComparison.changedVisiblePixels>30000);
  assert.ok(state.roofPixelComparison.changedVisiblePixels<44000);
  assert.equal(state.knightAssetsCopiedToGraphics,false);
  for(const key of ["baseline","refined"]){
   assert.ok(state.versions[key].groundXYErrorPx<.15);
  }
  await page.screenshot({path:join(out,name),fullPage:true});
  return state;
 }
 const atDoor=await capture("silver_idle",0,0,100,"greyhaven_a227_at_door_full_roof_chrome.png");
 const walk=await capture("silver_idle",120,-80,55,"greyhaven_a227_120minus80_comparison_chrome.png");
 const rolling=await capture("silver_roll",40,40,0,"greyhaven_a227_roll_roof_removed_chrome.png");
 const sentinel=await capture("t1_roll",-60,70,80,"greyhaven_a227_sentinel_80roof_chrome.png");
 assert.deepEqual(errors,[]);
 const report={
  milestone:"Blood & Iron A2.27 real Chrome A2.24/A2.26 clay roof color comparison with authentic PR326 knight",
  browser:await browser.version(),
  originalKnightSourceHead:pinnedKnight,
  originalKnightAtlasSha256:hashes,
  actualGameProjectionModule:"src/browser/arena-viewport.mjs",
  screenshots:4,atDoor,walk,rolling,sentinel,
  roofPixelComparison:walk.roofPixelComparison,
  roofTopLoweredPx:walk.roofTopLoweredPx,
  roofBottomShiftPx:walk.roofBottomShiftPx,
  errors,
  actualAuthoritativeEntranceValidated:false,
  roofOcclusionValidatedInActualGame:false,
  liveMultiplayerPerformanceMeasured:false,
  knightAtlasesCopiedIntoGraphics:false,
  sourceBlenderSceneModified:false,
  gameplayOrNetworkModified:false,
  productionApproved:false,
  caveat:"Real Chrome isolated source-art A2.24 versus A2.26 comparison. Manual roof slider; no server door/collision, dynamic wall/actor occlusion, live multiplayer or production runtime."
 };
 await writeFile(join(out,"greyhaven_a227_real_chrome_report.json"),
  JSON.stringify(report,null,2)+"\n");
 console.log("A227_CHROME="+JSON.stringify({
  browser:report.browser,zeroBrowserErrors:errors.length===0,
  screenshots:4,roofTopDelta:report.roofTopLoweredPx,
  groundErrorPx:walk.versions.refined.groundXYErrorPx,
  authenticCompanion:pinnedKnight
 }));
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
