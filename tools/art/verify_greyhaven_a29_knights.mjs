#!/usr/bin/env node
// Actual PR #326 knight atlases + PR #350 environment, local HTTP visual QA.
// No copying of PR #326 binary assets into the graphics PR; nothing deployed.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,relative,extname,join} from "node:path";
import {existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const graphicsRoot=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const companion=resolve(process.argv[2]||"");
const out=resolve(process.argv[3]||join(graphicsRoot,".a29-local-evidence"));
assert.notEqual(companion,resolve(""),"Provide a separate PR #326 checkout path");
const expectedKnightCommit="c0b08a2a527cc492199db9f1e01dc9727225987f";
const actualCommit=execFileSync("git",["-C",companion,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(actualCommit,expectedKnightCommit,
  "Companion sprite assets must be the exact independently reviewed PR #326 head");
const modulePath=join(companion,"web","knight-sprites.mjs");
const moduleText=await readFile(modulePath,"utf8");
for(const pattern of [
  /KNIGHT_FRAME_PX = 160/,
  /KNIGHT_ROLL_PRESENTATION_MS = 350/,
  /rolling \? -56 : -40/,
  /rolling \? -65 : -52/,
  /rolling \? 112 : 80/,
  /ctx\.ellipse\(0, 11, 20, 8/
]){
  assert.match(moduleText,pattern,"A2.9 sprite placement must agree with companion renderer");
}
const knightDir=join(companion,"web","assets","knights");
const manifest=JSON.parse(await readFile(join(knightDir,"asset-build-report.json"),"utf8"));
const clips=["silver_idle","silver_roll","t1_roll"];
const hashes={};
for(const name of clips){
  const b=await readFile(join(knightDir,name+".webp"));
  assert.equal(b.subarray(0,4).toString("ascii"),"RIFF");
  assert.equal(b.subarray(8,12).toString("ascii"),"WEBP");
  assert.equal(b.length,manifest[name].bytes);
  hashes[name]=createHash("sha256").update(b).digest("hex");
}
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
".js":"text/javascript; charset=utf-8",".json":"application/json",
".webp":"image/webp",".png":"image/png"};
const server=createServer(async(req,res)=>{
  try{
    const path=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    let filename;
    if(path.startsWith("/__a29_knights__/")){
      const name=path.slice("/__a29_knights__/".length);
      const allowed=new Set([...clips.map(n=>n+".webp"),"asset-build-report.json"]);
      if(!allowed.has(name)){res.writeHead(404);res.end("Not found");return;}
      filename=join(knightDir,name);
    }else{
      filename=resolve(graphicsRoot,"."+path);
      const rel=relative(graphicsRoot,filename);
      if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")){
        res.writeHead(404);res.end("Not found");return;
      }
    }
    if(!existsSync(filename)){res.writeHead(404);res.end("Not found");return;}
    const data=await readFile(filename);
    res.writeHead(200,{"Content-Type":mime[extname(filename)]||"application/octet-stream",
      "Cache-Control":"no-store"});
    res.end(data);
  }catch{
    res.writeHead(500);res.end("QA file server error");
  }
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try {
  const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
  browser=await puppeteer.launch({headless:true,
    executablePath:process.env.CHROME_EXECUTABLE||undefined,
    args:["--no-sandbox","--disable-gpu-sandbox"]});
  const page=await browser.newPage();
  await page.setViewport({width:1370,height:1060,deviceScaleFactor:1});
  const browserErrors=[];
  page.on("pageerror",err=>browserErrors.push(err.message));
  page.on("response",r=>{if(r.status()>=400)browserErrors.push("HTTP "+r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:"+server.address().port+
    "/web/greyhaven-a29-knight-lab.html",{waitUntil:"networkidle0"});
  await page.waitForFunction(()=>window.__a29KnightReview?.().state==="ready",
    {timeout:30000});
  const initial=await page.evaluate(()=>window.__a29KnightReview());
  assert.equal(initial.clip,"silver_idle");
  assert.equal(initial.renderWidth,80);
  assert.deepEqual(initial.drawOffset,[-40,-52]);
  assert.equal(initial.realAtlasLoaded,true);
  assert.equal(initial.sourceAssetsCommittedToGraphicsPR,false);
  assert.equal(initial.anatomicalFootPivotVerified,false);
  assert.equal(initial.gameIntegrated,false);
  assert.equal(initial.browserGameXYAligned,false);
  assert.ok(Number.isFinite(initial.silhouetteBottomFromOriginPx));
  await page.screenshot({path:join(out,"greyhaven_a29_silver_idle_chrome.png"),fullPage:true});

  async function choose(clip,direction,frame){
    return page.evaluate(async ({clip,direction,frame})=>{
      const c=document.getElementById("clip");
      c.value=clip;c.dispatchEvent(new Event("change",{bubbles:true}));
      const dir=document.getElementById("direction");
      dir.value=String(direction);dir.dispatchEvent(new Event("input",{bubbles:true}));
      const f=document.getElementById("frame");
      f.value=String(frame);f.dispatchEvent(new Event("input",{bubbles:true}));
      await new Promise(requestAnimationFrame);
      return window.__a29KnightReview();
    },{clip,direction,frame});
  }
  const rolled=await choose("silver_roll",0,7);
  assert.equal(rolled.renderWidth,112);
  assert.deepEqual(rolled.drawOffset,[-56,-65]);
  assert.equal(rolled.frames,8);
  assert.equal(rolled.frame,7);
  await page.screenshot({path:join(out,"greyhaven_a29_silver_a3_roll_chrome.png"),fullPage:true});
  const sentinel=await choose("t1_roll",6,5);
  assert.equal(sentinel.renderWidth,112);
  assert.equal(sentinel.directionIndex,6);
  assert.equal(sentinel.frame,5);
  await page.$eval("#roof",el=>{el.value="20";el.dispatchEvent(
    new Event("input",{bubbles:true}));});
  await page.$eval("#roof-front",el=>{el.checked=false;el.dispatchEvent(
    new Event("input",{bubbles:true}));});
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const faded=await page.evaluate(()=>window.__a29KnightReview());
  assert.equal(faded.roofOpacity,.2);
  assert.equal(faded.roofOverActor,false);
  await page.screenshot({path:join(out,"greyhaven_a29_t1_roll_roof_chrome.png"),fullPage:true});

  const sampled=[];
  for(const name of ["silver_idle","silver_roll","t1_roll"]){
    const frames=manifest[name].frames;
    for(const dir of [0,2,4,6]){
      for(const frame of [...new Set([0,Math.floor((frames-1)/2),frames-1])]){
        const s=await choose(name,dir,frame);
        assert.equal(s.clip,name);
        assert.equal(s.directionIndex,dir);
        assert.equal(s.frame,frame);
        assert.ok(s.silhouetteAlphaBounds.bottom<160);
        assert.ok(s.silhouetteAlphaBounds.top>=0);
        assert.ok(Number.isFinite(s.silhouetteBottomFromOriginPx));
        sampled.push({clip:name,directionIndex:dir,frame,
          proxyBottomRelativeToOriginPx:Number(s.silhouetteBottomFromOriginPx.toFixed(3)),
          alphaBounds:s.silhouetteAlphaBounds});
      }
    }
  }
  assert.equal(sampled.length,36);
  assert.deepEqual(browserErrors,[]);
  const report={
    milestone:"Blood & Iron A2.9 real unmerged PR326 knight sprites and PR350 roof art",
    browser:await browser.version(),
    companionPr326Commit:actualCommit,
    companionModuleSHA256:createHash("sha256").update(moduleText).digest("hex"),
    companionAtlasSHA256:hashes,
    initial,rolled,sentinel,faded,
    sampledFrameCount:sampled.length,
    alphaSilhouetteSamples:sampled,
    browserErrors,
    canvasPresentationOnly:true,
    anatomicalFootPivotVerified:false,
    combatHitboxChanged:false,
    spriteOrAtlasCommittedIntoGraphicsPR:false,
    realGameRuntimeTested:false,
    gameFrameTimeMeasured:false,
    multiplayerRooftopOcclusionValidated:false,
    deployed:false,
    caveat:"Bottommost alpha pixel proxy is not an anatomical foot contact or collision ground proof. Rendered on a static roof preview, not the live multiplayer game."
  };
  await writeFile(join(out,"greyhaven_a29_knight_browser_report.json"),
    JSON.stringify(report,null,2)+"\n");
  console.log("A29_REPORT="+JSON.stringify({
    browser:report.browser,sampledFrameCount:sampled.length,
    idleProxy:initial.silhouetteBottomFromOriginPx,
    silverRollProxy:rolled.silhouetteBottomFromOriginPx,
    sentinelRollProxy:sentinel.silhouetteBottomFromOriginPx,
    screenshotCount:3,errors:browserErrors.length,
    companionCommit:actualCommit
  }));
}finally{
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}