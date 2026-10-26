// Genuine Chrome W3C KeyE negative + physical LMB positive over one real QUIC lease.
// Test-only old source1 bytes prove hostile archived KeyE cannot touch original World.
// Loopback-only NONRELEASE; original World/HP/packet protocol are unchanged.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {createServer as createHttpServer} from "node:http";
import {setTimeout as pause} from "node:timers/promises";
import {join} from "node:path";
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
function initBrowser(endpoint,pin,callback) {
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
    const lab={acks:[],events:[],keys:[],sent:[],errors:[],seq:1};
    const writer=wt.datagrams.writable.getWriter();
    lab.send=async (action,source=0)=>{
      const b=new Uint8Array(16),view=new DataView(b.buffer);
      b[0]=2;b[1]=0x11;b[2]=action;b[3]=source;
      // An archived KeyE sender must NEVER spend the legitimate LMB seq1.
      // Deliberately try the same forged far-future source1 sequence twice.
      const seq=source===1?77:lab.seq++;
      view.setUint32(4,seq,true);view.setUint32(8,1,true);
      view.setUint32(12,44,true);
      try {await writer.write(b);lab.sent.push({seq,action,source});} catch(e){lab.errors.push(String(e));}
    };
    const incoming=wt.datagrams.readable.getReader();
    void (async()=>{
      for(;;) {
        const p=await incoming.read();if(p.done)break;
        const b=new Uint8Array(p.value);
        if(b.length===16&&b[0]===2&&b[1]===0x12) {
          const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
          lab.acks.push({status:b[2],sequence:v.getUint32(4,true),tick:v.getUint32(12,true)});
        }
      }
    })().catch(e=>lab.errors.push(String(e)));
    const canvas=document.querySelector("canvas");
    canvas.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      lab.events.push({name:"down",id:e.pointerId,ms:performance.now()});
      void lab.send(1);
    });
    canvas.addEventListener("pointerup",e=>{
      if(e.button!==0)return;
      lab.events.push({name:"up",id:e.pointerId,ms:performance.now()});
      void lab.send(3);
    });
    // Negative test ONLY: neither real playable page attaches this producer.
    // Deliberately inject an obsolete raw source1 packet on physical KeyE.
    document.addEventListener("keydown",e=>{
      if(e.code!=="KeyE"||e.repeat)return;
      lab.keys.push({name:"keydown",code:e.code,ms:performance.now()});
      void lab.send(1,1);
    });
    document.addEventListener("keyup",e=>{
      if(e.code!=="KeyE")return;
      lab.keys.push({name:"keyup",code:e.code,ms:performance.now()});
      void lab.send(3,1);
    });
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
    script:"("+initBrowser.toString()+").apply(null,arguments)",args:[info.url,info.pin],
  });
  assert(boot.ok,JSON.stringify(boot));
  // Synchronize the READ-ONLY original Rust 60Hz World flight observer.
  // Without an already-observed Idle actor, a valid very fast native PRESS
  // can win the actor-admission/first-tick race: server ACKs ACCEPTED and
  // real World enters windup, but M201's previous-action journal had no
  // earlier Idle sample and cannot report Idle→Windup. Do not weaken the
  // World transition assertion, invent actor state or sleep by wall clock.
  const originalIdle=await poll("server-owned initial Idle baseline before W3C input",()=>{
    const witness=output.split("\n").find(line=>
      /M201_FLIGHT_ACTOR_BASELINE tick=\d+ fighter=1 action=0/.test(line));
    return {ok:!!witness,witness};
  });
  assert(originalIdle.witness,"actual server 60Hz Idle baseline is required");
  // Actual trusted W3C KeyE DOWN/UP. This isolated hostile-fixture hook
  // emits retired source1 BYTES on purpose; real browser Combat does not.
  await wd("POST",base+"/actions",{actions:[{
    type:"key",id:"native-retired-keye",actions:[{type:"keyDown",value:"e"},{type:"keyUp",value:"e"}],
  }]});
  const denied=await poll("both archived KeyE packets rejected by original authenticated World",async()=>{
    const x=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,keys:window.lab?.keys,sent:window.lab?.sent,errors:window.lab?.errors};",args:[],
    });
    const rejected=x.acks?.filter(a=>a.sequence===77&&a.status===4)||[];
    const deniedWorld=output.split("\n").filter(line=>
      /M201_AUTH_GESTURE_ACTION tick=\d+ fighter=1 source=1/.test(line)&&
      /status=4 from=0 to=0/.test(line));
    return {...x,deniedWorld,ok:rejected.length===2&&deniedWorld.length>=2};
  });
  assert.deepEqual(denied.keys.map(x=>x.name),["keydown","keyup"]);
  assert.deepEqual(denied.keys.map(x=>x.code),["KeyE","KeyE"]);
  assert.deepEqual(denied.sent.map(x=>[x.seq,x.action,x.source]),[[77,1,1],[77,3,1]]);
  assert.deepEqual(denied.errors,[]);
  assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=(?:1|9|10)/.test(output),
    "KeyE alone must never start light/heavy World combat");
  assert(!/M201_AUTH_HIT tick=\d+ attacker=1/.test(output),
    "retired E cannot commit original World damage");

  // SAME admitted server lease, REAL physical W3C source0 LMB.
  // The two rejected source1 packets must not consume its sequence1/2.
  await wd("POST",base+"/actions",{actions:[{
    type:"pointer",id:"native-real-lmb",parameters:{pointerType:"mouse"},
    actions:[
      {type:"pointerMove",origin:"viewport",x:120,y:120,duration:0},
      {type:"pointerDown",button:0},
      {type:"pause",duration:6},
      {type:"pointerUp",button:0},
    ],
  }]});
  const accepted=await poll("physical LMB admitted after rejected old KeyE",async()=>{
    const x=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,keys:window.lab?.keys,events:window.lab?.events,sent:window.lab?.sent,errors:window.lab?.errors};",
      args:[],
    });
    const realWorld=output.split("\n").find(line=>
      /M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=1/.test(line));
    return {...x,realWorld,ok:x.acks?.some(a=>a.sequence===1&&a.status===1)
      &&x.acks?.some(a=>a.sequence===2&&a.status===1)&&!!realWorld};
  });
  assert.deepEqual(accepted.events.map(x=>x.name),["down","up"]);
  assert.equal(accepted.events[0].id,accepted.events[1].id);
  assert.deepEqual(accepted.sent.map(x=>[x.seq,x.action,x.source]),
    [[77,1,1],[77,3,1],[1,1,0],[2,3,0]]);
  assert.deepEqual(accepted.errors,[]);
  assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=9/.test(output),
    "neither rejected KeyE nor short physical LMB can create HeavyWindup");
  console.log("CORE8_NATIVE_V2_KEYE_RETIRED_LMB_WORLD_PASS",JSON.stringify({
    realChrome:true,realWebTransport:true,liveAccountAuthentication:false,
    rejectedLegacyKeyEAcks:denied.acks.filter(a=>a.sequence===77),
    physicalLmbMs:accepted.events[1].ms-accepted.events[0].ms,
    acceptedLmbAcks:accepted.acks.filter(a=>a.sequence===1||a.sequence===2),
    originalRustWorldLight:accepted.realWorld,
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
