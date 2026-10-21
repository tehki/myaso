// Graphics 3C P0 -- minimal independent-browser ORIGINAL Graphics 3B WebP probe.
// Diagnostic only: no world map, canvas, sprites, items, Combat or gameplay.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join,dirname} from "node:path";
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {platform,cpus,totalmem,freemem} from "node:os";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const source=resolve(process.argv[2]||"");
const out=resolve(process.argv[3]||"assets/environment/greyhaven/3c-p35-minimal-webp.json");
const PIN="2a11b923591a682bbae3cffe6d9f70b0d2036de8";
const actual=execFileSync("git",["-C",source,"rev-parse","HEAD"],{encoding:"utf8"}).trim();
assert.equal(actual,PIN,"Refuse unpinned 3B source");
const dir=join(source,"assets/environment/greyhaven/armory-p0");
const names=["armory_rack.webp","armory_sword.webp"],bytes={},hashes={};
for(const n of names){bytes[n]=await readFile(join(dir,n));hashes[n]=createHash("sha256").update(bytes[n]).digest("hex");}
assert.equal(hashes["armory_sword.webp"],"795874620d07652e55f5e8a76952d2075f17196fc892eff88d46b165638a3b31");
assert.equal(hashes["armory_rack.webp"],"83d0d228785f80e95efd18fa6ef46a77d4ce8500a3fd5cf777d0f1f5ee3917b8");
const loadMode=process.env.P0_QA_IMAGE_LOAD_MODE||"sequential";
assert.ok(loadMode==="sequential"||loadMode==="parallel");
const started=Date.now(),requests=[];
const html=[
 '<!doctype html><meta charset="utf-8"><title>Original first-party WebP diagnostic</title>',
 '<script>',
 'globalThis.__probe={phase:"start",events:[],done:false};',
 'globalThis.__parallelImageLoads='+String(loadMode==="parallel")+';',
 '(async()=>{',
 'const p=globalThis.__probe;const now=()=>performance.now();',
 'const record=(name,stage,extra={})=>p.events.push({name,stage,atMs:Math.round(now()),...extra});',
 'const load=async(name)=>{',
 ' const im=new Image();p.phase="fetch "+name;const begin=now();record(name,"begin");',
 ' im.src="/asset/"+name;',
 ' const loaded=new Promise((yes,no)=>{im.onload=yes;im.onerror=()=>no(Error("onerror"))});',
 ' try{await loaded;record(name,"onload",{ms:Math.round(now()-begin),width:im.naturalWidth,height:im.naturalHeight});',
 ' p.phase="decode "+name;await im.decode();record(name,"decoded",{ms:Math.round(now()-begin)});',
 ' }catch(e){record(name,"failed",{message:String(e)});p.phase="FAILED";p.done=true;return;}',
 '};',
 'if(globalThis.__parallelImageLoads){',
 ' await Promise.all(["armory_rack.webp","armory_sword.webp"].map(load));',
 '}else for(const name of ["armory_rack.webp","armory_sword.webp"])await load(name);',
 'if(p.done)return;',
 'p.phase="DONE";p.done=true;',
 '})().catch(e=>{const p=globalThis.__probe;p.phase="ERROR";p.done=true;p.events.push({stage:"script error",message:String(e)});});',
 '</script>'
].join("\n");
const http=createServer((req,res)=>{
 const pathname=new URL(req.url,"http://127.0.0.1").pathname;
 requests.push({t:Date.now()-started,path:pathname});
 if(pathname==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);return;}
 if(pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
 const n=pathname.split("/").pop();
 if(pathname==="/asset/"+n && bytes[n]){res.writeHead(200,{"Content-Type":"image/webp","Content-Length":bytes[n].length,"Cache-Control":"no-store"});res.end(bytes[n]);return;}
 res.writeHead(404);res.end("not allowed");
});
await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
const report={status:"NOT_RUN",pins:{art:PIN},hashes,loadMode,
 bytes:Object.fromEntries(names.map(n=>[n,bytes[n].length])),
 host:{platform:platform(),cpu:cpus()[0]?.model,memTotal:totalmem(),memFreeAtStart:freemem()},
 requests,errors:[],browser:null,originalWebPOnly:true,
 originalWorldRendererLoaded:false,canvasDrawTested:false,pixelScreenshotAttempted:false,hasItemAuthority:false};
let browser;
try{
 assert.ok(process.env.CHROME_EXECUTABLE,"CHROME_EXECUTABLE required");
 browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE,
  protocolTimeout:45000,args:["--no-sandbox","--disable-gpu","--disable-gpu-sandbox","--disable-dev-shm-usage"]});
 report.browser=await browser.version();
 const page=await browser.newPage();
 page.on("pageerror",e=>report.errors.push("pageerror "+String(e)));
 page.on("requestfailed",r=>report.errors.push("requestfailed "+r.url()+" "+r.failure()?.errorText));
 page.on("response",r=>{if(r.status()>=400)report.errors.push("HTTP "+r.status()+" "+r.url());});
 page.on("console",m=>{if(m.type()==="error")report.errors.push("console "+m.text());});
 const res=await page.goto("http://127.0.0.1:"+http.address().port+"/",{waitUntil:"domcontentloaded",timeout:20000});
 report.htmlHttp=res.status();
 try{
  await page.waitForFunction(()=>globalThis.__probe?.done===true,{timeout:12000,polling:250});
  report.browserProbe=await page.evaluate(()=>globalThis.__probe);
  report.status=report.browserProbe.phase==="DONE"?"IMAGES_DECODED":"IMAGE_ERROR";
 }catch(e){report.status="BROWSER_WAIT_TIMEOUT";report.errors.push("wait "+String(e.message));
  try{report.browserProbe=await page.evaluate(()=>globalThis.__probe)}catch(e2){report.errors.push("readback "+String(e2.message));}
 }
}catch(e){report.status="BROWSER_ERROR";report.errors.push(String(e.stack||e));}
finally{
 try{await browser?.close()}catch(e){report.errors.push("close "+e.message)}
 await new Promise(r=>http.close(r));
 report.totalMs=Date.now()-started;
 await mkdir(dirname(out),{recursive:true});
 await writeFile(out,JSON.stringify(report,null,2)+"\n");
}
console.log(JSON.stringify({status:report.status,browser:report.browser,
 requests,probe:report.browserProbe,errors:report.errors,totalMs:report.totalMs},null,2));
if(report.status!=="IMAGES_DECODED")process.exitCode=1;
