#!/usr/bin/env node
// Graphics 3A backward compatibility: original Silver/T1 preview pages still
// draw with explicit QA actor kinds. Native browser source art ONLY.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const dest=resolve(process.argv[2]||join(root,".alpha-legacy-role-browser"));
await mkdir(dest,{recursive:true});
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
 ".mjs":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://localhost");
  const file=resolve(root,"."+decodeURIComponent(url.pathname));
  const rel=relative(root,file);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(file)){
   res.writeHead(404);res.end("Not Found");return;
  }
  res.writeHead(200,{"content-type":types[extname(file)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(await readFile(file));
 }catch{res.writeHead(500);res.end("No asset");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 browser=await pp.launch({browser:engine,headless:true,
   executablePath:process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
   args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1200,height:940,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.evaluateOnNewDocument(()=>{
   window.__ALPHA_LEGACY_DRAWS__=[];
   const proto=CanvasRenderingContext2D.prototype,orig=proto.drawImage;
   proto.drawImage=function(image,...args){
    if(image?.src?.endsWith(".webp"))window.__ALPHA_LEGACY_DRAWS__.push(
      {file:new URL(image.src).pathname.split("/").at(-1),sx:args[0],sy:args[1]});
    return orig.call(this,image,...args);
   };
 });
 const origin="http://127.0.0.1:"+server.address().port;
 await page.goto(origin+"/web/knight-preview.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>{
   const draws=window.__ALPHA_LEGACY_DRAWS__||[];
   return draws.some(d=>d.file==="silver_idle.webp")&&
          draws.some(d=>d.file==="t1_walk.webp");
 },{timeout:20000});
 const legacy=await page.evaluate(()=>({
  drawnNames:[...new Set(window.__ALPHA_LEGACY_DRAWS__.map(d=>d.file))],
  status:document.querySelector("#ready")?.textContent,
 }));
 assert.ok(legacy.drawnNames.includes("silver_idle.webp"));
 assert.ok(legacy.drawnNames.includes("t1_walk.webp"));
 assert.match(legacy.status,/9\/9/);
 await page.screenshot({path:join(dest,"alpha_legacy_"+engine+"_preview.png"),fullPage:true});
 await page.goto(origin+"/web/knight-scale-a211-preview.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__knightA211Preview?.().state==="ready",{timeout:20000});
 const idle=await page.evaluate(()=>window.__knightA211Preview());
 assert.equal(idle.baseline.width,80);
 assert.equal(idle.approved.width,96);
 for(const [pose,desired] of [["silver_roll",134],["t1_roll",134]]){
  await page.select("#pose",pose);
  const actual=await page.evaluate(()=>window.__knightA211Preview());
  assert.equal(actual.state,"ready");
  assert.equal(actual.approved.width,desired);
 }
 const roll=await page.evaluate(()=>window.__knightA211Preview());
 assert.deepEqual(errors,[]);
 await page.screenshot({path:join(dest,"alpha_legacy_"+engine+"_scale.png"),fullPage:true});
 const report={engine,browser:await browser.version(),legacy,
   rollbackRect:[80,112],approvedRect:[96,134],
   loadedAtlases:roll.loadedAtlases,errors,
   screenshots:["alpha_legacy_"+engine+"_preview.png","alpha_legacy_"+engine+"_scale.png"],
   realGameplay:false,serverConnection:false,liveNpcPilot:false};
 await writeFile(join(dest,"alpha_legacy_"+engine+".json"),JSON.stringify(report,null,2)+"\n");
 console.log("KNIGHT_ALPHA_LEGACY="+JSON.stringify({browser:report.browser,
   sprites:legacy.drawnNames,approvedRect:report.approvedRect,
   errors:errors.length}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
