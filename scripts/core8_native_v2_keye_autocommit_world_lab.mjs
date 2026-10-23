// Genuine Chromium W3C physical KeyE DOWN and UP on Core8A auto-heavy candidate #868.
// Pinned actual WebTransport QUIC -> original live Rust World; loopback + default-OFF.
// A real 320ms HeavyActive MUST happen while actual KeyE remains PHYSICALLY held.
// Release is an ACKed no-combat terminal, NOT the heavy trigger. ACK != HIT.
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
    const lab={acks:[],events:[],sent:[],errors:[],seq:1};
    const writer=wt.datagrams.writable.getWriter();
    lab.send=async action=>{
      const b=new Uint8Array(16),view=new DataView(b.buffer);
      b[0]=2;b[1]=0x11;b[2]=action;b[3]=1; // canonical source1 KeyE, not LMB0
      const seq=lab.seq++;
      view.setUint32(4,seq,true);view.setUint32(8,1,true);
      view.setUint32(12,44,true);
      try {await writer.write(b);lab.sent.push({seq,action});} catch(e){lab.errors.push(String(e));}
    };
    const incoming=wt.datagrams.readable.getReader();
    void (async()=>{
      for(;;) {
        const p=await incoming.read();if(p.done)break;
        const b=new Uint8Array(p.value);
        if(b.length===16&&b[0]===2&&b[1]===0x12) {
          const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
          lab.acks.push({status:b[2],reserved:b[3],sequence:v.getUint32(4,true),gesture:v.getUint32(8,true),tick:v.getUint32(12,true)});
        }
      }
    })().catch(e=>lab.errors.push(String(e)));
    document.addEventListener("keydown",e=>{
      if(e.code!=="KeyE"||e.repeat)return;
      lab.events.push({name:"keydown",code:e.code,trust:e.isTrusted,ms:performance.now()});
      void lab.send(1); // Original typed KeyE PRESS enters server World.
    });
    document.addEventListener("keyup",e=>{
      if(e.code!=="KeyE")return;
      lab.events.push({name:"keyup",code:e.code,trust:e.isTrusted,ms:performance.now()});
      void lab.send(3); // Release may ACK, but cannot cause the heavy HIT.
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
  // W3C native real Chromium keyDown, no JS dispatch or fabricated user event.
  // Key remains physically held until AFTER observing actual Rust HeavyActive.
  await wd("POST",base+"/actions",{actions:[{
    type:"key",id:"physical-KeyE",
    actions:[{type:"keyDown",value:"e"}],
  }]});
  const early=process.env.MYASO_KEYE_EARLY_RELEASE==="1";
  const held=await poll(early?"physical KeyE early press ACK":"real KeyE auto-heavy before physical keyUp",async()=>{
    const browser=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,events:window.lab?.events,sent:window.lab?.sent,errors:window.lab?.errors};",
      args:[],
    });
    const began=output.match(/M201_AUTH_ACTION tick=(\d+) fighter=1 from=0 to=9/);
    const landed=output.match(/M201_AUTH_ACTION tick=(\d+) fighter=1 from=9 to=10/);
    return {...browser,began:began?.[0],landed:landed?.[0],
      ok:browser.events?.length===1 && browser.events[0].name==="keydown"
        &&browser.events[0].trust===true
        &&browser.acks?.some(x=>x.status===1&&x.sequence===1&&x.gesture===1)
        &&Boolean(began)&&(early||Boolean(landed))
    };
  },13000);
  assert.deepEqual(held.events.map(x=>x.name),["keydown"]);
  assert.equal(held.sent.length,1,"no synthetic automatic KeyE RELEASE before 320ms");
  assert.equal(held.errors.length,0);
  assert.equal(held.acks[0].reserved,0);
  assert(held.acks[0].tick>0);
  const autoBegin=Number(held.began.match(/tick=(\d+)/)[1]);
  let autoHit=early?0:Number(held.landed.match(/tick=(\d+)/)[1]);
  if(!early)assert(autoHit>=autoBegin+19,"server 320ms original auto-heavy not immediate");
  else assert(!output.includes("fighter=1 from=9 to=10"),
    "physical early-release test must issue KeyE UP before heavy auto-active");
  // Held mode releases AFTER original World heavy; short-tap mode BEFORE it.
  await wd("POST",base+"/actions",{actions:[{
    type:"key",id:"physical-KeyE",
    actions:[{type:"keyUp",value:"e"}],
  }]});
  const released=await poll("real KeyE release has independent matching ACK",async()=>{
    const browser=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,events:window.lab?.events,sent:window.lab?.sent,errors:window.lab?.errors};",
      args:[],
    });
    return {...browser,ok:browser.events?.length===2
      &&browser.acks?.some(x=>x.status===1&&x.sequence===2&&x.gesture===1&&x.tick>0)};
  });
  assert.deepEqual(released.events.map(x=>x.name),["keydown","keyup"]);
  assert(released.events.every(x=>x.code==="KeyE"&&x.trust===true));
  assert(released.events[1].ms>released.events[0].ms);
  assert.deepEqual(released.sent.map(x=>[x.seq,x.action]),[[1,1],[2,3]]);
  assert.deepEqual(released.acks.sort((x,y)=>x.sequence-y.sequence)
    .map(x=>[x.status,x.reserved,x.sequence,x.gesture]),[[1,0,1,1],[1,0,2,1]]);
  assert.equal(released.errors.length,0);
  if(early){
    const actual=await poll("short true physical KeyE auto-heavy after release",async()=>{
      const match=output.match(/M201_AUTH_ACTION tick=(\d+) fighter=1 from=9 to=10/);
      return {ok:!!match,tick:match?Number(match[1]):0};
    },13000);
    autoHit=actual.tick;
    assert(autoHit>=autoBegin+19,"KeyE auto-heavy waits 320ms even after early UP");
  }
  await pause(250);
  const actions=output.split("\n").filter(x=>x.includes("M201_AUTH_ACTION")&&x.includes(" fighter=1 "));
  assert.equal(actions.filter(x=>x.includes(" from=0 to=9")).length,1,"exactly one real heavy windup");
  assert.equal(actions.filter(x=>x.includes(" from=9 to=10")).length,1,"exactly one real heavy active; KeyE keyUp not another HIT");
  console.log("CORE8_NATIVE_W3C_KEYE_AUTO_WORLD_PASS",JSON.stringify({
    actualChromeTrustedW3C:true,actualTLSQUIC:true,
    worldHeavyBeforePhysicalKeyUp:!early,earlyPhysicalRelease:early,
    physicalKeyHoldMs:released.events[1].ms-released.events[0].ms,
    ack:released.acks,windupTick:autoBegin,heavyActiveTick:autoHit,actionCount:actions.length
  }));
} catch (error) {
  console.error("CORE8_NATIVE_W3C_KEYE_AUTO_FAILURE",JSON.stringify({
    error:String(error),serverLog:output.slice(-3200),
  }));
  throw error;
} finally {
  if(session)try{await wd("DELETE","/session/"+session);}catch{}
  for(const p of children)try{p.kill();}catch{}
}
