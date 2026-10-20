#!/usr/bin/env node
// A3A-02: real-browser smoke acceptance of the optional Knight WebP renderer.
// Standalone localhost QA, not an authoritative multiplayer or Combat test.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {existsSync} from "node:fs";
import {resolve,relative,extname,join} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const out=resolve(process.argv[2]||join(root,".knight-fallback-local"));
const mime={".html":"text/html; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",".webp":"image/webp",".json":"application/json"};
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
  try {
    const uri=new URL(req.url,"http://localhost");
    const target=resolve(root,"."+decodeURIComponent(uri.pathname));
    const rel=relative(root,target);
    if (rel.startsWith("..")||rel.startsWith("/")||rel.startsWith("\\")
      ||!existsSync(target)) {res.writeHead(404);res.end("not found");return;}
    const bytes=await readFile(target);
    res.writeHead(200,{"Content-Type":mime[extname(target)]||"application/octet-stream",
      "Cache-Control":"no-store"});res.end(bytes);
  }catch {res.writeHead(500);res.end("local QA server error");}
});
await new Promise(done=>server.listen(0,"127.0.0.1",done));
let browser;
try {
  const pp=(await import(process.env.PUPPETEER_MODULE_URL||"puppeteer")).default;
  const browserName=process.env.KNIGHT_QA_BROWSER||"chrome";
  const execPath=process.env.KNIGHT_QA_EXECUTABLE||process.env.CHROME_EXECUTABLE;
  browser=await pp.launch({browser:browserName,headless:true,
    executablePath:execPath||undefined,
    args:["--no-sandbox","--disable-gpu-sandbox"]});
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:820,deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:"+server.address().port+
    "/web/knight-scale-a211-preview.html",{waitUntil:"networkidle0"});
  const report=await page.evaluate(async()=>{
    const {createKnightSpriteRenderer,KNIGHT_FRAME_PX,KNIGHT_ROLL_PRESENTATION_MS,
      KNIGHT_PRESENTATION_SCALE}=await import("/web/knight-sprites.mjs");
    const {COMBAT_ACTION}=await import("/src/browser/combat-readability.mjs");
    const renderer=createKnightSpriteRenderer();
    // The native browser must decode all nine actual WebP atlases.
    const timeout=performance.now()+20000;
    while(renderer.loaded().length!==9&&performance.now()<timeout){
      await new Promise(r=>setTimeout(r,50));
    }
    const loaded=renderer.loaded().slice().sort();
    const canvas=document.createElement("canvas");
    canvas.width=1200;canvas.height=740;
    canvas.style="display:block;width:100%;margin:22px auto;background:#26343c";
    canvas.setAttribute("aria-label","A3A Knight browser fallback evidence");
    document.querySelector("main")?.append(canvas);
    const ctx=canvas.getContext("2d");
    const nativeDraw=ctx.drawImage.bind(ctx);
    const draws=[];
    ctx.drawImage=(...args)=>{
      draws.push({atlas:args[0]?.src?.split("/").at(-1),
        frame:args[1]/KNIGHT_FRAME_PX,
        direction:args[2]/KNIGHT_FRAME_PX,
        dest:[...args.slice(5,9)]});
      nativeDraw(...args);
    };
    const local={x:120,y:120,facing:Math.PI/2,action:COMBAT_ACTION.idle};
    const remote={x:120,y:120,facing:Math.PI/2,action:COMBAT_ACTION.idle,netId:987};
    const results=[];
    const cases=[
      ["Silver idle",local,COMBAT_ACTION.idle,1000,true],
      ["Silver kick: fallback",local,COMBAT_ACTION.kickWindup,1100,false],
      ["Silver roll begins",local,COMBAT_ACTION.dodge,2000,true],
      ["Roll recovery",local,COMBAT_ACTION.dodgeRecovery,2180,true],
      ["Silver stun: fallback",local,COMBAT_ACTION.stunned,2400,false],
      ["Next roll starts new",local,COMBAT_ACTION.dodge,2500,true],
      ["Sentinel sword",remote,COMBAT_ACTION.attackActive,1000,true],
      ["Sentinel kick: fallback",remote,COMBAT_ACTION.kickActive,1100,false],
      ["Sentinel block",remote,COMBAT_ACTION.block,1200,true],
      ["Sentinel death: fallback",remote,COMBAT_ACTION.dead,1300,false],
    ];
    for(let i=0;i<cases.length;i++){
      const [name,fighter,action,nowMs,expectDraw]=cases[i];
      fighter.action=action;
      const x=120+(i%5)*235,y=145+Math.floor(i/5)*330;
      const from=draws.length;
      ctx.save();ctx.translate(x,y);
      const drawn=renderer.draw(ctx,fighter,{remote:fighter===remote,nowMs});
      const lastDraw=draws.length>from?draws.at(-1):null;
      if(!drawn){
        // Visual reference only: this canvas placeholder is NOT game artwork.
        ctx.fillStyle="#d0aa65";ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle="#f5ebd7";ctx.font="14px sans-serif";
      ctx.fillText(name,x-90,y+90);
      ctx.fillStyle="#b9d2d7";ctx.font="12px monospace";
      ctx.fillText(drawn?"atlas frame "+lastDraw?.frame:"original game fallback",x-90,y+109);
      results.push({name,action,drawn,expectDraw,frame:lastDraw?.frame??null,
        dest:lastDraw?.dest??null});
    }
    return {loaded,results,scale:KNIGHT_PRESENTATION_SCALE,
      rollMs:KNIGHT_ROLL_PRESENTATION_MS,
      candidateSource:"original published WebPs",renderer:"native browser canvas",
      networkedMultiplayerVerified:false,authoritativeCombatChanged:false};
  });
  assert.equal(report.loaded.length,9,"all nine original WebP atlases must decode");
  assert.equal(report.scale,1.2);
  assert.equal(report.rollMs,350);
  for(const row of report.results){
    assert.equal(row.drawn,row.expectDraw,row.name);
    if(row.drawn)assert.deepEqual(row.dest.slice(2),
      row.name.includes("roll")||row.name.includes("Roll")?[134,134]:[96,96],
      row.name+" must preserve 120% visual scale");
  }
  assert.deepEqual(report.results.filter(x=>x.name==="Silver roll begins").map(x=>x.frame),[0]);
  assert.deepEqual(report.results.filter(x=>x.name==="Roll recovery").map(x=>x.frame),[4]);
  assert.deepEqual(report.results.filter(x=>x.name==="Next roll starts new").map(x=>x.frame),[0]);
  assert.deepEqual(errors,[]);
  report.browser=await browser.version();
  report.errors=errors;
  await page.screenshot({path:join(out,"knight_fallback_browser.png"),fullPage:true});
  await writeFile(join(out,"knight_fallback_browser.json"),
    JSON.stringify(report,null,2)+"\n");
  console.log("KNIGHT_FALLBACK_BROWSER="+JSON.stringify({
    browser:report.browser,atlasCount:report.loaded.length,
    states:report.results.length,rollFrames:[0,4,0],errors:errors.length}));
} finally {
  if(browser)await browser.close();
  await new Promise(done=>server.close(done));
}
