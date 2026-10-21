// Graphics 3C P2.5: low-end Chrome moving-camera draw cost, offline only.
// Run independent localhost-hosted exact P2.3 baseline / P2.4 candidate.
// No gameplay server, no live frame-rate claims, no authoritative state.
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {cpus,platform,release,arch} from "node:os";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const executablePath=process.env.CHROME_EXECUTABLE;
const urls={baseline:process.env.GREYHAVEN_BASELINE_URL,candidate:process.env.GREYHAVEN_CANDIDATE_URL};
if(!executablePath||!Object.values(urls).every(url=>url?.startsWith("http://127.0.0.1:")))
  throw new Error("Pass Chrome executable and independently served localhost baseline/candidate");
const outputDir=resolve(process.argv[2]||"assets/environment/greyhaven/3c-p25-review");
await mkdir(outputDir,{recursive:true});
const browser=await puppeteer.launch({executablePath,headless:true,
  args:["--disable-gpu","--no-first-run","--no-default-browser-check"]});
const routes=[
  {id:"greyhaven-street",count:72,fromX:3590,fromY:4160,toX:4660,toY:4160,zoom:1.0},
  {id:"greyhaven-market-chapel",count:72,fromX:4440,fromY:3640,toX:4440,toY:4680,zoom:1.0},
  {id:"distant-grove",count:72,fromX:600,fromY:2560,toX:1540,toY:2560,zoom:1.0},
  {id:"greyhaven-tile-hops",count:72,kind:"jump",zoom:1.0},
];
const result={
  chrome:await browser.version(),baselineHead:"ff74af212d606f4fb8aa11336cc5633dd54fe181",
  viewport:{width:960,height:600,dpr:1},
  device:{platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model??"unknown",browserGpuDisabled:true},
  method:"Offline Canvas world.draw only; 72 sequential camera positions per route, forward then reverse (144 draw calls); includes synthetic city tile hops for worst-case cache churn; 3 fresh renderer runs per version in alternating order; NOT full game frame time",
  runs:[],limits:{maxNewTilesPerDraw:3,maxCacheTiles:24},status:"not_run"
};
const max=vals=>vals.length?Math.max(...vals):0;
function stats(t){
  if(!t.length)return null;
  const sorted=[...t].sort((a,b)=>a-b);
  return {n:t.length,medianMs:+sorted[Math.floor((t.length-1)/2)].toFixed(3),
    p95Ms:+sorted[Math.min(t.length-1,Math.ceil(.95*t.length)-1)].toFixed(3),
    maxMs:+max(t).toFixed(3),drawCallsOver16_7:t.filter(x=>x>16.7).length};
}
try{
 for(let trial=0;trial<3;trial++){
  const order=trial%2?[["candidate",urls.candidate],["baseline",urls.baseline]]:
                    [["baseline",urls.baseline],["candidate",urls.candidate]];
  for(const [variant,url] of order){
    const page=await browser.newPage();
    await page.setViewport({width:960,height:600,deviceScaleFactor:1});
    await page.setCacheEnabled(false);
    const errors=[];page.on("pageerror",e=>errors.push(String(e)));
    const response=await page.goto(url,{waitUntil:"networkidle0",timeout:22000});
    if(response.status()!==200)throw Error(variant+" unexpected HTTP "+response.status());
    const routeResults={};
    for(const route of routes){
      routeResults[route.id]=await page.evaluate(async route=>{
        const [{createAuthoredWorldRenderer},{MAP_IDS}]=await Promise.all([
          import("/src/browser/authored-world-renderer.mjs"),
          import("/src/world/authored-maps.mjs")
        ]);
        const world=createAuthoredWorldRenderer();
        const canvas=document.createElement("canvas");canvas.width=960;canvas.height=600;
        const ctx=canvas.getContext("2d",{alpha:false});
        const cold=[],warm=[],all=[];
        let made=0,newFrames=0,maxNew=0,maxCached=0;
        for(let i=0;i<2*route.count;i++){
          const reverse=i>=route.count;
          const j=reverse?2*route.count-i-1:i;
          const alpha=j/(route.count-1);
          // Deliberate worst-case jumping across authored city tile rows;
          // NOT a gameplay movement speed or collision-authorized teleport.
          const slot=(j*7)%12;
          const camera=route.kind==="jump"
            ? {x:3610+(slot%4)*350,y:3550+Math.floor(slot/4)*480}
            : {x:route.fromX+(route.toX-route.fromX)*alpha,
                y:route.fromY+(route.toY-route.fromY)*alpha};
          ctx.setTransform(1,0,0,1,0,0);
          ctx.save();
          ctx.translate(480,300);ctx.scale(route.zoom,route.zoom);ctx.translate(-480,-300);
          const start=performance.now();
          world.draw(ctx,MAP_IDS.overworld,camera,960,600,route.zoom);
          const ms=performance.now()-start;
          ctx.restore();
          if(world.stats.created){newFrames++;made+=world.stats.created;cold.push(ms);}
          else warm.push(ms);
          all.push(ms);
          maxNew=Math.max(maxNew,world.stats.created);
          maxCached=Math.max(maxCached,world.stats.cached);
          if(world.stats.created>3||world.stats.cached>24)
            throw new Error("World chunk budget breached");
        }
        return {cold,warm,all,newFrames,totalTilesBuilt:made,maxNew,maxCached};
      },route);
    }
    result.runs.push({
      trial,variant,status:response.status(),pageErrors:errors,
      routes:Object.fromEntries(Object.entries(routeResults).map(([name,r])=>[name,{
        cold:stats(r.cold),warm:stats(r.warm),all:stats(r.all),
        newFrames:r.newFrames,totalTilesBuilt:r.totalTilesBuilt,
        maxNew:r.maxNew,maxCached:r.maxCached
      }]))
    });
    await page.close();
    if(errors.length)throw Error(variant+" page errors "+errors);
  }
 }
 result.status="completed";
 result.acceptance={targetDrawMs:16.7,
   baselineDrawsOverBudget:result.runs.filter(r=>r.variant==="baseline")
     .reduce((n,r)=>n+Object.values(r.routes).reduce((m,v)=>m+v.all.drawCallsOver16_7,0),0),
   candidateDrawsOverBudget:result.runs.filter(r=>r.variant==="candidate")
     .reduce((n,r)=>n+Object.values(r.routes).reduce((m,v)=>m+v.all.drawCallsOver16_7,0),0),
   fullGameValidated:false,
   note:"Benchmark completion is not budget acceptance; any candidate draw over target keeps performance HOLD."
 };
 result.acceptance.canvasBudgetMet=result.acceptance.candidateDrawsOverBudget===0;
}finally{await browser.close();}
await writeFile(resolve(outputDir,"p25_moving_camera_benchmark.json"),JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
