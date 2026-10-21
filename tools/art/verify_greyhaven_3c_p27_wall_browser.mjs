// Graphics 3C P2.3 — local, real Chrome multi-location visual parity QA.
// URLs must be independently served on localhost from exact pinned checkouts.
// No gameplay network, world simulation, private assets or deploy.
import {createRequire} from "node:module";
import {writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const executablePath=process.env.CHROME_EXECUTABLE;
const urls={baseline:process.env.GREYHAVEN_BASELINE_URL,
  candidate:process.env.GREYHAVEN_CANDIDATE_URL};
if(!executablePath||!Object.values(urls).every(u=>u?.startsWith("http://127.0.0.1:")))
  throw Error("Chrome executable and two localhost-only URLs required");
const scenarios=[
  {id:"greyhaven",x:4365,y:4150,zoom:.86},
  {id:"bridge",x:1980,y:4240,zoom:.86},
  {id:"grove",x:950,y:2550,zoom:1},
  {id:"briarford",x:1350,y:3950,zoom:.86},
  {id:"stonebrook",x:6500,y:3900,zoom:.86},
  {id:"farmland",x:5650,y:5100,zoom:.86},
  {id:"wilderness",x:7700,y:7200,zoom:.86},
  {id:"city-north",x:4140,y:3500,zoom:1.2},
  {id:"red-lion-door",x:4365,y:4050,zoom:1.4},
  {id:"market-front",x:4450,y:4500,zoom:1.3},
  {id:"river-west",x:1940,y:3400,zoom:.86},
  {id:"river-south",x:2130,y:5400,zoom:.86},
  {id:"greyhaven-west-wall",x:3520,y:3940,zoom:1.25},
  {id:"greyhaven-east-gate",x:4760,y:4180,zoom:1.25},
  {id:"greyhaven-north-corner",x:3520,y:3460,zoom:1.25},
  {id:"greyhaven-south-gate",x:4130,y:4750,zoom:1.25},
];
const out=resolve(process.argv[2]||"assets/environment/greyhaven/3c-p27-review");
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true,executablePath,
 args:["--disable-gpu","--no-first-run","--no-default-browser-check"]});
const report={browser:await browser.version(),
  referenceHead:"cf648a39aaa6309735233c791c273d4ee091215d",
  viewport:{width:960,height:600,deviceScaleFactor:1},
  scenario:"Offline authored overworld, no multiplayer, sixteen fixed cameras",
  samples:{},notes:"Cold cached Canvas tile generation only; NOT multiplayer frame-rate evidence"};
try {
 for(const [name,url] of Object.entries(urls)){
   const page=await browser.newPage();
   await page.setViewport(report.viewport);
   const errs=[];
   page.on("pageerror",e=>errs.push(String(e)));
   const response=await page.goto(url,{waitUntil:"networkidle0",timeout:20000});
   const results={};
   for(const s of scenarios){
     const perf=await page.evaluate(async camera=>{
       const {createAuthoredWorldRenderer}=await import("/src/browser/authored-world-renderer.mjs");
       const {MAP_IDS}=await import("/src/world/authored-maps.mjs");
       const canvas=document.createElement("canvas");canvas.width=960;canvas.height=600;
       canvas.setAttribute("id","qa-canvas");canvas.style.position="absolute";canvas.style.left="0";
       canvas.style.top="0";canvas.style.zIndex="1000";document.body.append(canvas);
       const ctx=canvas.getContext("2d",{alpha:false});
       const world=createAuthoredWorldRenderer();
       let coldMs=0,created=0,newFrames=0,frames=0;
       for(let i=0;i<20;i++){
         ctx.setTransform(1,0,0,1,0,0);
         ctx.save();ctx.translate(480,300);ctx.scale(camera.zoom,camera.zoom);
         ctx.translate(-480,-300);
         const t=performance.now();
         world.draw(ctx,MAP_IDS.overworld,{x:camera.x,y:camera.y},960,600,camera.zoom);
         const dt=performance.now()-t;
         if(world.stats.created){coldMs+=dt;created+=world.stats.created;newFrames++;}
         ctx.restore();frames++;
         if(!world.stats.created && i>=3)break;
       }
       const rgba=ctx.getImageData(0,0,960,600).data;
       // Lightweight duplicate check, plus exact PNG comparisons outside browser.
       let sum1=2166136261>>>0,sum2=0;
       for(let i=0;i<rgba.length;i++){sum1=Math.imul(sum1 ^ rgba[i],16777619)>>>0;sum2=(sum2+rgba[i]*(i%251+1))>>>0;}
       return {coldMs:+coldMs.toFixed(3),created,newFrames,frames,cache:world.stats.cached,
         rgbaHash:[sum1,sum2],size:[960,600]};
     },s);
     results[s.id]=perf;
     await page.$eval("#qa-canvas",async (canvas,id)=>{
       canvas.dataset.qaScenario=id;
     },s.id);
     const el=await page.$("#qa-canvas");
     await el.screenshot({path:resolve(out,s.id+"_"+name+".png")});
     await page.evaluate(()=>document.querySelector("#qa-canvas").remove());
   }
   await page.close();
   report.samples[name]={status:response.status(),pageErrors:errs,results};
   if(response.status()!==200||errs.length)throw Error(name+" browser errors "+errs);
 }
 const parity=Object.keys(report.samples.baseline.results).every(id=>
  JSON.stringify(report.samples.baseline.results[id].rgbaHash)===
  JSON.stringify(report.samples.candidate.results[id].rgbaHash));
 report.pixelHashParity=parity;
 if(!parity)throw Error("VISUAL REGRESSION: at least one location differs");
} finally {await browser.close();}
await writeFile(resolve(out,"p27_wall_pixel_parity_chrome.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
