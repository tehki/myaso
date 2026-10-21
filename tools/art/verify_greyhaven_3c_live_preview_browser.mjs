// Graphics 3C P2.8 - real rAF-driven Moonvale world-preview acceptance.
// This runs the ACTUAL interactive authored World preview page (including its
// own renderer, movement, HUD and browser requestAnimationFrame callback).
// It does NOT simulate server multiplayer, benchmark WebSocket performance,
// or change the page/runtime. Both URLs must serve independent localhost trees.
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {cpus,platform,release,arch} from "node:os";

const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const executablePath=process.env.CHROME_EXECUTABLE;
const urls={world336:process.env.GREYHAVEN_BASELINE_URL,
  graphics3c:process.env.GREYHAVEN_CANDIDATE_URL};
if(!executablePath||!Object.values(urls).every(u=>u?.startsWith("http://127.0.0.1:")))
  throw new Error("Provide Chrome and two independently served localhost-only URLs");

const out=resolve(process.argv[2]||"assets/environment/greyhaven/3c-p28-review");
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath,headless:true,
  args:["--disable-gpu","--no-first-run","--no-default-browser-check"]});
const report={
  date:"2026-10-21",
  chrome:await browser.version(),
  host:{platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model??"unknown"},
  comparison:{
    world336:"260a7b85a33b7a51663a70af8d410e0d33e0e236",
    graphics3c:process.env.GREYHAVEN_CANDIDATE_SHA||"f59bbcb34136ad96e0890a2d887fb7b250d7e02a"},
  viewport:{width:1280,height:960,deviceScaleFactor:1},
  method:"Unmodified /web/world-preview.html interactive requestAnimationFrame loop; keyboard events, Canvas, HUD. Unmodified /web/world-preview.html?room=tavern interior.",
  limitations:"Local design preview. Not authoritative multiplayer, GPU full-load, live game network FPS, real 3A sprites, or 3B Blender composite.",
  capture:{}
};

function metrics(values){
  const arr=[...values].sort((a,b)=>a-b);
  if(!arr.length)return {count:0};
  const pick=p=>arr[Math.min(arr.length-1,Math.ceil(p*arr.length)-1)];
  return {
    count:arr.length,medianMs:+pick(.5).toFixed(2),
    p95Ms:+pick(.95).toFixed(2),maxMs:+arr[arr.length-1].toFixed(2),
    intervalsAbove25:arr.filter(x=>x>25).length,
    intervalsAbove33_4:arr.filter(x=>x>33.4).length,
    intervalsAbove50:arr.filter(x=>x>50).length,
    observedFps:+(1000/(arr.reduce((a,b)=>a+b,0)/arr.length)).toFixed(1)
  };
}
async function observeFrames(page,durationMs){
  const raw=await page.evaluate(ms=>new Promise(resolve=>{
    const values=[];let first=null,last=null;
    function sample(now){
      if(first===null)first=now;
      if(last!==null)values.push(now-last);
      last=now;
      if(now-first>=ms)resolve(values);
      else requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }),durationMs);
  return metrics(raw);
}
const place=page=>page.$eval("#place",e=>e.textContent);
async function stage(page,key,ms){
  const before=await place(page);
  if(key)await page.keyboard.down(key);
  let frames;
  try{frames=await observeFrames(page,ms)}
  finally{if(key)await page.keyboard.up(key)}
  return {input:key??"idle",requestedMs:ms,before,after:await place(page),frames};
}
try{
 for(const [id,base] of Object.entries(urls)){
   const errors=[];
   const page=await browser.newPage();
   await page.setViewport(report.viewport);
   page.on("pageerror",e=>errors.push(String(e)));
   const response=await page.goto(base+"/web/world-preview.html",
     {waitUntil:"networkidle0",timeout:30000});
   await page.waitForFunction(()=>document.querySelector("#place")?.textContent.includes("cached"),
     {timeout:12000});
   await page.waitForTimeout?.(300);
   // Capture original equal-position camera before any keyboard movement.
   await (await page.$("#arena")).screenshot({
     path:resolve(out,id+"_initial_greyhaven_canvas.png")
   });
   const phases=[];
   phases.push(await stage(page,null,1450));
   phases.push(await stage(page,"d",2600));
   phases.push(await stage(page,"a",2600));
   phases.push(await stage(page,"w",2250));
   phases.push(await stage(page,"s",2250));
   await page.$eval("#arena",c=>c.dispatchEvent(
     new WheelEvent("wheel",{deltaY:-120,bubbles:true,cancelable:true})));
   phases.push(await stage(page,null,1100));
   await page.screenshot({path:resolve(out,id+"_world_preview.png")});
   await (await page.$("#arena")).screenshot({
     path:resolve(out,id+"_world_canvas.png")
   });
   const outside={http:response.status(),title:await page.title(),
     phases,lastPlace:await place(page),lastDoor:await page.$eval("#door",x=>x.textContent)};
   // Live local-design-preview key E: enter the authored Red Lion door.
   const approach=await stage(page,"w",330);
   const nearPortal=await page.$eval("#door",x=>x.textContent);
   await page.keyboard.press("e");
   await page.waitForFunction(()=>document.querySelector("#place")?.textContent.includes("The Red Lion Inn"),
     {timeout:2500});
   const afterEnter=await place(page);
   await page.screenshot({path:resolve(out,id+"_entered_red_lion_preview.png")});
   outside.portal={approach:approach.after,nearPortal,afterEnter};
   await page.close();

   const insidePage=await browser.newPage();
   await insidePage.setViewport(report.viewport);
   insidePage.on("pageerror",e=>errors.push(String(e)));
   const inside=await insidePage.goto(base+"/web/world-preview.html?room=tavern",
     {waitUntil:"networkidle0",timeout:30000});
   await insidePage.waitForFunction(()=>document.querySelector("#place")?.textContent.includes("cached"),
     {timeout:12000});
   const rooms=[await stage(insidePage,null,1100),await stage(insidePage,"d",1500)];
   await insidePage.screenshot({path:resolve(out,id+"_tavern_preview.png")});
   await (await insidePage.$("#arena")).screenshot({
     path:resolve(out,id+"_tavern_canvas.png")
   });
   report.capture[id]={
     outside,inside:{http:inside.status(),phases:rooms,place:await place(insidePage)},
     errors
   };
   await insidePage.close();
   if(!outside.portal.nearPortal.includes("Press E")||
       !outside.portal.afterEnter.includes("The Red Lion Inn"))
     throw new Error(id+" did not enter authored Red Lion via actual keyboard E");
   if(outside.http!==200||inside.status()!==200||errors.length)
     throw new Error(id+" page did not initialize without errors: "+errors);
   if(!phases.slice(1,5).every(p=>p.before!==p.after&&p.frames.count>20))
     throw new Error(id+" world-preview keyboard movement/RAF did not progress");
   if(!rooms[1].after.includes("cached")||rooms[1].before===rooms[1].after)
     throw new Error(id+" interior world-preview did not progress");
 }
 report.status="completed";
}finally{await browser.close()}
await writeFile(resolve(out,"p28_live_preview_report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({
  status:report.status,chrome:report.chrome,host:report.host,
  cases:Object.fromEntries(Object.entries(report.capture).map(([name,s])=>[name,{
    outsideHttp:s.outside.http,insideHttp:s.inside.http,
    positions:s.outside.phases.map(x=>x.after),
    raf:s.outside.phases.map(x=>({input:x.input,...x.frames})),
    interiorRaf:s.inside.phases.map(x=>({input:x.input,...x.frames})),
    errors:s.errors
  }]))
},null,2));
