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
function initBrowser(endpoint,pin,moduleUrl,dropFirstPress,dropFirstAck,callback) {
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
    const lab={acks:[],events:[],sent:[],dropped:[],droppedAcks:[],errors:[],settlements:[],queue:null};
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
        // Negative loss lab: packet seq1 is physically emitted by the real
        // Core8A queue, but the transport intentionally discards its first
        // datagram. It must stay pending for the queue's genuine resend.
        if(dropFirstPress && packet.sequence===1 && packet.attempt===1) {
          lab.dropped.push({sequence:packet.sequence,source:packet.source,
            gestureId:packet.gestureId,attempt:packet.attempt});
        } else {
          void writer.write(packet.bytes).catch(e=>lab.errors.push(String(e)));
        }
      } catch(e) {lab.errors.push(String(e));}
    };
    lab.resendOne=async()=>{
      const [packet]=q.nextSendBatch(1);
      if(!packet)throw Error("expected bounded in-order retry, queue was empty");
      lab.sent.push({source:packet.source,action:packet.action,
        sequence:packet.sequence,gestureId:packet.gestureId,attempt:packet.attempt});
      await writer.write(packet.bytes);
      return {sequence:packet.sequence,gestureId:packet.gestureId,
        source:packet.source,attempt:packet.attempt};
    };
    const incoming=wt.datagrams.readable.getReader();
    void (async()=>{
      for(;;) {
        const result=await incoming.read();if(result.done)break;
        const b=new Uint8Array(result.value);
        if(b.length===16&&b[0]===2&&b[1]===0x12) {
          // ACK loss means World already admitted original PRESS, but the
          // Core8A sender never saw the receipt. Do not mutate the packet,
          // World, replay cache, browser queue, or forge an ACK.
          if(dropFirstAck && new DataView(b.buffer,b.byteOffset,b.byteLength)
            .getUint32(4,true)===1 && lab.droppedAcks.length===0) {
            lab.droppedAcks.push({sequence:1,status:b[2]});
            continue;
          }
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
      "http://127.0.0.1:"+httpPort+"/src/network/prealpha-lmb-gesture-outbox-proposal.mjs",
      process.env.CORE8A_LAB_DROP_FIRST_LMB_PRESS === "1",
      process.env.CORE8A_LAB_DROP_FIRST_ACK === "1"],
  });
  assert(boot.ok,JSON.stringify(boot));
  const heldKeyE = process.env.CORE8A_LAB_STANDALONE_KEYE_HELD === "1";
  if(heldKeyE) {
    assert(!process.env.CORE8A_LAB_DROP_FIRST_LMB_PRESS ||
      process.env.CORE8A_LAB_DROP_FIRST_LMB_PRESS !== "1",
      "independent held KeyE case cannot share dropped-LMB mode");
    assert(process.env.CORE8A_LAB_DROP_FIRST_ACK !== "1",
      "independent held KeyE case cannot share dropped-ACK mode");
    await wd("POST",base+"/actions",{actions:[{
      type:"key",id:"core8a-actual-keye-held",actions:[{type:"keyDown",value:"e"}],
    }]});
    const press=await poll("real original World KeyE heavy windup from shared outbox",async()=>{
      const x=await wd("POST",base+"/execute/sync",{
        script:"return {acks:window.lab?.acks,sent:window.lab?.sent,events:window.lab?.events,errors:window.lab?.errors,snapshot:window.lab?.snapshot};",
        args:[],
      });
      const windup=output.split("\n").find(l=>
        /M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=9/.test(l));
      return {...x,windup,ok:!!windup&&x.acks?.length===1&&x.acks[0].status===1};
    });
    assert.deepEqual(press.sent.map(e=>[e.source,e.action,e.sequence,e.gestureId,e.attempt]),
      [[1,1,1,1,1]]);
    assert.equal(press.snapshot.pending,0);
    await pause(490); // physical KeyE remains DOWN for 320ms server READY
    assert(!output.includes("fighter=1 from=9 to=10"),
      "RELEASE-only policy: held KeyE must NEVER auto-strike at 320ms");
    await wd("POST",base+"/actions",{actions:[{
      type:"key",id:"core8a-actual-keye-held",actions:[{type:"keyUp",value:"e"}],
    }]});
    const accepted=await poll("real original World heavy ONLY after physical KeyE UP",async()=>{
      const x=await wd("POST",base+"/execute/sync",{
        script:"return {acks:window.lab?.acks,sent:window.lab?.sent,events:window.lab?.events,errors:window.lab?.errors,snapshot:window.lab?.snapshot,settlements:window.lab?.settlements};",
        args:[],
      });
      const active=output.split("\n").find(l=>
        /M201_AUTH_ACTION tick=\d+ fighter=1 from=9 to=10/.test(l));
      return {...x,active,ok:!!active&&x.acks?.length===2
        &&x.acks[1].sequence===2&&x.acks[1].status===1};
    });
    assert.deepEqual(accepted.events.map(e=>e.name),["keyDown","keyUp"]);
    assert(accepted.events.every(e=>e.trusted),"both actual KeyE edges must be trusted native W3C events");
    assert(accepted.events[1].ms-accepted.events[0].ms>=320,
      "physical key held until the 320ms original server READY threshold");
    assert.deepEqual(accepted.sent.map(e=>[e.source,e.action,e.sequence,e.gestureId,e.attempt]),
      [[1,1,1,1,1],[1,3,2,1,1]]);
    assert.deepEqual(accepted.acks.map(e=>[e.sequence,e.gestureId,e.source,e.status]),
      [[1,1,1,1],[2,1,1,1]]);
    assert(accepted.acks.every(e=>e.tick>0),"genuine original World tick in every server ACK");
    assert(accepted.settlements.every(e=>e.transportSettled&&!e.combatCommitted),
      "ACKs are never a server-authorized HIT");
    assert.equal(accepted.snapshot.pending,0);
    assert.equal(accepted.snapshot.closed,false);
    assert.deepEqual(accepted.snapshot.activeSources,[]);
    assert.equal(output.split("\n").filter(l=>
      /M201_AUTH_ACTION tick=\d+ fighter=1 from=9 to=10/.test(l)).length,1,
      "one matching physical KeyE RELEASE must commit exactly one real heavy");
    assert.equal(accepted.errors.length,0);
    console.log("CORE8_NATIVE_SHARED_OUTBOX_KEYE_RELEASE_ONLY_PASS",JSON.stringify({
      originalWorld:true,pinnedQUIC:true,oneCore8AOutbox:true,
      physicalHeldMs:accepted.events[1].ms-accepted.events[0].ms,
      press:press.windup,release:accepted.active,
      receipts:accepted.acks,queue:accepted.snapshot,
    }));
  } else {
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
  const lossTest=process.env.CORE8A_LAB_DROP_FIRST_LMB_PRESS === "1";
  const ackLossTest=process.env.CORE8A_LAB_DROP_FIRST_ACK === "1";
  assert(!(lossTest && ackLossTest),"loss modes must stay independent");
  if(lossTest) {
    // Actual W3C edges have all been placed on the ONE real sender queue.
    // Only seq1 was deliberately lost; seq2-4 reached the actual Rust QUIC
    // listener *before* seq1. The server must withhold their ACK and avoid
    // any premature original World action until the missing PRESS returns.
    await pause(140);
    const before=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab.acks, sent:window.lab.sent, dropped:window.lab.dropped, snapshot:window.lab.snapshot};",
      args:[],
    });
    assert.deepEqual(before.dropped,[{sequence:1,source:0,gestureId:1,attempt:1}]);
    assert.equal(before.acks.length,0,"future KeyE/LMB cannot be ACKed ahead of lost LMB PRESS");
    assert.equal(before.snapshot.pending,4,"all four independently sourced W3C edges must remain pending");
    assert(!output.includes("fighter=1 from=1 to=2"),
      "no original LightActive without the authenticated missing LMB PRESS");
    // Only the real Core8A queue decides which edge is retried. The driver
    // never reconstructs packets or assigns sequence/source/gesture IDs.
    for(let sequence=1;sequence<=4;sequence++) {
      const retry=await wd("POST",base+"/execute/async",{
        script:"window.lab.resendOne().then(arguments[0],e=>arguments[0]({error:String(e)}));",
        args:[],
      });
      assert.equal(retry.sequence,sequence,
        "ordered retransmission MUST come from original pending Core8A outbox");
      assert.equal(retry.attempt,2,"each canonical edge is retried exactly once");
      await poll("real World ACK after Core8A retry seq"+sequence,async()=>{
        const ack=await wd("POST",base+"/execute/sync",{
          script:"return window.lab.acks.find(x=>x.sequence===arguments[0])||null;",
          args:[sequence],
        });
        return {ok:ack?.status===1,ack};
      });
    }
  }
  if(ackLossTest) {
    // The Rust server admitted every distinct event and began original World
    // light windup, but the browser withheld its own first ACK from the
    // single authentic queue. All other live ACKs are processed normally.
    const before=await poll("actual admitted PRESS with client lost-ACK pending",async()=>{
      const v=await wd("POST",base+"/execute/sync",{
        script:"return {acks:window.lab.acks,droppedAcks:window.lab.droppedAcks,snapshot:window.lab.snapshot};",
        args:[],
      });
      return {...v,ok:v.acks?.length===3&&v.snapshot?.pending===1
        &&v.droppedAcks?.length===1};
    });
    assert.deepEqual(before.droppedAcks,[{sequence:1,status:1}],
      "must discard ONLY authentic server ACCEPTED for already-admitted seq1");
    assert.deepEqual(before.acks.map(x=>x.sequence).sort((a,b)=>a-b),[2,3,4]);
    const retry=await wd("POST",base+"/execute/async",{
      script:"window.lab.resendOne().then(arguments[0],e=>arguments[0]({error:String(e)}));",
      args:[],
    });
    assert.deepEqual(retry,{sequence:1,gestureId:1,source:0,attempt:2},
      "the original outbox must retry byte-identical accepted PRESS, never a new World action");
    await poll("actual original server DUPLICATE after ACK loss",async()=>{
      const v=await wd("POST",base+"/execute/sync",{
        script:"return {acks:window.lab.acks,snapshot:window.lab.snapshot};",args:[],
      });
      return {...v,ok:v.acks?.some(a=>a.sequence===1&&a.status===2)
        &&v.snapshot?.pending===0};
    });
  }
  const accepted=await poll("native shared typed outbox → genuine World light",async()=>{
    const x=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab?.acks,events:window.lab?.events,sent:window.lab?.sent,dropped:window.lab?.dropped,droppedAcks:window.lab?.droppedAcks,errors:window.lab?.errors,settlements:window.lab?.settlements,snapshot:window.lab?.snapshot};",
      args:[],
    });
    return {...x,ok:x.acks?.length===4 && x.snapshot?.pending===0
      &&x.acks?.every(a=>a.status===(ackLossTest&&a.sequence===1?2:1))
      &&output.includes("M201_AUTH_ACTION")&&output.includes("fighter=1 from=1 to=2")};
  });
  assert.deepEqual(accepted.events.map(x=>x.name),
    ["lmbDown","keyDown","keyUp","lmbUp"]);
  assert.equal(accepted.events[0].id,accepted.events[3].id);
  assert(accepted.events.slice(1,3).every(x=>x.trusted),"genuine W3C physical KeyE required");
  assert.deepEqual(accepted.sent.filter(x=>x.attempt===1).map(x=>[x.sequence,x.gestureId,x.source,x.action]),
    [[1,1,0,1],[2,2,1,1],[3,2,1,3],[4,1,0,3]]);
  assert.deepEqual(accepted.sent.filter(x=>x.attempt===2).map(x=>x.sequence),
    lossTest?[1,2,3,4]:ackLossTest?[1]:[]);
  assert.deepEqual(accepted.acks.map(x=>[x.sequence,x.gestureId,x.source,x.status]).sort((a,b)=>a[0]-b[0]),
    [[1,1,0,ackLossTest?2:1],[2,2,1,1],[3,2,1,1],[4,1,0,1]]);
  assert.deepEqual(accepted.droppedAcks,ackLossTest?[{sequence:1,status:1}]:[]);
  assert(accepted.settlements.every(x=>x.transportSettled&&!x.combatCommitted));
  assert.deepEqual(accepted.snapshot.activeSources,[]);
  assert.equal(accepted.snapshot.closed,false);
  assert(!output.includes("fighter=1 from=9 to=10"),
    "BUSY KeyE must not create a phantom standalone heavy");
  assert.equal(output.split("\n").filter(line=>
    line.includes("M201_AUTH_ACTION") &&
    line.includes("fighter=1 from=1 to=2")).length,1,
    "replayed PRESS and lost ACK may never execute a second authoritative light action");
  assert.equal(accepted.errors.length,0);
  console.log(lossTest?"CORE8_NATIVE_ONE_SHARED_OUTBOX_LOSS_REPLAY_PASS":
    ackLossTest?"CORE8_NATIVE_ONE_SHARED_OUTBOX_ACK_LOSS_DUPLICATE_PASS":
    "CORE8_NATIVE_ONE_SHARED_OUTBOX_WORLD_PASS",JSON.stringify({
    actualChromeW3C:true,actualQUIC:true,actualCore8AOutbox:true,
    lossTest,ackLossTest,dropped:accepted.dropped,droppedAcks:accepted.droppedAcks,
    events:accepted.events.map(x=>x.name),sent:accepted.sent,acks:accepted.acks,
    snapshot:accepted.snapshot,
    worldAction:output.split("\n").find(x=>x.includes("M201_AUTH_ACTION")&&x.includes("fighter=1 from=1 to=2")),
  }));
  }
} catch (error) {
  console.error("CORE8_NATIVE_V2_FAILURE",JSON.stringify({
    error:String(error),serverLog:output.slice(-3200),
  }));
  throw error;
} finally {
  if(session)try{await wd("DELETE","/session/"+session);}catch{}
  for(const p of children)try{p.kill();}catch{}
}
