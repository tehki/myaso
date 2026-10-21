#!/usr/bin/env node
// Original Chrome/Firefox pixels with FAKE fixture receipts. No live Core.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {relative,resolve,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".mainhand-revision-qa"));
await mkdir(out,{recursive:true});
const types={".html":"text/html; charset=utf-8",".mjs":"text/javascript",".js":"text/javascript",
  ".json":"application/json",".webp":"image/webp",".png":"image/png"};
const server=createServer(async(req,res)=>{
 try{
  const target=resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname));
  const rel=relative(root,target);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(target)){
   res.writeHead(404);res.end("missing");return;
  }
  res.writeHead(200,{"content-type":types[extname(target)]||"application/octet-stream",
    "cache-control":"no-store"});res.end(await readFile(target));
 }catch {res.writeHead(500);res.end("bad source");}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
let browser;
try{
 const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
 const engine=process.env.KNIGHT_QA_BROWSER||"chrome";
 browser=await puppeteer.launch({browser:engine,headless:true,
   executablePath:process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE||undefined,
   args:["--no-sandbox","--disable-gpu-sandbox"]});
 const page=await browser.newPage();
 await page.setViewport({width:1350,height:760,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push(r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+
   "/web/silver-mainhand-revision-review.html",{waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__GRAPHICS3A_REVISION_QA__?.().originalAtlases===5,{timeout:25000});
 const clips=["silver_idle","silver_walk","silver_sprint","silver_jump","silver_roll"];
 const scenarios=["equip","drop","late","reEquip","conflict","oldEpoch"];
 const results=[];
 for(const clip of clips)for(const scenario of scenarios){
  const state=await page.evaluate(({clip,scenario})=>{
   for(const [id,val] of [["clip",clip],["scenario",scenario]]){
    const select=document.getElementById(id);
    select.value=val;
    select.dispatchEvent(new Event("change",{bubbles:true}));
   }
   return window.__GRAPHICS3A_REVISION_QA__();
  },{clip,scenario});
  assert.equal(state.clip,clip);
  assert.equal(state.scenario,scenario);
  assert.equal(state.realGame,false);
  assert.equal(state.realReceipts,false);
  assert.equal(state.productionEnabled,false);
  assert.deepEqual(state.originalSwordPx,[42,115]);
  assert.equal(state.originalAtlases,5);
  const expected=(!["silver_jump","silver_roll"].includes(clip)&&
    ["equip","reEquip"].includes(scenario))?8:0;
  assert.equal(state.visible,expected,JSON.stringify({clip,scenario,state}));
  assert.equal(state.directions.length,8);
  assert.deepEqual(state.directions.map(x=>x.direction),[0,1,2,3,4,5,6,7]);
  assert.equal(state.received.at(-1)?.accepted,
    ["equip","drop","reEquip"].includes(scenario));
  if(scenario==="conflict")assert.equal(state.latest.quarantined,true);
  if(scenario==="late")assert.equal(state.latest.armed,false);
  if(scenario==="oldEpoch")assert.equal(state.latest.sessionEpoch,2);
  results.push({clip,scenario,visible:state.visible,reason:state.received.at(-1).reason});
 }
 const shots=[];
 for(const [clip,scenario] of [
  ["silver_idle","equip"],["silver_idle","drop"],
  ["silver_idle","late"],["silver_idle","conflict"],
  ["silver_roll","equip"]]){
  await page.evaluate(({clip,scenario})=>{
   for(const [id,val] of [["clip",clip],["scenario",scenario]]){
    const el=document.getElementById(id);el.value=val;
    el.dispatchEvent(new Event("change",{bubbles:true}));
   }
  },{clip,scenario});
  const name="revision_"+engine+"_"+clip+"_"+scenario+".png";
  await page.screenshot({path:join(out,name),fullPage:true});
  shots.push(name);
 }
 assert.deepEqual(errors,[]);
 const report={engine,browser:await browser.version(),scenarios:results.length,
  perScenarioDirections:8,checkedFacingOutcomes:results.length*8,
  screenshots:shots,errors,sourceOriginal:true,
  fixturesOnly:true,realAuthenticatedItems:false,realMultiplayer:false,
  tests:results};
 await writeFile(join(out,"revision_"+engine+".json"),JSON.stringify(report,null,2)+"\n");
 console.log("SILVER_MAINHAND_REVISION_BROWSER="+JSON.stringify({
  engine,browser:report.browser,scenarios:report.scenarios,
  checkedFacingOutcomes:report.checkedFacingOutcomes,
  screenshots:shots.length,errors:errors.length,server:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
