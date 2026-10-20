import {spawn} from "node:child_process";
import {createServer} from "node:http";
import {createReadStream} from "node:fs";
import {access,writeFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {setTimeout as pause} from "node:timers/promises";

const root=process.cwd();
const events=[],sessions=new Set(),started=Date.now();
let game,driver,http,cleaned=false;
const timeout=setTimeout(()=>{console.error("R2_GHOST_TEST_HARD_TIMEOUT");process.exit(9)},95000);
function mark(step,detail){events.push({step,ms:Date.now()-started,detail});console.log("R2_GHOST_"+step+"="+JSON.stringify(detail))}
async function wd(path,method="GET",body){
 const r=await fetch("http://127.0.0.1:9537"+path,{method,headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(17000)});
 const j=await r.json();if(!r.ok||j.value?.error)throw Error("W3C "+path+": "+JSON.stringify(j.value).slice(0,450));return j.value;
}
async function create(url){
 const c=await wd("/session","POST",{capabilities:{alwaysMatch:{browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1280,720"]}}}});
 const id=c.sessionId;sessions.add(id);await wd("/session/"+id+"/url","POST",{url});return id;
}
const readJs="return {id:window.__MYASO_ACCEPTANCE_STATE__?.playerNetId||null,tick:window.__MYASO_ACCEPTANCE_STATE__?.serverTick||0,actions:window.__MYASO_ACCEPTANCE_STATE__?.ownActionTransitions?.slice(-12)||[],score:[...document.querySelectorAll('#scoreboard-list li')].map(x=>x.textContent),status:document.querySelector('#event-text')?.textContent||''};";
const state=id=>wd("/session/"+id+"/execute/sync","POST",{script:readJs,args:[]});
async function until(id,predicate,limit=10000){
 const end=Date.now()+limit;let s={};
 while(Date.now()<end){s=await state(id);if(predicate(s))return s;await pause(300)}
 throw Error("State timeout "+JSON.stringify(s));
}
const has=(s,n)=>s.score.some(x=>x.startsWith("#"+n));
async function closeSession(id){await wd("/session/"+id,"DELETE");sessions.delete(id)}
async function stop(p){if(!p||p.exitCode!==null)return;p.kill("SIGTERM");await Promise.race([pause(1400),new Promise(ok=>p.once("exit",ok))]);if(p.exitCode===null)p.kill("SIGKILL")}
async function clean(){
 if(cleaned)return;cleaned=true;clearTimeout(timeout);
 for(const id of [...sessions])try{await closeSession(id)}catch(e){mark("CLOSE_WARNING",e.message)}
 await stop(driver);await stop(game);
 if(http)await new Promise(ok=>http.close(ok));
 await writeFile("r2-session-cleanup-w3c-evidence.json",JSON.stringify({events},null,2));
}
try{
 const binary=resolve(root,"server/target/debug/myaso-server");await access(binary);
 game=spawn(binary,[],{cwd:root,env:{...process.env,MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"2"},stdio:["ignore","pipe","pipe"]});
 let out="",err="";game.stdout.on("data",x=>out+=x.toString());game.stderr.on("data",x=>err+=x.toString());
 let port,cert;
 for(let i=0;i<130;i++){
  port=out.match(/server listening on https:\/\/127\.0\.0\.1:(\d+)\/game/)?.[1];
  cert=out.match(/development certificate SHA-256:\s*([0-9a-f]{64})/i)?.[1];
  if(port&&cert)break;if(game.exitCode!==null)throw Error("Server exited: "+err);await pause(100);
 }
 if(!port||!cert)throw Error("Server startup/cert timeout: "+out+" "+err);
 mark("SERVER_READY",{port:Number(port),cap:2,cert});
 http=createServer(async(req,res)=>{
  const pathname=new URL(req.url,"http://127.0.0.1").pathname;
  const file=resolve(root,"."+(pathname.endsWith("/")?pathname+"index.html":pathname));
  if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
  res.setHeader("Content-Type",({".html":"text/html",".mjs":"text/javascript",".js":"text/javascript",".css":"text/css",".png":"image/png",".json":"application/json"})[extname(file)]||"application/octet-stream");
  res.setHeader("Cache-Control","no-store");
  try{await access(file);createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end("missing")}
 });
 await new Promise((ok,no)=>{http.once("error",no);http.listen(0,"127.0.0.1",ok)});
 driver=spawn("chromedriver",["--port=9537","--allowed-ips=127.0.0.1"],{stdio:"ignore"});
 for(let i=0;i<45;i++){try{const r=await fetch("http://127.0.0.1:9537/status",{signal:AbortSignal.timeout(450)});if(r.ok)break}catch{}await pause(120)}
 const url="http://127.0.0.1:"+http.address().port+"/web/?"+new URLSearchParams({server:"https://127.0.0.1:"+port+"/game",cert,scenario:"uistaminaauth"});
 const one=await create(url),a=await until(one,x=>x.id&&x.tick>0);
 const two=await create(url),b=await until(two,x=>x.id&&x.tick>0&&x.id!==a.id);
 const initial=await until(one,x=>has(x,a.id)&&has(x,b.id));
 mark("TWO_PLAYERS",{first:a.id,second:b.id,score:initial.score});
 await closeSession(two);
 const closed=Date.now();mark("ABRUPT_CHROME_CLOSE",{departedId:b.id});
 const cleared=await until(one,x=>has(x,a.id)&&!has(x,b.id),39000);
 const elapsed=Date.now()-closed;
 if(elapsed>38000)throw Error("Ghost did not expire promptly: "+elapsed);
 mark("GHOST_REMOVED",{elapsedMs:elapsed,score:cleared.score});
 const three=await create(url),c=await until(three,x=>x.id&&x.id!==a.id&&x.id!==b.id&&x.tick>0);
 const final=await until(one,x=>x.score.length===2&&has(x,a.id)&&has(x,c.id)&&!has(x,b.id));
 mark("CAP_TWO_SLOT_RECLAIMED",{newPlayerId:c.id,score:final.score});
 const el=await wd("/session/"+three+"/element","POST",{using:"css selector",value:"#arena"});
 const id=el["element-6066-11e4-a52e-4f735466cecf"];
 await wd("/session/"+three+"/element/"+id+"/click","POST",{});
 await wd("/session/"+three+"/actions","POST",{actions:[{type:"key",id:"keyboard",actions:[{type:"keyDown",value:"d"},{type:"pause",duration:450},{type:"keyUp",value:"d"}]}]});
 const post=await until(three,x=>x.tick>c.tick+12&&x.actions.length>1);
 mark("NEW_PLAYER_W3C",{id:c.id,tick:post.tick,actions:post.actions.slice(-5)});
 mark("RESULT","PASS_ABRUPT_CLOSE_RECLAIMS_ADMISSION_CAP2_AND_NATIVE_W3C_REJOIN");
}catch(error){mark("RESULT","FAIL: "+error.message);process.exitCode=1}
finally{await clean()}
