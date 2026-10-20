#!/usr/bin/env node
// Standalone A2.8 visual projection acceptance in REAL local Chrome.
// Does not load the online combat client or mutate game world / multiplayer.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {ARENA_VIEW_ZOOM,projectArenaPoint} from "../../src/browser/arena-viewport.mjs";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".a28-review-local"));
const types={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".json":"application/json",".webp":"image/webp",
 ".png":"image/png",".css":"text/css; charset=utf-8"};
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const full=resolve(root,"."+pathname);
    const rel=relative(root,full);
    if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||
        !existsSync(full)){res.writeHead(404);res.end("Not found");return;}
    const body=await readFile(full);
    res.writeHead(200,{"Content-Type":types[extname(full)]||"application/octet-stream",
                        "Cache-Control":"no-store"});
    res.end(body);
  }catch{res.writeHead(500);res.end("Local file read error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try {
  const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
  browser=await pp.launch({headless:true,
    executablePath:process.env.CHROME_EXECUTABLE||undefined,
    args:["--no-sandbox","--disable-gpu-sandbox"]});
  const page=await browser.newPage();
  await page.setViewport({width:1480,height:1030,deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:"+server.address().port+
    "/web/greyhaven-a28-xy-lab.html",{waitUntil:"networkidle0"});
  await page.waitForFunction(()=>window.__greyhavenA28Review?.().ready,
    {timeout:30000});
  const initial=await page.evaluate(()=>window.__greyhavenA28Review());
  assert.equal(initial.gameZoom,ARENA_VIEW_ZOOM);
  assert.equal(initial.eastWorldUnits,40);
  assert.equal(initial.southWorldUnits,40);
  assert.equal(initial.roofOpacity,.6);
  assert.equal(initial.syntheticReference,true);
  assert.equal(initial.knightFeetPivotValidated,false);
  assert.equal(initial.gameIntegrated,false);
  assert.equal(initial.portalAuthorityVerified,false);
  const expected=projectArenaPoint(4365+40,4075+40,4365,4075,640,640);
  assert.ok(Math.abs(initial.projectedX-expected.x)<.001);
  assert.ok(Math.abs(initial.projectedY-expected.y)<.001);
  assert.ok(initial.calibratedErrorPx<.01);
  assert.ok(initial.cinematicErrorPx>20,
    "Oblique Blender art must not silently report zero XY mismatch");
  await page.screenshot({path:join(out,"greyhaven_a28_camera_comparison.png"),fullPage:true});

  await page.$eval("#east",el=>{el.value="120";el.dispatchEvent(
    new Event("input",{bubbles:true}));});
  await page.$eval("#south",el=>{el.value="-80";el.dispatchEvent(
    new Event("input",{bubbles:true}));});
  await page.$eval("#roof",el=>{el.value="20";el.dispatchEvent(
    new Event("input",{bubbles:true}));});
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const moved=await page.evaluate(()=>window.__greyhavenA28Review());
  assert.equal(moved.eastWorldUnits,120);
  assert.equal(moved.southWorldUnits,-80);
  assert.equal(moved.roofOpacity,.2);
  const m=projectArenaPoint(4365+120,4075-80,4365,4075,640,640);
  assert.ok(Math.abs(moved.projectedX-m.x)<.001);
  assert.ok(Math.abs(moved.projectedY-m.y)<.001);
  assert.ok(moved.calibratedErrorPx<.01);
  assert.ok(moved.cinematicErrorPx>initial.cinematicErrorPx);
  await page.screenshot({path:join(out,"greyhaven_a28_xy_offset_and_roof_fade.png"),fullPage:true});
  assert.deepEqual(errors,[]);
  const report={
    milestone:"Blood & Iron A2.8 real Chrome isolated XY camera comparison",
    browser:await browser.version(),
    viewport:[1480,1030],
    captureDPR:1,
    actualSourceFunction:"src/browser/arena-viewport.mjs projectArenaPoint",
    proposedManifestDoorXY:[4365,4075],
    initial,moved,
    consoleOrNetworkErrors:errors,
    gameplayChanged:false,
    knightFootPivotVerified:false,
    worldPortalAuthorityVerified:false,
    gameRuntimeFPSMeasured:false,
    deployed:false,
    caveat:"Isolated actual Chrome rendering of existing art and synthetic world origins. NOT a screenshot/test of the multiplayer game, A3 knight sprites, or authoritative portals."
  };
  await writeFile(join(out,"greyhaven_a28_browser_report.json"),
    JSON.stringify(report,null,2)+"\n");
  console.log("A28_BROWSER_REPORT="+JSON.stringify(report));
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}