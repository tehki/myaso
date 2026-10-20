#!/usr/bin/env node
// A2.21 original art + approved 120% knight on EXACT game XY projection.
// Verifies separate companion PR326 checkout (no copying WebPs into PR350).
// Real Chrome screenshots on localhost; no online game, collision or server.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";

const graphics=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const companion=resolve(process.argv[2]||"");
const out=resolve(process.argv[3]||join(graphics,".a221-review"));
const expectedKnight="c74fcf90e227f3bc4788728f000cfe6aa083c7ef";
assert.equal(execFileSync("git",["-C",companion,"rev-parse","HEAD"],
  {encoding:"utf8"}).trim(),expectedKnight);
const source=await readFile(join(companion,"web","knight-sprites.mjs"),"utf8");
assert.match(source,/KNIGHT_PRESENTATION_SCALE = 1\.2/);
assert.match(source,/KNIGHT_ROLL_PRESENTATION_MS = 350/);
assert.match(source,/const size = Math\.round\(baseSize \* scale\)/);
const knightRoot=join(companion,"web","assets","knights");
const allowed=new Set(["asset-build-report.json","silver_idle.webp",
 "silver_roll.webp","t1_roll.webp"]);
const manifest=JSON.parse(await readFile(join(knightRoot,"asset-build-report.json"),"utf8"));
const hashes={};
for(const clip of ["silver_idle","silver_roll","t1_roll"]){
 const bytes=await readFile(join(knightRoot,clip+".webp"));
 assert.equal(bytes.subarray(0,4).toString("ascii"),"RIFF");
 assert.equal(bytes.length,manifest[clip].bytes);
 hashes[clip]=createHash("sha256").update(bytes).digest("hex");
}
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".json":"application/json",
 ".webp":"image/webp",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://localhost");
  const path=decodeURIComponent(url.pathname);
  let filename;
  if(path.startsWith("/__a221_knights__/")){
   const name=path.slice("/__a221_knights__/".length);
   if(!allowed.has(name)){res.writeHead(404);res.end("not found");return;}
   filename=join(knightRoot,name);
  }else{
   filename=resolve(graphics,"."+path);
   const rel=relative(graphics,filename);
   if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")){
    res.writeHead(404);res.end("not found");return;
   }
  }
  if(!existsSync(filename)){res.writeHead(404);res.end("not found");return;}
  const raw=await readFile(filename);
  res.writeHead(200,{"Content-Type":mime[extname(filename)]||"application/octet-stream",
    "Cache-Control":"no-store"});res.end(raw);
 }catch{res.writeHead(500);res.end("local art QA read error");}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
let browser;
try {
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await pp.launch({headless:true,
  executablePath:process.env.CHROME_EXECUTABLE||undefined,
  args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1500,height:1130,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{
  if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());
 });
 await page.goto("http://127.0.0.1:"+server.address().port+
   "/web/greyhaven-a221-2p5d.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__a221Review?.()?.ready,{timeout:30000});

 async function capture(clip,dx,dy,roof,name){
  const state=await page.evaluate(async ({clip,dx,dy,roof})=>{
    for(const [name,value] of Object.entries({clip,east:dx,south:dy,roof})){
      const el=document.getElementById(name);
      el.value=String(value);
      el.dispatchEvent(new Event("input",{bubbles:true}));
    }
    await new Promise(requestAnimationFrame);
    return window.__a221Review();
  },{clip,dx,dy,roof});
  assert.equal(state.ready,true);
  assert.equal(state.clip,clip);
  assert.equal(state.dx,dx);assert.equal(state.dy,dy);
  assert.equal(state.sourceKnightPrHead,expectedKnight);
  assert.equal(state.worldAuthorityChanged,false);
  assert.equal(state.gameRuntimeModified,false);
  assert.equal(state.activePortalValidated,false);
  assert.equal(state.correctedThreeQuarterCamera,false);
  assert.equal(state.liveMultiplayerValidated,false);
  assert.equal(state.knightSourceAssetsCopied,false);
  assert.equal(state.knightDraw.w,clip==="silver_idle"?96:134);
  assert.equal(state.knightDraw.h,clip==="silver_idle"?96:134);
  assert.ok(state.elevatedErrorPx<.15,
   "Real game XY must match calibrated elevated within source rounding");
  if(Math.hypot(dx,dy)>40){
   assert.ok(state.cinematicErrorPx>state.elevatedErrorPx+10,
      "Cinematic art is NOT world-XY compatible");
  }
  assert.ok(Number.isFinite(state.cinematicErrorPx));
  await page.screenshot({path:join(out,name),fullPage:true});
  return state;
 }
 const atDoor=await capture("silver_idle",0,0,35,
  "greyhaven_a221_knight_at_art_door_chrome.png");
 const southeast=await capture("silver_idle",120,-80,20,
  "greyhaven_a221_xy_facade_120_minus80_chrome.png");
 const roll=await capture("silver_roll",40,40,0,
  "greyhaven_a221_real_knight_roll_xy_chrome.png");
 assert.deepEqual(errors,[]);
 const report={
  milestone:"Blood & Iron A2.21 real knight XY against game-compatible and cinematic Red Lion",
  browser:await browser.version(),
  companionKnightSourceHead:expectedKnight,
  companionSpriteSha256:hashes,
  gameCoordinateSource:"src/browser/arena-viewport.mjs",
  calibrationSource:"A2.21 source Blender XY-grounded 2.5D facade and A2.6 original cinematic camera",
  screenshots:3,atDoor,southeast,roll,
  errors,skinnedFootContactValidated:false,
  visualPortalOnly:true,
  actualAuthoritativePortalValidated:false,
  actualGameRuntimeIntegrated:false,
  actualMultiplayerFPSMeasured:false,
  roofOcclusionValidated:false,
  atlasCopiedToGraphicsBranch:false,
  approved120ScalePreserved:true,
  gameAuthorityOrCollisionChanged:false,
  productionApproved:false,
  caveat:"Same exact world XY and original 120% knight art. The calibrated elevated follows the game camera; cinematic 3/4 exterior has incompatible ground basis. This is offline art QA, NOT live game collision or a portal."
 };
 await writeFile(join(out,"greyhaven_a221_browser_report.json"),
  JSON.stringify(report,null,2)+"\n");
 console.log("A220_RESULT="+JSON.stringify({
  browser:report.browser,atDoor:atDoor.elevatedErrorPx,
  elevatedMoved:southeast.elevatedErrorPx,
  cinematicMoved:southeast.cinematicErrorPx,
  clip:roll.clip,screenshotCount:3,errors:errors.length
 }));
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
