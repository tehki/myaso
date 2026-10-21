// Graphics 3C — real Chrome, two localhost checkouts, fixed cold-tile benchmark.
// PUPPETEER_MODULE_PATH locates a separately installed puppeteer package.
import {createRequire} from "node:module";
import {writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH || "puppeteer");
const executablePath=process.env.CHROME_EXECUTABLE;
const baseline=process.env.GREYHAVEN_BASELINE_URL;
const candidate=process.env.GREYHAVEN_CANDIDATE_URL;
if(!executablePath||![baseline,candidate].every(u=>u?.startsWith("http://127.0.0.1:")))
  throw new Error("local Chrome executable and two localhost URL env vars required");
const out=resolve(process.argv[2]||"assets/environment/greyhaven/3c-p2-review");
await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({headless:true,executablePath,
  args:["--disable-gpu","--no-first-run","--no-default-browser-check"]});
const report={chrome:await browser.version(),viewport:{width:1120,height:720,deviceScaleFactor:1},
  baselineHead:"260a7b85a33b7a51663a70af8d410e0d33e0e236",
  scenario:"offline Greyhaven Red Lion at 4365,4150 zoom 0.86, no gameplay network",
  samples:{},notes:"Seven runs of cold authored-world tile builds; not multiplayer FPS."};
try {
  for(const [name,url] of [["baseline",baseline],["candidate",candidate]]) {
    const page=await browser.newPage();
    await page.setViewport({width:1120,height:720,deviceScaleFactor:1});
    const pageErrors=[];page.on("pageerror",e=>pageErrors.push(String(e)));
    const response=await page.goto(url,{waitUntil:"networkidle0",timeout:20000});
    await new Promise(done=>setTimeout(done,1600));
    const perf=await page.evaluate(async()=>{
      const {createAuthoredWorldRenderer}=await import("/src/browser/authored-world-renderer.mjs");
      const {MAP_IDS}=await import("/src/world/authored-maps.mjs");
      const rows=[];
      for(let repetition=0;repetition<7;repetition++){
        const canvas=document.createElement("canvas");
        canvas.width=1120;canvas.height=720;
        const ctx=canvas.getContext("2d",{alpha:false});
        const renderer=createAuthoredWorldRenderer();
        let buildMs=0,created=0,frames=0;
        for(let i=0;i<12;i++){
          const start=performance.now();
          renderer.draw(ctx,MAP_IDS.overworld,{x:4365,y:4150},1120,720,.86);
          const elapsed=performance.now()-start;
          if(renderer.stats.created){buildMs+=elapsed;created+=renderer.stats.created;frames++;}
        }
        rows.push({buildMs:+buildMs.toFixed(3),created,frames});
      }
      return {rows,canvasSize:[1120,720]};
    });
    await page.screenshot({path:resolve(out,"greyhaven_3c_"+name+"_chrome.png")});
    report.samples[name]={httpStatus:response.status(),pageErrors,perf};
    await page.close();
    if(response.status()!==200||pageErrors.length)
      throw new Error(name+" browser errors: "+pageErrors.join(","));
  }
} finally {await browser.close();}
await writeFile(resolve(out,"greyhaven_3c_browser_report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
