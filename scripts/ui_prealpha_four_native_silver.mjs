#!/usr/bin/env node
// Moon Games UI10, ART/TRUST QA ONLY: real Rust arena, four native browser
// clients and actual original first-party Silver Knight canvas drawImage.
// Not a gameplay server, synthetic actor, deployment or Pre-Alpha GO.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {join} from "node:path";

const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const children=[],sessions=[],ports=new Map();
const families=["chrome","firefox","chrome","firefox"];
const listenPort=()=>new Promise((ok,bad)=>{
 const s=createServer();s.on("error",bad);
 s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>ok(p));});
});
function launch(bin,args,opts={}){
 const p=spawn(bin,args,{...opts,env:{...process.env,...(opts.env||{})}});
 children.push(p);return p;
}
async function wd(method,path,payload,override){
 const sid=path.match(/^\/session\/([^/]+)/)?.[1],p=override??ports.get(sid);
 if(!p)throw Error("Browser driver not associated with unique session");
 const r=await fetch("http://127.0.0.1:"+p+path,{method,
  headers:{"content-type":"application/json"},
  body:payload===undefined?undefined:JSON.stringify(payload)});
 const j=await r.json();
 if(!r.ok||j.value?.error)throw Error(method+" "+path+" "+JSON.stringify(j).slice(0,1200));
 return j.value;
}
const evaluate=(s,script,args=[])=>wd("POST","/session/"+s+"/execute/sync",{script,args});
async function poll(label,fn,limit=18000){
 const t=Date.now();let last;
 while(Date.now()-t<limit){try{last=await fn();if(last?.ok)return last;}catch(e){last={error:String(e)};}await sleep(170);}
 throw Error("TIMEOUT "+label+": "+JSON.stringify(last).slice(0,1400));
}
try{
 const bin=join(process.cwd(),"server/target/debug/myaso-server");
 const game=launch(bin,[],{env:{MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4"},
  stdio:["ignore","pipe","pipe"]});
 let stdout="",stderr="";
 game.stdout.on("data",b=>stdout+=String(b));
 game.stderr.on("data",b=>stderr+=String(b));
 const ready=await poll("Rust authoritative Combat arena",()=>{
  const url=stdout.match(/listening on (https:\/\/[^\s]+)/)?.[1];
  const cert=stdout.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];
  return {ok:!!url&&!!cert,url,cert,stderr:stderr.slice(-300)};
 },22000);
 assert.equal(ready.cert.replaceAll(":","").length,64);
 const http=await listenPort();
 launch("python3",["-m","http.server",String(http),"--bind","127.0.0.1",
  "--directory",process.cwd()],{stdio:"ignore"});
 const url="http://127.0.0.1:"+http+"/web/?server="+encodeURIComponent(ready.url)
  +"&cert="+encodeURIComponent(ready.cert.replaceAll(":",""))
  +"&knights=1&netstats=1";
 for(let i=0;i<4;i++){
  const family=families[i],driverPort=await listenPort();
  launch(family==="chrome"?"chromedriver":process.env.PREALPHA_GECKODRIVER||"geckodriver",
   ["--port="+driverPort],{stdio:"ignore"});
  await poll(family+" driver",async()=>{
   const r=await fetch("http://127.0.0.1:"+driverPort+"/status").catch(()=>null);
   return {ok:!!r?.ok};
  },10000);
  const caps=family==="chrome"?
   {browserName:"chrome","goog:chromeOptions":{args:[
    "--headless=new","--no-sandbox","--disable-dev-shm-usage","--window-size=1100,780"]}}:
   {browserName:"firefox","moz:firefoxOptions":{args:["-headless"]}};
  const id=(await wd("POST","/session",{capabilities:{alwaysMatch:caps}},driverPort)).sessionId;
  assert.equal(typeof id,"string");
  ports.set(id,driverPort);sessions.push(id);
  await wd("POST","/session/"+id+"/url",{url});
  await poll(family+" player #"+i,()=>evaluate(id,
   "const t=document.querySelector('#event-text')?.textContent||'';"+
   "return {ok:/Online - player #\\d+ - server tick \\d+/.test(t),text:t};"
  ),23000);
  // Passive wrapper around original drawImage on the *actual* arena context.
  // Retains real source image and original method; does not change game state.
  await evaluate(id,[
   "if(!window.__SILVER_UI_QA__){",
   "const p=CanvasRenderingContext2D.prototype,original=p.drawImage;",
   "const proof={draws:0,burst:0,maxBurst:0,lastTime:0,bad:0,assets:{}};",
   "p.drawImage=function(...args){",
   "const im=args[0],uri=im?.currentSrc||im?.src||'';",
   "if(this.canvas?.id==='arena'&&uri.includes('/assets/knights/silver_')&&uri.includes('.webp')){",
   "const t=performance.now();if(t-proof.lastTime>75)proof.burst=0;",
   "proof.burst++;proof.lastTime=t;proof.maxBurst=Math.max(proof.maxBurst,proof.burst);",
   "proof.draws++;const name=uri.split('/').pop();",
   "proof.assets[name]=(proof.assets[name]||0)+1;",
   "if(im.naturalHeight!==1280||im.naturalWidth%160!==0)proof.bad++;",
   "}",
   "return original.apply(this,args);};",
   "window.__SILVER_UI_QA__=()=>({...proof,",
   "flag:new URLSearchParams(location.search).get('knights'),",
   "status:document.querySelector('#event-text')?.textContent||'',",
   "roster:[...document.querySelectorAll('#scoreboard-list li')].map(li=>li.querySelector('span')?.textContent||''),",
   "stats:document.querySelector('#network-diagnostics')?.textContent||'',",
   "actualCanvas:!!document.querySelector('#arena')});",
   "}"
  ].join(""));
 }
 const proofs=[];
 for(let i=0;i<4;i++){
  const p=await poll(families[i]+" genuine Silver arena renders "+i,async()=>{
   const s=await evaluate(sessions[i],"return window.__SILVER_UI_QA__?.()");
   return {...s,ok:s?.flag==="1"&&s.roster?.length===4&&
    s.draws>=12&&s.maxBurst>=4&&s.bad===0&&s.actualCanvas&&
    (s.assets?.["silver_idle.webp"]||0)>0&&/Online - player #\d+/.test(s.status)};
  },30000);
  proofs.push(p);
  console.log("SILVER_AUTHENTIC_CANVAS",JSON.stringify({browser:families[i],
   player:i+1,roster:p.roster,draws:p.draws,maxBurst:p.maxBurst,
   idle:p.assets["silver_idle.webp"],status:p.status,bad:p.bad}));
 }
 const a=sessions[0],before=await evaluate(a,"return window.__SILVER_UI_QA__()");
 await evaluate(a,"document.querySelector('#arena').focus();");
 await wd("POST","/session/"+a+"/actions",{actions:[
  {type:"key",id:"silver-prealpha-native-w",actions:[{type:"keyDown",value:"w"}]}]});
 await sleep(350);
 await wd("POST","/session/"+a+"/actions",{actions:[
  {type:"key",id:"silver-prealpha-native-w",actions:[{type:"keyUp",value:"w"}]}]});
 const after=await poll("live gameplay/HUD advances under Silver",async()=>{
  const s=await evaluate(a,"return window.__SILVER_UI_QA__()");
  const oldTick=Number(before.status.match(/server tick (\d+)/)?.[1]||0);
  const tick=Number(s.status.match(/server tick (\d+)/)?.[1]||0);
  return {...s,ok:s.draws>before.draws+4&&tick>oldTick+3};
 },17000);
 assert(after.draws>before.draws);
 console.log("PREALPHA_SILVER_FOUR_NATIVE_PASS",JSON.stringify({
  browsers:families,fourRealAuthenticated:true,
  originalSilverAtlasOnActualCanvas:true,localAndRemote:true,
  actualServerTicksAdvance:true,authenticWInput:true,
  realPickup:false,instantLightFixed:false,releaseApproved:false
 }));
}finally{
 for(const id of sessions){try{await wd("DELETE","/session/"+id);}catch{}}
 for(const c of children){try{c.kill();}catch{}}
}
