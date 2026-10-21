// Graphics 3C P0 visual-only approach to *existing* World #336 Blacksmith.
// Uses actual Chrome keyboard events and the original interactive preview.
// NOT a weapon-pickup simulation, NOT an authoritative collision/zone check.
import {createRequire} from "node:module";
import {mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
const require=createRequire(import.meta.url);
const puppeteer=require(process.env.PUPPETEER_MODULE_PATH||"puppeteer");
const urls={world336:process.env.GREYHAVEN_BASELINE_URL,
  graphics3c:process.env.GREYHAVEN_CANDIDATE_URL};
if(!process.env.CHROME_EXECUTABLE||
   !Object.values(urls).every(x=>x?.startsWith("http://127.0.0.1:")))
  throw Error("Require local Chrome and two independent localhost World checkouts");
const out=resolve(process.argv[2]||"assets/environment/greyhaven/3c-p29-armory-review");
await mkdir(out,{recursive:true});
const chrome=await puppeteer.launch({headless:true,
  executablePath:process.env.CHROME_EXECUTABLE,
  args:["--disable-gpu","--no-first-run","--no-default-browser-check"]});
const report={chrome:await chrome.version(),
  baselineWorldHead:"260a7b85a33b7a51663a70af8d410e0d33e0e236",
  graphicsHead:process.env.GREYHAVEN_CANDIDATE_SHA||"unverified",
  purpose:"Observe authored Blacksmith approach in genuine interactive World design preview",
  constraints:"No real rack swords or world-item IDs in World #336; no server, transaction, collision, pointer pickup, PvP or live multiplayer",
  screenshotWidth:1100,screenshotHeight:688,
  visits:{}
};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try {
 for(const [name,base] of Object.entries(urls)){
   const page=await chrome.newPage(); const errors=[];
   await page.setViewport({width:1280,height:900,deviceScaleFactor:1});
   page.on("pageerror",e=>errors.push(String(e)));
   const response=await page.goto(base+"/web/world-preview.html",
     {waitUntil:"networkidle0",timeout:25000});
   await page.waitForFunction(()=>document.querySelector("#place")?.textContent.includes("cached"),
     {timeout:10000});
   const authored=await page.evaluate(async()=>{
     const {MAP_IDS,getAuthoredMap}=await import("/src/world/authored-maps.mjs");
     const map=getAuthoredMap(MAP_IDS.overworld);
     const smith=map.buildings.find(x=>x.id==="smith");
     return {smith,serverRackSlots:map.rackSlots??null,
       authoredItemCount:(map.items??[]).length};
   });
   if(authored.smith?.id!=="smith"||authored.smith.x!==3710)
     throw Error(name+" Blacksmith source drift");
   const steps=[];
   // Actual preview's WASD, 230 world units/s. Approach the smith front
   // from the existing spawn while leaving the source page unmodified.
   for(const [key,duration] of [["a",2380],["w",420]]){
     const before=await page.$eval("#place",e=>e.textContent);
     await page.keyboard.down(key);await pause(duration);await page.keyboard.up(key);
     await pause(150);
     const after=await page.$eval("#place",e=>e.textContent);
     steps.push({key,durationMs:duration,before,after});
     if(before===after)throw Error(name+" native movement failed for "+key);
   }
   const finalHud=await page.$eval("#place",e=>e.textContent);
   const match=finalHud.match(/(\d+),(\d+)/);
   if(!match)throw Error(name+" HUD position missing: "+finalHud);
   const [x,y]=match.slice(1).map(Number);
   if(Math.abs(x-3800)>105||Math.abs(y-4050)>105)
     throw Error(name+" native Blacksmith approach ended at unexpected position "+x+","+y);
   await (await page.$("#arena")).screenshot({path:resolve(out,name+"_blacksmith_canvas.png")});
   await page.screenshot({path:resolve(out,name+"_blacksmith_hud.png")});
   report.visits[name]={http:response.status(),authored,steps,finalHud,
     position:{x,y},errors,visualEvidence:true,
     swordPickupTested:false,armedModeTested:false};
   await page.close();
   if(response.status()!==200||errors.length)throw Error(name+" browser errors");
 }
 report.status="completed_visual_only";
}finally{await chrome.close();}
await writeFile(resolve(out,"blacksmith_approach_chrome_report.json"),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({chrome:report.chrome,status:report.status,
  visits:Object.fromEntries(Object.entries(report.visits).map(([k,v])=>[k,
  {http:v.http,position:v.position,swordPickupTested:v.swordPickupTested,errors:v.errors}]))},null,2));
