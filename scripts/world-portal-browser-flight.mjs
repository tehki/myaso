// D19: real headless Chrome WebDriver E-key round trip of the OFFLINE preview.
// No live multiplayer, Rust server, inventory/economy, persistence or CI bypass.
// Uses the same chromedriver binaries as the inherited Combat browser gates.
import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {readFile,stat} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {setTimeout as sleep} from "node:timers/promises";

const root=process.cwd();
const driverPort=9528;
const driverURL="http://127.0.0.1:"+driverPort;
const driverExe=process.env.CHROMEWEBDRIVER?
  path.join(process.env.CHROMEWEBDRIVER,process.platform==="win32"?"chromedriver.exe":"chromedriver"):
  "chromedriver";
let server=null,driver=null,sessionId=null;
const failure=(reason,data)=>{throw new Error(reason+": "+JSON.stringify(data));};

async function webdriver(method,url,body) {
  const response=await fetch(driverURL+url,{
    method,headers:body===undefined?undefined:{"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(12000),
  });
  const raw=await response.text();
  let data;try{data=raw?JSON.parse(raw):{};}catch{data={raw};}
  if(!response.ok||data.value?.error)
    failure("WebDriver "+method+" "+url+" "+response.status,data);
  return data.value??data;
}
async function execute(script) {
  return webdriver("POST","/session/"+sessionId+"/execute/sync",{script,args:[]});
}
async function snapshot(){
  return execute("return {"+
    "door:document.querySelector('#door')?.textContent,"+
    "place:document.querySelector('#place')?.textContent,"+
    "lore:document.querySelector('#lore-progress')?.textContent,"+
    "fields:document.querySelector('#survey-progress')?.textContent,"+
    "stage:document.querySelector('#expedition-progress')?.textContent,"+
    "mapHidden:document.querySelector('#wayfinding-map')?.hidden,"+
    "mapKeyHidden:document.querySelector('#chronicle-atlas-key')?.hidden,"+
    "notice:document.querySelector('#lore-notice')?.textContent"+
  "};");
}
async function until(label,predicate,timeoutMs=3500){
  const end=Date.now()+timeoutMs;let last;
  while(Date.now()<end){
    last=await snapshot();
    if(predicate(last))return last;
    await sleep(80);
  }
  failure("D19 timed out waiting for "+label,last);
}
async function press(letter,ms=90){
  await webdriver("POST","/session/"+sessionId+"/actions",{
    actions:[{type:"key",id:"keyboard",actions:[
      {type:"keyDown",value:letter},{type:"pause",duration:ms},
      {type:"keyUp",value:letter},
    ]}],
  });
}
async function staticServer(){
  const s=createServer(async (request,response)=>{
    try{
      const url=new URL(request.url??"/","http://127.0.0.1");
      const file=path.resolve(root,"."+decodeURIComponent(url.pathname));
      if(!file.startsWith(root+path.sep)){response.writeHead(403).end();return;}
      const f=await stat(file);
      if(!f.isFile()){response.writeHead(404).end();return;}
      response.setHeader("Content-Type",file.endsWith(".html")?"text/html":"text/javascript");
      response.setHeader("Cache-Control","no-store");
      response.end(await readFile(file));
    }catch(error){response.writeHead(error?.code==="ENOENT"?404:500).end();}
  });
  await new Promise((resolve,reject)=>{s.once("error",reject);s.listen(0,"127.0.0.1",resolve);});
  return s;
}
try{
  server=await staticServer();
  driver=spawn(driverExe,["--port="+driverPort],{cwd:root,stdio:"ignore",windowsHide:true});
  const deadline=Date.now()+15000;
  let ready=false;
  while(Date.now()<deadline){
    if(driver.exitCode!==null)throw new Error("D19 chromedriver exited early "+driver.exitCode);
    try{const response=await fetch(driverURL+"/status");if(response.ok){ready=true;break;}}
    catch{}
    await sleep(100);
  }
  if(!ready)throw new Error("D19 chromedriver did not start; no silent browser skip");
  const session=await webdriver("POST","/session",{
    capabilities:{alwaysMatch:{
      browserName:"chrome",
      "goog:chromeOptions":{args:[
        "--headless=new","--no-sandbox","--disable-dev-shm-usage",
        "--disable-extensions","--window-size=1280,720",
        "--disable-background-timer-throttling","--disable-backgrounding-occluded-windows",
      ]},
    }},
  });
  sessionId=session.sessionId;
  if(!sessionId)failure("No Chrome session ID",session);
  await webdriver("POST","/session/"+sessionId+"/url",{
    url:"http://127.0.0.1:"+server.address().port+"/web/world-preview.html",
  });
  const start=await until("Greyhaven portal preview load",s=>s.door!==undefined&&s.lore?.includes("0 / 6"));
  if(start.door.includes("Enter The Red Lion Inn"))
    failure("D19 initial spawn incorrectly inside trigger",start);
  await press("e");
  const distant=await snapshot();
  if(!distant.place?.includes("Moonvale · 4365,4150")||distant.door?.includes("Return to Greyhaven"))
    failure("D19 E triggered transfer while distant",distant);

  // Read a session-only story then choose an unrelated expedition. Both must
  // survive the actual two-way E transition without duplication or awards.
  await press("f");
  const reading=await until("read Red Lion charter",s=>s.lore?.includes("1 / 6"));
  if(!reading.fields?.includes("0 / 8"))
    failure("D19 reading charter granted field notes",reading);
  await execute("document.querySelector('#expedition-choices button[data-route=\"fallen-watch\"]').click();");
  const route=await until("Fallen Watch initial milestone",s=>s.stage?.includes("1 / 3"));
  await press("m");
  const opened=await until("M sketch opened outdoors",s=>s.mapHidden===false);
  await press("w",210);
  const atDoor=await until("enter portal prompt",s=>s.door?.includes("Enter The Red Lion Inn"));
  await press("e");
  const interior=await until("real E transfer into Red Lion",s=>s.place?.includes("Red Lion")&&s.mapHidden===true);
  if(!interior.lore?.includes("1 / 6")||!interior.fields?.includes("0 / 8")||
     !interior.stage?.includes("1 / 3")||!interior.mapKeyHidden)
    failure("D19 entering tavern lost or awarded state",interior);
  // The authored inside landing is at 390,480; exit trigger at 390,550.
  // Move physically toward the door, not by executing page variables.
  await sleep(650);
  await press("s",220);
  const exitPrompt=await until("exit portal prompt",s=>s.door?.includes("Return to Greyhaven"));
  await press("e");
  const outside=await until("real E transfer back outdoors",s=>s.place?.includes("Moonvale")&&s.mapHidden===false);
  if(!outside.lore?.includes("1 / 6")||!outside.fields?.includes("0 / 8")||
     !outside.stage?.includes("1 / 3"))
    failure("D19 return transition changed journal, field or expedition",outside);
  await press("m");
  const closed=await until("M map closed after return",s=>s.mapHidden===true);
  if(!closed.mapKeyHidden)failure("D19 atlas legend left visible after map close",closed);
  console.log("D19_REAL_CHROME_PORTAL_ROUND_TRIP_PASS "+JSON.stringify({
    distant:!distant.door,reading:reading.lore,
    route:route.stage,atDoor:atDoor.door,
    interior:interior.place,interiorMapHidden:interior.mapHidden,
    exitPrompt:exitPrompt.door,outside:outside.place,
    journal:outside.lore,fields:outside.fields,stage:outside.stage,
    closedMap:closed.mapHidden,
  }));
}finally{
  if(sessionId){try{await webdriver("DELETE","/session/"+sessionId);}catch{}}
  if(driver&&driver.exitCode===null){driver.kill("SIGTERM");}
  if(server)await new Promise(resolve=>server.close(resolve));
}
