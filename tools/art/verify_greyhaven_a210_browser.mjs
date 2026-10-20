#!/usr/bin/env node
// A2.10 visual-only Chrome acceptance of a localhost server started with
// verify_greyhaven_a29_knights.mjs --serve (pins independent PR326 sources).
// The URL MUST be loopback. No game, source sprites or CI checks modified.
import assert from "node:assert/strict";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {resolve,join} from "node:path";
const url=new URL(process.argv[2]||"");
assert.ok(["127.0.0.1","localhost"].includes(url.hostname));
assert.equal(url.pathname,"/web/greyhaven-a210-scale-lab.html");
const out=resolve(process.argv[3]||".a210-review");
await mkdir(out,{recursive:true});
const door=JSON.parse(await readFile(process.argv[4],"utf8"));
assert.equal(door.productionSpriteScaleApproved,false);
const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const browser=await pp.launch({headless:true,
 executablePath:process.env.CHROME_EXECUTABLE||undefined,
 args:["--no-sandbox","--disable-gpu-sandbox"]});
try {
 const page=await browser.newPage();
 await page.setViewport({width:1750,height:1130,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto(url.href,{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__a210ScaleReview?.().state==="ready",
  {timeout:30000});
 async function capture(clip,dir,frame,file){
  const r=await page.evaluate(async ({clip,dir,frame})=>{
   const c=document.getElementById("clip");
   c.value=clip;c.dispatchEvent(new Event("change",{bubbles:true}));
   const d=document.getElementById("direction");
   d.value=String(dir);d.dispatchEvent(new Event("input",{bubbles:true}));
   const f=document.getElementById("frame");
   f.value=String(frame);f.dispatchEvent(new Event("input",{bubbles:true}));
   await new Promise(requestAnimationFrame);
   return window.__a210ScaleReview();
  },{clip,dir,frame});
  assert.equal(r.clip,clip);
  assert.equal(r.frame,frame);
  assert.equal(r.direction,dir);
  assert.equal(r.atlasIsActualPr326,true);
  assert.equal(r.physicsChanged,false);
  assert.equal(r.gameScaleChanged,false);
  assert.equal(r.anatomicalFeetValidated,false);
  const dims=clip==="silver_idle"?[80,90,96]:[112,126,134];
  const cases=["baseline","moderate","larger"].map(x=>r.options[x]);
  assert.deepEqual(cases.map(c=>c.width),dims);
  assert.deepEqual(cases.map(c=>c.height),dims);
  assert.deepEqual(cases.map(c=>c.scale),[1,1.125,1.2]);
  assert.ok(Math.abs(r.doorHeightPx-door.projectedDoorBoundingHeightPx)<.001);
  assert.ok(cases[0].silhouetteHeightPx<cases[1].silhouetteHeightPx);
  assert.ok(cases[1].silhouetteHeightPx<cases[2].silhouetteHeightPx);
  for(const c of cases){
   assert.equal(c.rigFootContactValidated,false);
   assert.ok(c.silhouetteToProjectedDoorHeightRatio>0);
  }
  await page.screenshot({path:join(out,file),fullPage:true});
  return r;
 }
 const idle=await capture("silver_idle",0,0,"greyhaven_a210_three_scales_idle.png");
 const silverRoll=await capture("silver_roll",0,3,"greyhaven_a210_three_scales_silver_roll.png");
 const t1Roll=await capture("t1_roll",6,5,"greyhaven_a210_three_scales_t1_roll.png");
 assert.deepEqual(errors,[]);
 const result={
  milestone:"Blood & Iron A2.10 visual scale study using real PR326 atlas and Red Lion",
  browser:await browser.version(),doorHeightPx:door.projectedDoorBoundingHeightPx,
  idle,silverRoll,t1Roll,errors,
  candidates:[1,1.125,1.2],
  sourceProvenance:"Pinned PR326 companion served by A2.9 localhost harness",
  sourceAtlasesCopiedIntoGraphicsPR:false,
  productionScaleApproved:false,realGameIntegration:false,
  footBoneAnchorMeasured:false,combatChanged:false,
  actualMultiplayerFpsMeasured:false,deployed:false,
  caveat:"Canvas silhouette alpha proxy and projected door bounding mesh: not anatomical scale or authoritative collision."
 };
 await writeFile(join(out,"greyhaven_a210_scale_report.json"),
  JSON.stringify(result,null,2)+"\n");
 console.log("A210_REPORT="+JSON.stringify({
  browser:result.browser,doorHeight:result.doorHeightPx,
  idle:idle.options,silverRoll:silverRoll.options,
  errors:errors.length}));
}finally{await browser.close();}
