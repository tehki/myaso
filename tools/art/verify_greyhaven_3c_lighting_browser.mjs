// Graphics 3C P2.4 real Chrome, pinned P2.3-vs-lighting visual regression.
// Start two independent localhost static servers; this test never joins a realm.
// Uses exact Canvas RGBA hashes for unchanged areas and intentional city changes.
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {writeFile,mkdir} from "node:fs/promises";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const browserPath=process.env.CHROME_EXECUTABLE;
const urls={baseline:process.env.GREYHAVEN_BASELINE_URL,
  candidate:process.env.GREYHAVEN_CANDIDATE_URL};
if(!browserPath||!Object.values(urls).every(u=>u?.startsWith("http://127.0.0.1:")))
  throw Error("Real Chrome and independent localhost URLs are required");
const stable=[
  {id:"bridge",x:1980,y:4240,zoom:.86},
  {id:"grove",x:950,y:2550,zoom:1},
  {id:"briarford",x:1350,y:3950,zoom:.86},
  {id:"stonebrook",x:6500,y:3900,zoom:.86},
  {id:"farmland",x:5650,y:5100,zoom:.86},
  {id:"wilderness",x:7700,y:7200,zoom:.86}
];
const lighting=[
  {id:"red-lion-door",x:4365,y:4050,zoom:1.4},
  {id:"greyhaven",x:4365,y:4150,zoom:.86},
  {id:"market-front",x:4450,y:4500,zoom:1.3},
  {id:"chapel-front",x:4570,y:3815,zoom:1.3}
];
const scenarios=[...lighting,...stable];
const out=resolve(process.argv[2]||"assets/environment/greyhaven/3c-p24-review");
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true,executablePath:browserPath,
 args:["--disable-gpu","--no-first-run","--no-default-browser-check"]});
const report={chrome:await browser.version(),headRef:"ff74af212d606f4fb8aa11336cc5633dd54fe181",
  viewport:{width:960,height:600,deviceScaleFactor:1},
  source:"two offline localhost world-preview pages; cold Canvas chunk captures; no multiplayer",
  stable:stable.map(x=>x.id),changed:lighting.map(x=>x.id),samples:{},parity:{}};
try{
for(const [name,url] of Object.entries(urls)){
 const page=await browser.newPage();
 await page.setViewport(report.viewport);
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 const response=await page.goto(url,{waitUntil:"networkidle0",timeout:25000});
 const measurements={};
 for(const scene of scenarios){
   const perf=await page.evaluate(async camera=>{
     const {createAuthoredWorldRenderer}=await import("/src/browser/authored-world-renderer.mjs");
     const {MAP_IDS}=await import("/src/world/authored-maps.mjs");
     const canvas=document.createElement("canvas");
     canvas.id="p24-canvas";canvas.width=960;canvas.height=600;
     canvas.style.position="absolute";canvas.style.left="0";canvas.style.top="0";
     canvas.style.zIndex="1000";document.body.append(canvas);
     const ctx=canvas.getContext("2d",{alpha:false});
     const world=createAuthoredWorldRenderer();
     let coldMs=0,created=0,coldFrames=0;
     for(let i=0;i<18;i++){
       ctx.setTransform(1,0,0,1,0,0);
       ctx.save();ctx.translate(480,300);ctx.scale(camera.zoom,camera.zoom);
       ctx.translate(-480,-300);
       const t=performance.now();
       world.draw(ctx,MAP_IDS.overworld,{x:camera.x,y:camera.y},960,600,camera.zoom);
       const elapsed=performance.now()-t;
       if(world.stats.created){coldMs+=elapsed;created+=world.stats.created;coldFrames++;}
       ctx.restore();
       if(!world.stats.created&&i>=3)break;
     }
     const rgba=ctx.getImageData(0,0,960,600).data;
     let xor=2166136261>>>0,weighted=0;
     for(let i=0;i<rgba.length;i++){
       xor=Math.imul(xor^rgba[i],16777619)>>>0;
       weighted=(weighted+rgba[i]*(i%251+1))>>>0;
     }
     return {coldMs:+coldMs.toFixed(2),created,coldFrames,cached:world.stats.cached,
       rgbaHash:[xor,weighted]};
   },scene);
   measurements[scene.id]=perf;
   await (await page.$("#p24-canvas")).screenshot({path:resolve(out,scene.id+"_"+name+".png")});
   await page.evaluate(()=>document.querySelector("#p24-canvas")?.remove());
 }
 report.samples[name]={httpStatus:response.status(),pageErrors:errors,measurements};
 await page.close();
 if(response.status()!==200||errors.length)throw Error(name+" returned browser errors");
}
for(const s of scenarios){
  const a=report.samples.baseline.measurements[s.id];
  const b=report.samples.candidate.measurements[s.id];
  report.parity[s.id]=JSON.stringify(a.rgbaHash)===JSON.stringify(b.rgbaHash);
}
if(stable.some(s=>!report.parity[s.id]))throw Error("Non-Greyhaven scene changed");
if(lighting.every(s=>report.parity[s.id]))throw Error("No intentional lighting pixel changes were recorded");
}finally{await browser.close();}
await writeFile(resolve(out,"p24_lighting_chrome_report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
