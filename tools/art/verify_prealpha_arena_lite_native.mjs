// Test-only original Chrome/Firefox screenshot review of the actually-authored
// deterministic Arena Lite Canvas. No game modules or real server required.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join,extname} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(repo,"docs/art/prealpha-arena-lite"));
const files=new Map([
 ["/web/prealpha-arena-lite-review.html",join(repo,"web/prealpha-arena-lite-review.html")],
 ["/src/browser/prealpha-arena-lite-floor.mjs",join(repo,"src/browser/prealpha-arena-lite-floor.mjs")],
]);
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 const route=new URL(req.url,"http://127.0.0.1").pathname;
 if(!files.has(route)){res.writeHead(404);res.end("not found");return;}
 try{
  const bytes=await readFile(files.get(route));
  res.writeHead(200,{"Cache-Control":"no-store",
   "Content-Type":extname(route)===".mjs"?"text/javascript; charset=utf-8":"text/html; charset=utf-8"});
  res.end(bytes);
 }catch{res.writeHead(500);res.end();}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
const url="http://127.0.0.1:"+server.address().port+"/web/prealpha-arena-lite-review.html";
const moduleUrl=process.env.PUPPETEER_MODULE_URL;
assert.ok(moduleUrl,"Set installed PUPPETEER_MODULE_URL for local native browser QA");
const puppeteer=(await import(moduleUrl)).default;
const trials=[];
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const cfg={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   assert.ok(cfg.executablePath,engine+" native executable path is required");
   if(engine==="chrome")cfg.args=["--no-sandbox"];
   else {cfg.browser="firefox";cfg.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(cfg);
   const page=await browser.newPage(),errors=[];
   try{
    page.on("pageerror",e=>errors.push(e.message));
    await page.setViewport({width:1320,height:840,deviceScaleFactor:1});
    await page.goto(url,{waitUntil:"networkidle0",timeout:22000});
    await page.waitForFunction(()=>document.body.dataset.reviewReady==="true",{timeout:15000});
    const pixels=await page.evaluate(()=>{
     function report(id){
      const c=document.getElementById(id),x=c.getContext("2d"),bytes=x.getImageData(0,0,c.width,c.height).data;
      let sum=0,min=255,max=0,count=0,centerSum=0,centerPixels=0;
      for(let y=0;y<c.height;y+=4)for(let xx=0;xx<c.width;xx+=4){
       const index=(y*c.width+xx)*4,r=bytes[index],g=bytes[index+1],b=bytes[index+2];
       const lum=(r*0.2126+g*.7152+b*.0722);
       sum+=lum;count++;min=Math.min(min,lum);max=Math.max(max,lum);
       if(xx>=240&&xx<720&&y>=135&&y<405){centerSum+=lum;centerPixels++;}
      }
      return{width:c.width,height:c.height,meanLuminance:sum/count,
       centerLuminance:centerSum/centerPixels,minLuminance:min,maxLuminance:max};
     }
     return{original:report("original"),candidate:report("candidate")};
    });
    assert.deepEqual(errors,[]);
    for(const panel of Object.values(pixels)){
     assert.equal(panel.width,960);assert.equal(panel.height,540);
     assert.ok(panel.minLuminance>=0&&panel.maxLuminance<=255);
    }
    assert.ok(pixels.candidate.centerLuminance>pixels.original.centerLuminance+12,
      "arena floor must be legible rather than almost black");
    assert.ok(pixels.candidate.centerLuminance<155,"floor must not wash out Knight combat");
    assert.ok(pixels.candidate.maxLuminance-pixels.candidate.minLuminance>40);
    const imageName="original_arena_vs_lite_"+engine+".png";
    const screenshot=await page.screenshot({path:join(out,imageName),fullPage:true});
    trials.push({engine,browser:await browser.version(),screenshot:imageName,
     screenshotSha256:sha(screenshot),pageErrors:errors,pixels,reviewOnly:true,gameplayModified:false});
   }finally{await page.close();}
  }finally{await browser?.close();}
 }
 const report={purpose:"source-only real browser Canvas art review—not gameplay",version:1,
  sourceFiles:Object.fromEntries(await Promise.all([...files].map(async ([k,p])=>[k,sha(await readFile(p))]))),
  trials,allNativeSucceeded:true,realMultiplayerAccepted:false,preAlphaDefaultChanged:false,
  productionApproved:false};
 await writeFile(join(out,"arena_lite_native_review.json"),JSON.stringify(report,null,2)+"\n");
 console.log("ARENA_LITE_ORIGINAL_CHROME_FIREFOX_QA "+JSON.stringify({
  passes:trials.length,centerLuminance:trials.map(t=>({engine:t.engine,original:t.pixels.original.centerLuminance,
   candidate:t.pixels.candidate.centerLuminance}))}));
}finally{server.close();}
