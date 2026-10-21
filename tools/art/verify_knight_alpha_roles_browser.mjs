#!/usr/bin/env node
// Real Chrome/Firefox *standalone source artwork* validation.
// This is NOT an authenticated game session or a real Core NPC snapshot.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".alpha-role-qa"));
await mkdir(out,{recursive:true});
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,"http://localhost");
  const path=resolve(root,"."+decodeURIComponent(u.pathname)),rel=relative(root,path);
  if(rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")||!existsSync(path)){
   res.writeHead(404);res.end("not found");return;
  }
  res.writeHead(200,{"content-type":mime[extname(path)]||"application/octet-stream",
   "cache-control":"no-store"});res.end(await readFile(path));
 }catch{res.writeHead(500);res.end("QA file failure");}
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
 await page.setViewport({width:1210,height:830,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
 await page.goto("http://127.0.0.1:"+server.address().port+"/web/knight-alpha-role-review.html",
  {waitUntil:"networkidle0"});
 await page.waitForFunction(()=>window.__ALPHA_ROLE_QA__?.().ready,{timeout:30000});
 const scenarios={idle:{players:"silver_idle.webp",npc:"t1_walk.webp",count:4},
  roll:{players:"silver_roll.webp",npc:"t1_roll.webp",count:4},
  attack:{players:null,npc:"t1_attack.webp",count:1},
  block:{players:null,npc:"t1_block.webp",count:1},
  stun:{players:null,npc:null,count:0},
  dead:{players:null,npc:null,count:0}};
 const proof=[];
 for(const [scenario,want] of Object.entries(scenarios)){
  for(let direction=0;direction<8;direction++){
   const state=await page.evaluate(({scenario,direction})=>{
    const s=document.getElementById("scenario"),f=document.getElementById("facing");
    s.value=scenario;s.dispatchEvent(new Event("change",{bubbles:true}));
    f.value=String(direction);f.dispatchEvent(new Event("change",{bubbles:true}));
    return window.__ALPHA_ROLE_QA__();
   },{scenario,direction});
   assert.equal(state.ready,true);
   assert.equal(state.decoded.length,9);
   assert.equal(state.scenario,scenario);
   assert.equal(state.direction,direction);
   assert.equal(state.results.length,6);
   assert.equal(state.drawCount,want.count,JSON.stringify({scenario,direction,state}));
   for(let i=0;i<3;i++){
    assert.equal(state.results[i].kind,"player");
    assert.equal(state.results[i].remote,i!==0);
    assert.deepEqual(state.results[i].assets,want.players?[want.players]:[]);
    assert.equal(state.results[i].drawn,Boolean(want.players));
   }
   assert.deepEqual(state.results[3].assets,want.npc?[want.npc]:[]);
   assert.equal(state.results[3].kind,"npc");
   assert.equal(state.results[4].drawn,false);
   assert.equal(state.results[5].drawn,false);
   assert.equal(state.npcPilotEnabled,false);
   assert.equal(state.realServerConnected,false);
   assert.equal(state.authoritativeInventory,false);
   assert.equal(state.activeGameRenderer,false);
   proof.push({scenario,direction,drawCount:state.drawCount});
  }
 }
 const screenshots=[];
 for(const scenario of ["idle","roll","attack"]){
  await page.evaluate(scenario=>{
   const s=document.getElementById("scenario"),f=document.getElementById("facing");
   s.value=scenario;s.dispatchEvent(new Event("change",{bubbles:true}));
   f.value="2";f.dispatchEvent(new Event("change",{bubbles:true}));
  },scenario);
  const file="alpha_role_"+engine+"_"+scenario+".png";
  await page.screenshot({path:join(out,file),fullPage:true});
  screenshots.push(file);
 }
 assert.deepEqual(errors,[]);
 const report={engine,browser:await browser.version(),cases:proof.length,
  errors,decodedAtlasCount:9,screenshots,
  actualMultiplayer:false,authoritativeNpcFeed:false,
  originalCombatFallback:true,activatedDefault:false,casesProved:proof};
 await writeFile(join(out,"alpha_role_"+engine+".json"),JSON.stringify(report,null,2)+"\n");
 console.log("ALPHA_ROLE_BROWSER="+JSON.stringify({engine,browser:report.browser,
   cases:report.cases,images:9,screenshots:screenshots.length,errors:errors.length,
   authenticatedPlayers:false}));
}finally{
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
