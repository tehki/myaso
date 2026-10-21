#!/usr/bin/env node
// Localhost-only Chrome acceptance of A2.11 baseline vs approved renderer.
// No remote services, multiplayer or production game navigation.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".a211-local"));
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const uri=new URL(req.url,"http://localhost");
  const target=resolve(root,"."+decodeURIComponent(uri.pathname));
  const rel=relative(root,target);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||
     !existsSync(target)){res.writeHead(404);res.end("not found");return;}
  const bytes=await readFile(target);
  res.writeHead(200,{"Content-Type":mime[extname(target)]||"application/octet-stream",
    "Cache-Control":"no-store"});res.end(bytes);
 }catch{res.writeHead(500);res.end("local QA file server error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try{
 const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 browser=await pp.launch({headless:true,
   executablePath:process.env.CHROME_EXECUTABLE||undefined,
   args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1180,height:1030,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
  "/web/knight-scale-a211-preview.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__knightA211Preview?.().state==="ready",
  {timeout:30000});
 async function snapshot(pose,file,expected){
   const state=await page.evaluate(async pose=>{
     const el=document.getElementById("pose");
     el.value=pose;el.dispatchEvent(new Event("change",{bubbles:true}));
     await new Promise(requestAnimationFrame);
     return window.__knightA211Preview();
   },pose);
   assert.equal(state.state,"ready");
   assert.equal(state.pose,pose);
   assert.deepEqual([state.baseline.width,state.approved.width],expected);
   assert.equal(state.baseline.x+state.baseline.width/2,0);
   assert.equal(state.approved.x+state.approved.width/2,0);
   assert.equal(state.loadedAtlases.baseline,9);
   assert.equal(state.loadedAtlases.approved,9);
   assert.equal(state.rollDurationMs,350);
   assert.equal(state.visualScaleApproved,1.2);
   assert.equal(state.gameplayAltered,false);
   assert.equal(state.hitboxesChanged,false);
   assert.equal(state.serverAuthorityChanged,false);
   assert.equal(state.anatomicalFootPivotVerified,false);
   await page.screenshot({path:join(out,file),fullPage:true});
   return state;
 }
 const idle=await snapshot("idle","a211_knight_idle_100_vs_120.png",[80,96]);
 const silverRoll=await snapshot("silver_roll","a211_silver_roll_100_vs_120.png",[112,134]);
 const t1Roll=await snapshot("t1_roll","a211_t1_roll_100_vs_120.png",[112,134]);
 assert.deepEqual(errors,[]);
 const report={
  milestone:"Blood & Iron A2.11 owner-approved 120 percent opt-in knight renderer",
  browser:await browser.version(),
  visualScale:1.2,
  baselineRollbackUrlFlag:"knights=1&knightScale=100",
  approvedUrlFlag:"knights=1",
  idle,silverRoll,t1Roll,
  pageErrors:errors,
  originalKnightWebpsModified:false,
  A3RollDurationMs:350,
  hitboxesModified:false,
  combatOrServerModified:false,
  productionDeployed:false,
  actualMultiplayerFpsMeasured:false,
  note:"Local visual comparison using real knight renderer and WebPs; not online combat or anatomy proof."
 };
 await writeFile(join(out,"a211_chrome_report.json"),
  JSON.stringify(report,null,2)+"\n");
 console.log("A211_REPORT="+JSON.stringify({browser:report.browser,
  idle:[idle.baseline.width,idle.approved.width],
  roll:[silverRoll.baseline.width,silverRoll.approved.width],
  errors:errors.length}));
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
