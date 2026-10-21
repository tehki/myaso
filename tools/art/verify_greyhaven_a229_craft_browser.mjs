#!/usr/bin/env node
// A2.29 real Chrome/Firefox material-craft crop review, exact original source only.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(repo,".a229-craft-qa"));
const types={".mjs":"text/javascript; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".html":"text/html; charset=utf-8",".json":"application/json",".webp":"image/webp",".png":"image/png"};
const whitelist=["red-lion-a225-architecture-handoff.json",
 "a228-review/greyhaven_a228_facade_report.json",
 "a224-review/red_lion_a224_base.webp",
 "a228-review/red_lion_a228_facade_day.webp",
 "a228-review/red_lion_a228_facade_dusk.webp"];
const assetRoot="assets/environment/greyhaven/";
const hashes={};
for(const name of whitelist.filter(x=>x.endsWith(".webp"))){
 const raw=await readFile(join(repo,assetRoot,name));
 hashes[name]=createHash("sha256").update(raw).digest("hex");
}
assert.equal(hashes["a228-review/red_lion_a228_facade_day.webp"],
 "52e173ee65b112bf3d4b989bcbda8ac7539eeadcbc7a7477ba646c44527ded03");
assert.equal(hashes["a228-review/red_lion_a228_facade_dusk.webp"],
 "65845e26b69d3b36815dc8e0adc3a3166d75833adddb2f7ede5e0d4a5663e8bf");
const server=createServer(async (req,res)=>{
 try{
  const url=new URL(req.url,"http://127.0.0.1");
  const file=resolve(repo,"."+decodeURIComponent(url.pathname));
  const rel=relative(repo,file).replace(/\\/g,"/");
  if(rel.startsWith("../")||rel.startsWith("/")||!existsSync(file)||
    !(rel.startsWith("web/greyhaven-a229-craft-inspector.")||
      (rel.startsWith(assetRoot)&&whitelist.includes(rel.slice(assetRoot.length))))){
   res.writeHead(404);res.end("not found");return;
  }
  const data=await readFile(file);
  res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream",
    "Cache-Control":"no-store"});res.end(data);
 }catch(e){res.writeHead(500);res.end("isolated QA file error");}
});
await mkdir(out,{recursive:true});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const url="http://127.0.0.1:"+server.address().port+"/web/greyhaven-a229-craft-inspector.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
const checks=[];
try{
 for(const kind of ["chrome","firefox"]){
  let browser;
  try{
   const args={headless:true,executablePath:kind==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(kind==="firefox"){args.browser="firefox";args.protocol="webDriverBiDi";}
   else args.args=["--no-sandbox","--disable-gpu-sandbox"];
   browser=await puppeteer.launch(args);
   const page=await browser.newPage();
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
   const version=await browser.version();
   for(const dpr of [1,2]){
    await page.setViewport({width:1500,height:2010,deviceScaleFactor:dpr});
    await page.goto(url,{waitUntil:"networkidle0"});
    await page.waitForFunction(()=>window.__a229Review?.()?.ready,{timeout:12000});
    const state=await page.evaluate(()=>window.__a229Review());
    assert.equal(state.ready,true);
    assert.equal(state.gameZoom,0.84);
    assert.equal(state.metersPerWorldUnit,0.025);
    assert.equal(state.roofBytesChanged,false);
    assert.equal(state.runtimeIntegrated,false);
    assert.equal(state.dynamicLightingEngine,false);
    assert.equal(state.productionApproved,false);
    assert.equal(Object.keys(state.regions).length,4);
    for(const item of Object.values(state.regions)){
     assert.equal(Object.keys(item.variants).length,2);
     for(const result of Object.values(item.variants)){
      assert.equal(result.alphaDifferences,0);
      assert.ok(result.visibleSourcePixels>100);
      assert.ok(result.changedVisibleRGB>30);
     }
    }
    const screenshot="greyhaven_a229_"+kind+"_dpr"+dpr+"_craft.png";
    await page.screenshot({path:join(out,screenshot),fullPage:true});
    assert.deepEqual(errors,[]);
    checks.push({kind,browserVersion:version,dpr,screenshot,errors:[...errors],state});
   }
  }finally{await browser?.close();}
 }
 const report={milestone:"Blood & Iron A2.29 original facade material close-up and DPR1/2 QA",
  baselineGraphicsHead:"6d40942b82b24d8596ed55af2850454d00a9165b",
  browsers:checks,sourceHashes:hashes,
  trueGameCapture:false,roofEdited:false,dynamicAtmosphereLightingValidated:false,
  fighterReadabilityValidated:false,liveFrameTimingMeasured:false,
  productionApproved:false};
 await writeFile(join(out,"greyhaven_a229_craft_browser_report.json"),JSON.stringify(report,null,2)+"\n");
 console.log("A229="+JSON.stringify(checks.map(x=>({kind:x.kind,dpr:x.dpr,version:x.browserVersion,
  regionCount:Object.keys(x.state.regions).length,errors:x.errors.length,screenshot:x.screenshot}))));
}finally{await new Promise(done=>server.close(done));}
