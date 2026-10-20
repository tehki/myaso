#!/usr/bin/env node
// Graphics 3A A3A crowd microbenchmark, isolated browser render-only workload.
// This does not measure networked multiplayer or authoritative server capacity.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".knight-crowd-local"));
const mime={".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",
 ".webp":"image/webp",".json":"application/json"};
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 try {
  const uri=new URL(req.url,"http://localhost");
  const target=resolve(root,"."+decodeURIComponent(uri.pathname));
  const rel=relative(root,target);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")
    ||!existsSync(target)){res.writeHead(404);res.end("not found");return;}
  res.writeHead(200,{"content-type":mime[extname(target)]||"application/octet-stream","cache-control":"no-store"});
  res.end(await readFile(target));
 }catch{res.writeHead(500);res.end("QA HTTP error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const browserName=process.env.KNIGHT_QA_BROWSER||"chrome";
 browser=await pp.launch({browser:browserName,headless:true,
   executablePath:process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
   args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1440,height:900,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/knight-scale-a211-preview.html",{waitUntil:"networkidle0"});
 const result=await page.evaluate(async()=>{
  const {createKnightSpriteRenderer,KNIGHT_PRESENTATION_SCALE}=await import("/web/knight-sprites.mjs");
  const {COMBAT_ACTION}=await import("/src/browser/combat-readability.mjs");
  const renderer=createKnightSpriteRenderer({presentationScale:KNIGHT_PRESENTATION_SCALE});
  const deadline=performance.now()+20000;
  while(renderer.loaded().length!==9&&performance.now()<deadline){
    await new Promise(done=>setTimeout(done,40));
  }
  const loaded=renderer.loaded();
  if(loaded.length!==9)throw new Error("atlas count="+loaded.length);
  const c=document.createElement("canvas");c.width=1440;c.height=900;
  const ctx=c.getContext("2d");
  const sizes=[2,16,50,100,200], results=[];
  function percentile(a,p){const sorted=a.slice().sort((x,y)=>x-y);return sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]}
  for(const count of sizes){
    const actors=Array.from({length:count},(_,i)=>({
      x:50+(i%20)*68,y:65+Math.floor(i/20)*78,
      facing:(i%8)*Math.PI/4,netId:i+1,action:COMBAT_ACTION.idle
    }));
    const durations=[],intervals=[];let prev=0,drawn=0;
    for(let frame=0;frame<110;frame++){
      const now=await new Promise(done=>requestAnimationFrame(done));
      if(prev)intervals.push(now-prev);prev=now;
      ctx.clearRect(0,0,c.width,c.height);
      const start=performance.now();
      for(let i=0;i<actors.length;i++){
        const a=actors[i];
        a.x+=0.25; if(a.x>1400)a.x=50;
        ctx.save();ctx.translate(a.x,a.y);
        drawn+=Number(renderer.draw(ctx,a,{remote:true,nowMs:now}));
        ctx.restore();
      }
      durations.push(performance.now()-start);
    }
    results.push({visibleFighters:count,frames:110,atlasDraws:drawn,
      drawMs:{avg:durations.reduce((x,y)=>x+y,0)/durations.length,p95:percentile(durations,.95),max:Math.max(...durations)},
      rafMs:{p95:percentile(intervals,.95),max:Math.max(...intervals)}});
  }
  return {loadedAtlases:loaded.length,scale:KNIGHT_PRESENTATION_SCALE,
   results,measurement:"native browser canvas draw submission and RAF intervals",
   networkedMultiplayer:false,serverEntities:0,
   cameraAndEnvironmentCostIncluded:false};
 });
 assert.equal(result.loadedAtlases,9);
 assert.deepEqual(result.results.map(r=>r.visibleFighters),[2,16,50,100,200]);
 assert.ok(result.results.every(r=>r.atlasDraws===r.visibleFighters*r.frames));
 assert.deepEqual(errors,[]);
 result.browser=await browser.version();result.errors=errors;
 await writeFile(join(out,"crowd_browser.json"),JSON.stringify(result,null,2)+"\n");
 console.log("KNIGHT_CROWD_BENCH="+JSON.stringify({
    browser:result.browser,counts:result.results.map(x=>x.visibleFighters),
    p95DrawMs:result.results.map(x=>Math.round(x.drawMs.p95*1000)/1000),
    p95RafMs:result.results.map(x=>Math.round(x.rafMs.p95*1000)/1000),
    errors:errors.length}));
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
