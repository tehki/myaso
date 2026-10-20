#!/usr/bin/env node
// Optional real-Chrome acceptance for the A2.7 offline art viewer.
// Needs a locally installed puppeteer package (PUPPETEER_MODULE_URL may be
// an absolute file: URL). No npm install, backend login, production deploy,
// server gameplay or mutation of original assets.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve, relative, extname, join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".a27-local-review"));
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".json":"application/json",".webp":"image/webp",
 ".png":"image/png",".css":"text/css; charset=utf-8"};
await mkdir(out,{recursive:true});
const serve=createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const full=resolve(root,"."+pathname);
    const rel=relative(root,full);
    if(rel.startsWith("..") || rel.startsWith("/") || rel.startsWith("\\") ||
       !existsSync(full)) {res.writeHead(404);res.end("Not found");return;}
    const body=await readFile(full);
    res.writeHead(200,{"Content-Type":mime[extname(full)]||"application/octet-stream",
      "Cache-Control":"no-store"});
    res.end(body);
  }catch(error){res.writeHead(500);res.end("Local preview read failed");}
});
await new Promise(done=>serve.listen(0,"127.0.0.1",done));
const address=serve.address();
let browser;
try{
  const dependency=process.env.PUPPETEER_MODULE_URL||"puppeteer";
  const puppeteer=(await import(dependency)).default;
  browser=await puppeteer.launch({executablePath:process.env.CHROME_EXECUTABLE||undefined,
    headless:true,args:["--no-sandbox","--disable-gpu-sandbox"]});
  const page=await browser.newPage();
  await page.setViewport({width:1220,height:960,deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  page.on("response",response=>{
    if(response.status()>=400)errors.push("HTTP "+response.status()+" "+response.url());
  });
  await page.goto("http://127.0.0.1:"+address.port+
    "/web/greyhaven-a27-art-preview.html",{waitUntil:"networkidle0"});
  await page.waitForFunction(()=>document.querySelector("#status")?.dataset.state==="ready",
    {timeout:30000});
  const initial=await page.evaluate(()=>window.__greyhavenArtReview());
  assert.equal(initial.loadedBuilding,"red_lion");
  assert.equal(initial.gameXYCompatible,false);
  assert.equal(initial.authoritativePortalIntegrated,false);
  assert.equal(initial.artOnly,true);
  assert.equal(initial.roofOpacity,1);
  await page.screenshot({path:join(out,"greyhaven_a27_browser_red_lion.png"),fullPage:true});
  const results={red_lion:initial};
  for(const slug of ["gable_merchant","blacksmith"]){
    await page.select("#building",slug);
    await page.waitForFunction(want=>window.__greyhavenArtReview().loadedBuilding===want,
      {timeout:30000},slug);
    results[slug]=await page.evaluate(()=>window.__greyhavenArtReview());
    if(slug==="blacksmith") {
      assert.deepEqual(results[slug].testSilhouetteOffsetFromVisualDoor,{x:98,y:58},
        "The default visual test silhouette must not obstruct the Blacksmith doorway");
    }
    await page.screenshot({path:join(out,"greyhaven_a27_browser_"+slug+".png"),fullPage:true});
  }
  await page.$eval("#roof",el=>{
    el.value="25";
    el.dispatchEvent(new Event("input",{bubbles:true}));
  });
  await page.click("#roof-front");
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const faded=await page.evaluate(()=>window.__greyhavenArtReview());
  assert.equal(faded.roofOpacity,.25);
  assert.equal(faded.roofFront,false);
  await page.screenshot({path:join(out,"greyhaven_a27_browser_roof_fade.png"),fullPage:true});
  await page.click("#reset");
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  const reset=await page.evaluate(()=>window.__greyhavenArtReview());
  assert.equal(reset.roofOpacity,1);
  assert.equal(reset.roofFront,true);
  assert.deepEqual(errors,[]);
  const report={
    milestone:"Blood & Iron A2.7 standalone browser art viewer acceptance",
    browser:await browser.version(),
    testedURLPath:"/web/greyhaven-a27-art-preview.html",
    screenshotType:"Real Chrome via local HTTP; 1220x960 DPR 1",
    loaded:results,
    faded,reset,
    browserErrors:errors,
    noCombatRuntime:true,
    noRealGameFrameTimeTest:true,
    notProductionApproved:true,
    caveat:"Decoded PNG/WebP performance here is a static preview, not in-game FPS/VRAM."
  };
  await writeFile(join(out,"greyhaven_a27_browser_report.json"),
    JSON.stringify(report,null,2)+"\n");
  console.log("A27_BROWSER_REPORT="+JSON.stringify(report));
}finally{
  if(browser)await browser.close();
  await new Promise(done=>serve.close(done));
}
