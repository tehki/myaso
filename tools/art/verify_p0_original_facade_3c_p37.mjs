import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,join,extname} from "node:path";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const repo=resolve(fileURLToPath(new URL("../../",import.meta.url)));
const [world,threeC,facade,out]=process.argv.slice(2).map(x=>resolve(x));
const pins=[["world",world,"3178b9aad8757ceb3594ff04b9e3099dced6b729"],
 ["3C",threeC,"efdbf0b0c985fffbc4cf89285f41fcdc8ad983ac"],
 ["3B",facade,"0cbf33adf70beda55b8fcb8bef4ba2efb36084e5"]];
for(const [name,path,head] of pins)
 assert.equal(execFileSync("git",["-C",path,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),head,name);
const sources=[
 ["/__world521__/src/world/building-presentation.mjs",world,"src/world/building-presentation.mjs"],
 ["/__world521__/src/world/authored-maps.mjs",world,"src/world/authored-maps.mjs"],
 ...["authored-world-renderer.mjs","greyhaven-atmosphere.mjs","greyhaven-terrain-materials.mjs"].map(x=>["/__3cp37__/src/browser/"+x,threeC,"src/browser/"+x]),
 ["/__3cp37__/src/world/authored-maps.mjs",threeC,"src/world/authored-maps.mjs"],
 ...["red_lion_a231_day_dimensional.webp","red_lion_a231_dusk_dimensional.webp","red_lion_a231_roof_unchanged.webp"].map(x=>["/__3ba231__/assets/environment/greyhaven/a231-review/"+x,facade,"assets/environment/greyhaven/a231-review/"+x]),
 ...["armory-p0-world521-3c-p37-facade.html","armory-p0-world521-3c-p37-facade.mjs"].map(x=>["/web/"+x,repo,"web/"+x]),
 ["/src/browser/arena-viewport.mjs",repo,"src/browser/arena-viewport.mjs"]
];
const paths=Object.fromEntries(sources.map(([url,dir,path])=>[url,join(dir,path)]));
const hashes=Object.fromEntries(await Promise.all(sources.map(async([name,dir,path])=>
  [name,createHash("sha256").update(await readFile(join(dir,path))).digest("hex")])));
const pinned={
 "/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_day_dimensional.webp":"f45ca685364666e7911128b75180eb1dea5636b48ab2ae5538cc37523ec2dfd0",
 "/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_dusk_dimensional.webp":"4b7d58f1dc3469ec612c3ac861089ed6665c2118fa27eb7b2fbb1914f55776c3",
 "/__3ba231__/assets/environment/greyhaven/a231-review/red_lion_a231_roof_unchanged.webp":"f65554286ea1bb8b80562c72539d82172fd3ea8cc97e6b9d0d3203057a1aedc1",
 "/__world521__/src/world/building-presentation.mjs":"c2e2ad0350fbc5d0c8408a48a151c280b4cc85500c53f4b8e705b21e97147e33",
 "/__world521__/src/world/authored-maps.mjs":"21e7663303b14cc89f7dece7d73fda3b7e1fd4b70cc97b8753cd2c793209e144",
 "/__3cp37__/src/browser/authored-world-renderer.mjs":"14290d457a0d6bedc0c3d5b98334b9964007130190b7a8881bd3e2bd7fb2cb06"
};
for(const [path,sha] of Object.entries(pinned))assert.equal(hashes[path],sha,"Original source drift: "+path);
assert.equal(hashes["/__3cp37__/src/world/authored-maps.mjs"],hashes["/__world521__/src/world/authored-maps.mjs"]);
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,"http://localhost").pathname,p=paths[url];
 if(!p){res.writeHead(404);res.end();return;}
 try{const data=await readFile(p);
  res.writeHead(200,{"Content-Type":extname(p)===".mjs"?"text/javascript":extname(p)===".webp"?"image/webp":"text/html"});res.end(data);
 }catch{res.writeHead(500);res.end();}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
const url="http://127.0.0.1:"+server.address().port+"/web/armory-p0-world521-3c-p37-facade.html";
const puppeteer=(await import(process.env.PUPPETEER_MODULE_URL)).default;
const results=[];
try{
 for(const engine of ["chrome","firefox"]){
  let browser;
  try{
   const options={headless:true,executablePath:engine==="chrome"?process.env.CHROME_EXECUTABLE:process.env.FIREFOX_EXECUTABLE};
   if(engine==="chrome")options.args=["--no-sandbox"];
   else{options.browser="firefox";options.protocol="webDriverBiDi";}
   browser=await puppeteer.launch(options);
   const page=await browser.newPage(),errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status());});
   await page.setViewport({width:1430,height:835});
   await page.goto(url,{waitUntil:"networkidle0"});
   await page.waitForFunction(()=>window.__p0OriginalFacadeProof?.ready,{timeout:12000});
   const data=await page.evaluate(()=>window.__p0OriginalFacadeProof);
   assert.equal(data.smithDiff,0);
   assert.ok(data.redLionReplacementDifference>10000);
   assert.ok(data.replacedDayPixelDiff>10000);
   assert.ok(data.replacedDuskPixelDiff>10000);
   assert.ok(data.dayDuskDiff>0);
   assert.equal(data.dayDuskSourceDistinct,true);
   assert.equal(data.missingValidatorRejected,true);
   assert.equal(data.smithNotReplaceable,true);
   assert.deepEqual(errors,[]);
   const file="red_lion_3c_p37_3b_"+engine+".png";
   await page.screenshot({path:join(out,file),fullPage:true});
   results.push({engine,version:await browser.version(),data,file,errors});
  }finally{await browser?.close();}
 }
 await writeFile(join(out,"red_lion_3c_p37_native.json"),JSON.stringify({pins,hashes,results,gameExecuted:false,serverGameplay:false},null,2)+"\n");
 console.log("P37_RESULT="+JSON.stringify(results.map(r=>({engine:r.engine,changed:r.data.redLionReplacementDifference,facadeDay:r.data.replacedDayPixelDiff,facadeDusk:r.data.replacedDuskPixelDiff,smith:r.data.smithDiff}))));
}finally{await new Promise(ok=>server.close(ok));}
