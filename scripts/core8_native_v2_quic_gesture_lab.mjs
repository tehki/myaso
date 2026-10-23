// Chromium native W3C pointer through a real admitted QUIC connection to Rust World.
// Loopback-only nonrelease test. No fake HP, packets or server mutation.
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
      b[0]=2;b[1]=0x11;b[2]=action;
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
  await wd("POST",base+"/actions",{actions:[{
    type:"pointer",id:"auth-gesture-mouse",parameters:{pointerType:"mouse"},
    actions:[
      {type:"pointerMove",origin:"viewport",x:120,y:120,duration:0},
      {type:"pointerDown",button:0},
      {type:"pause",duration:6},
      {type:"pointerUp",button:0},
    ],
  }]});
  const accepted=await poll("native pointer and genuine World light",async()=>{
    const x=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,events:window.lab?.events,sent:window.lab?.sent,errors:window.lab?.errors};",
      args:[],
    });
    return {...x,ok:x.acks?.some(a=>a.sequence===1&&a.status===1)
      &&x.acks?.some(a=>a.sequence===2&&a.status===1)
      &&output.includes("M201_AUTH_ACTION")&&output.includes("to=1")};
  });
  assert.deepEqual(accepted.events.map(x=>x.name),["down","up"]);
  assert.equal(accepted.events[0].id,accepted.events[1].id);
  assert.equal(accepted.errors.length,0);
  console.log("CORE8_NATIVE_V2_WORLD_PASS",JSON.stringify({
    actualChrome:true,actualQUIC:true,
    clickMs:accepted.events[1].ms-accepted.events[0].ms,
    ack:accepted.acks,
    worldAction:output.split("\n").find(x=>x.includes("M201_AUTH_ACTION")&&x.includes("to=1")),
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
