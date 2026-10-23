// Chromium native W3C LMB+KeyE through ONE actual Core8A shared typed outbox,
// on real admitted QUIC into the original Rust World.
// Loopback-only nonrelease test. No fake HP, packets or server mutation.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {createServer as createHttpServer} from "node:http";
import {setTimeout as pause} from "node:timers/promises";
import {join} from "node:path";
import {readFile} from "node:fs/promises";
let output="", driverPort=0, session="";
const children=[];
function run(bin,args,env={}) {
  const p=spawn(bin,args,{stdio:["ignore","pipe","pipe"],env:{...process.env,...env}});
  children.push(p);
  return p;
}
const freePort=()=>new Promise(resolve=>{
  const s=createServer();s.listen(0,"127.0.0.1",()=>{const port=s.address().port;s.close(()=>resolve(port));});
});
async function poll(label,fn,timeout=13000) {
  const start=Date.now();let last;
  while(Date.now()-start<timeout) {
    try{last=await fn();if(last?.ok)return last;}catch(e){last={error:String(e)};}
    await pause(100);
  }
  throw Error(label+" "+JSON.stringify(last)+" Server tail="+output.slice(-900));
}
async function wd(method,path,body) {
  const response=await fetch("http://127.0.0.1:"+driverPort+path,{
    method,headers:{"content-type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const result=await response.json();
  if(!response.ok||result.value?.error) throw Error(method+" "+path+" "+JSON.stringify(result).slice(0,500));
  return result.value;
}
function initBrowser(endpoint,pin,moduleUrl,callback) {
  (async()=>{
    const hash=new Uint8Array(pin.match(/../g).map(x=>parseInt(x,16)));
    const wt=new WebTransport(endpoint,{serverCertificateHashes:[{algorithm:"sha-256",value:hash}]});
    await wt.ready;
    const bidi=await wt.createBidirectionalStream();
    const reliable=bidi.readable.getReader();
    const granted=(async()=>{
      let buf=new Uint8Array();
      for(;;) {
        const chunk=await reliable.read();if(chunk.done)throw Error("reliable closed");
        const next=new Uint8Array(buf.length+chunk.value.length);
        next.set(buf);next.set(chunk.value,buf.length);buf=next;
        while(buf.length>=2) {
          const len=buf[0]|(buf[1]<<8);
          if(buf.length<2+len)break;
          const data=buf.slice(2,len+2);buf=buf.slice(len+2);
          if(data[0]===2&&data[1]===0x13) {
            if(data[2]!==0)throw Error("capability denied");return true;
          }
        }
      }
    })();
    const s=await wt.createUnidirectionalStream();
    const sw=s.getWriter();
    await sw.write(new Uint8Array([2,0x10,77,89,65,83,79,49]));
    await sw.close();
    await granted;
    const {ProposedSharedTypedGestureOutbox} = await import(moduleUrl);
    const token=Object.freeze({});
    const q=new ProposedSharedTypedGestureOutbox({reviewVersion:2,trustedLease:token});
    const lab={acks:[],events:[],sent:[],errors:[],settlements:[],queue:null};
    const writer=wt.datagrams.writable.getWriter();
    // Actual one shared Core8A typed outbox supplies ALL bytes and ids.
    // This lab is NOT the original game browser adapter or real authentication.
    lab.offer=(name,source,clientTick=44)=>{
      let event;
      try {
        if(name==="down") event=q.begin(source,clientTick);
        else if(name==="up") event=q.release(source,clientTick);
        else throw Error("unsupported test input");
        const [packet]=q.nextSendBatch(1);
        if(!packet||packet.sequence!==event.sequence)
          throw Error("new independent edge not first-scheduled in shared queue");
        lab.sent.push({source:packet.source,action:packet.action,
          sequence:packet.sequence,gestureId:packet.gestureId,attempt:packet.attempt});
        void writer.write(packet.bytes).catch(e=>lab.errors.push(String(e)));
      } catch(e) {lab.errors.push(String(e));}
    };
    const incoming=wt.datagrams.readable.getReader();
    void (async()=>{
      for(;;) {
        const result=await incoming.read();if(result.done)break;
        const b=new Uint8Array(result.value);
        if(b.length===16&&b[0]===2&&b[1]===0x12) {
          const receipt=q.receiveAck(b,token);
          lab.acks.push({status:receipt.status,sequence:receipt.sequence,
            gestureId:receipt.gestureId,source:receipt.source,tick:receipt.serverTick});
          lab.settlements.push({transportSettled:receipt.transportSettled,
            combatCommitted:receipt.combatCommitted});
        }
      }
    })().catch(e=>lab.errors.push(String(e)));
    const canvas=document.querySelector("canvas");
    canvas.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      lab.events.push({name:"lmbDown",id:e.pointerId,ms:performance.now()});
      lab.offer("down",0);
    });
    canvas.addEventListener("pointerup",e=>{
      if(e.button!==0)return;
      lab.events.push({name:"lmbUp",id:e.pointerId,ms:performance.now()});
      lab.offer("up",0);
    });
    document.addEventListener("keydown",e=>{
      if(e.code!=="KeyE"||e.repeat)return;
      lab.events.push({name:"keyDown",ms:performance.now(),trusted:e.isTrusted});
      lab.offer("down",1);
    });
    document.addEventListener("keyup",e=>{
      if(e.code!=="KeyE")return;
      lab.events.push({name:"keyUp",ms:performance.now(),trusted:e.isTrusted});
      lab.offer("up",1);
    });
    Object.defineProperty(lab,"snapshot",{get:()=>q.snapshot});
    window.lab=lab;
    callback({ok:true,secure:isSecureContext});
  })().catch(e=>callback({ok:false,error:String(e)}));
}
try {
  const rust=run(join(process.cwd(),"server/target/debug/myaso-server"),[],{
    MYASO_BIND:"127.0.0.1:0",MYASO_MAX_PLAYERS:"4",
    MYASO_EXPERIMENTAL_GESTURE_V2:"1",MYASO_FLIGHT_ACTION_PROOF:"1",
  });
  rust.stdout.on("data",x=>output+=x.toString());
  rust.stderr.on("data",x=>output+=x.toString());
  const info=await poll("Rust QUIC started",()=>{
    const url=output.match(/listening on (https:\/\/[^\s]+)/)?.[1];
    const hex=output.match(/development certificate SHA-256:\s*([a-fA-F0-9:]+)/)?.[1];
    return {ok:!!url&&!!hex,url,pin:hex?.replaceAll(":","")};
  },17000);
  const http=createHttpServer((request,response)=>{
    const pathname=new URL(request.url,"http://localhost").pathname;
    if(pathname.startsWith("/src/network/")
        && /^\/src\/network\/[a-z0-9-]+\.mjs$/.test(pathname)) {
      const file=join(process.cwd(),pathname.slice(1));
      void readFile(file).then(source=>{
        response.writeHead(200,{"content-type":"text/javascript; charset=utf-8"});
        response.end(source);
      }).catch(()=>{response.writeHead(404);response.end("not found");});
      return;
    }
    response.writeHead(200,{"content-type":"text/html"});
    response.end("<!doctype html><meta charset=utf-8><canvas width=640 height=480 tabindex=0></canvas>");
  });
  await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
  const httpPort=http.address().port;
  children.push({kill:()=>http.close()});
  driverPort=await freePort();
  run("chromedriver",["--port="+driverPort]);
  await poll("ChromeDriver",async()=>({ok:(await fetch("http://127.0.0.1:"+driverPort+"/status").catch(()=>null))?.ok}));
  const result=await wd("POST","/session",{capabilities:{alwaysMatch:{
    browserName:"chrome","goog:chromeOptions":{args:["--headless=new","--no-sandbox","--disable-dev-shm-usage"]},
  }}});
  session=result.sessionId;assert(session);
  const base="/session/"+session;
  await wd("POST",base+"/url",{url:"http://127.0.0.1:"+httpPort+"/"});
  const boot=await wd("POST",base+"/execute/async",{
    script:"("+initBrowser.toString()+").apply(null,arguments)",args:[info.url,info.pin,
      "http://127.0.0.1:"+httpPort+"/src/network/prealpha-lmb-gesture-outbox-proposal.mjs"],
  });
  assert(boot.ok,JSON.stringify(boot));
  // One real WebDriver action schedule: physical pointerDOWN is ordered
  // before KeyE, KeyE down/up occurs DURING the 135ms light windup, then
  // pointerUP terminates the legitimate original LMB. No dispatchEvent.
  await wd("POST",base+"/actions",{actions:[{
    type:"pointer",id:"auth-shared-mouse",parameters:{pointerType:"mouse"},
    actions:[
      {type:"pointerMove",origin:"viewport",x:120,y:120,duration:0},
      {type:"pointerDown",button:0},
      {type:"pause",duration:12},
      {type:"pause",duration:12},
      {type:"pointerUp",button:0},
    ],
  },{
    type:"key",id:"auth-shared-keye",
    actions:[
      {type:"pause",duration:0},
      {type:"pause",duration:0},
      {type:"keyDown",value:"e"},
      {type:"keyUp",value:"e"},
      {type:"pause",duration:0},
    ],
  }]});
  const accepted=await poll("native shared typed outbox → genuine World light",async()=>{
    const x=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,events:window.lab?.events,sent:window.lab?.sent,errors:window.lab?.errors,settlements:window.lab?.settlements,snapshot:window.lab?.snapshot};",
      args:[],
    });
    return {...x,ok:x.acks?.length===4 && x.snapshot?.pending===0
      &&x.acks?.every(a=>a.status===1)
      &&output.includes("M201_AUTH_ACTION")&&output.includes("fighter=1 from=1 to=2")};
  });
  assert.deepEqual(accepted.events.map(x=>x.name),
    ["lmbDown","keyDown","keyUp","lmbUp"]);
  assert.equal(accepted.events[0].id,accepted.events[3].id);
  assert(accepted.events.slice(1,3).every(x=>x.trusted),"genuine W3C physical KeyE required");
  assert.deepEqual(accepted.sent.map(x=>[x.sequence,x.gestureId,x.source,x.action]),
    [[1,1,0,1],[2,2,1,1],[3,2,1,3],[4,1,0,3]]);
  assert.deepEqual(accepted.acks.map(x=>[x.sequence,x.gestureId,x.source,x.status]).sort((a,b)=>a[0]-b[0]),
    [[1,1,0,1],[2,2,1,1],[3,2,1,1],[4,1,0,1]]);
  assert(accepted.settlements.every(x=>x.transportSettled&&!x.combatCommitted));
  assert.deepEqual(accepted.snapshot.activeSources,[]);
  assert.equal(accepted.snapshot.closed,false);
  assert(!output.includes("fighter=1 from=9 to=10"),
    "BUSY KeyE must not create a phantom standalone heavy");
  assert.equal(accepted.errors.length,0);
  console.log("CORE8_NATIVE_ONE_SHARED_OUTBOX_WORLD_PASS",JSON.stringify({
    actualChromeW3C:true,actualQUIC:true,actualCore8AOutbox:true,
    events:accepted.events.map(x=>x.name),sent:accepted.sent,acks:accepted.acks,
    snapshot:accepted.snapshot,
    worldAction:output.split("\n").find(x=>x.includes("M201_AUTH_ACTION")&&x.includes("fighter=1 from=1 to=2")),
  }));
} catch (error) {
  console.error("CORE8_NATIVE_V2_FAILURE",JSON.stringify({
    error:String(error),serverLog:output.slice(-3200),
  }));
  throw error;
} finally {
  if(session)try{await wd("DELETE","/session/"+session);}catch{}
  for(const p of children)try{p.kill();}catch{}
}
