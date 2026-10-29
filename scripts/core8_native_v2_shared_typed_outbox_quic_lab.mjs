// Native W3C LMB-only Combat plus genuine physical KeyE NEGATIVE through ONE
// original Core8A shared typed outbox and admitted QUIC to the Rust World.
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
function initBrowser(endpoint,pin,moduleUrl,dropFirstPress,dropFirstAck,heldUpgradeLoss,callback) {
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
        else if(name==="upgrade") event=q.upgrade(clientTick);
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
    let heldPointer=null;
    canvas.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      const downAt=performance.now();
      lab.events.push({name:"lmbDown",id:e.pointerId,ms:downAt,trusted:e.isTrusted});
      lab.offer("down",0);
      if(heldUpgradeLoss) {
        // Test-only physical-hold classifier. 48ms is illustrative, NOT
        // an approved product timer. The original World alone grants Heavy.
        heldPointer=e.pointerId;
        const trusted=e.isTrusted;
        setTimeout(()=>{
          if(heldPointer!==e.pointerId)return;
          const heldMs=performance.now()-downAt;
          if(heldMs>=135) {
            lab.errors.push("native held UPGRADE missed strict original 135ms Light");
            return;
          }
          lab.events.push({name:"heldUpgrade",id:e.pointerId,ms:performance.now(),heldMs,trusted});
          lab.offer("upgrade",0);
        },48);
      }
    });
    canvas.addEventListener("pointerup",e=>{
      if(e.button!==0)return;
      if(heldUpgradeLoss)heldPointer=null;
      lab.events.push({name:"lmbUp",id:e.pointerId,ms:performance.now(),trusted:e.isTrusted});
      lab.offer("up",0);
    });
    document.addEventListener("keydown",e=>{
      if(e.code!=="KeyE"||e.repeat)return;
      lab.events.push({name:"keyDown",ms:performance.now(),trusted:e.isTrusted});
      // E is future Use only: observe real W3C E, emit NO Combat outbox edge.
    });
    document.addEventListener("keyup",e=>{
      if(e.code!=="KeyE")return;
      lab.events.push({name:"keyUp",ms:performance.now(),trusted:e.isTrusted});
      // No source1 terminal, allocation, retry, ACK or World action.
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
      (process.env.CORE8A_LAB_DROP_FIRST_LMB_PRESS === "1" ||
       process.env.CORE8A_LAB_LOST_PRESS_EARLY_UPGRADE === "1"),
      process.env.CORE8A_LAB_DROP_FIRST_ACK === "1",
      process.env.CORE8A_LAB_LOST_PRESS_EARLY_UPGRADE === "1"],
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
  const heldKeyE = process.env.CORE8A_LAB_STANDALONE_KEYE_HELD === "1";
  const upgradeLossTest = process.env.CORE8A_LAB_LOST_PRESS_EARLY_UPGRADE === "1";
  assert(!upgradeLossTest || !heldKeyE,"loss and KeyE tests must be isolated");
  if(heldKeyE) {
    assert(process.env.CORE8A_LAB_DROP_FIRST_LMB_PRESS !== "1" &&
      process.env.CORE8A_LAB_DROP_FIRST_ACK !== "1",
      "standalone E retirement evidence must not mask dropped source0 packets");
    // Native physical KeyE may be observed, but has NO Combat producer.
    await wd("POST",base+"/actions",{actions:[{
      type:"key",id:"core8a-native-retired-keye",actions:[{type:"keyDown",value:"e"}],
    }]});
    await pause(490); // Even beyond the server READY320ms, E cannot charge.
    await wd("POST",base+"/actions",{actions:[{
      type:"key",id:"core8a-native-retired-keye",actions:[{type:"keyUp",value:"e"}],
    }]});
    const denied=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab.acks,sent:window.lab.sent,events:window.lab.events,errors:window.lab.errors,snapshot:window.lab.snapshot};",
      args:[],
    });
    assert.deepEqual(denied.events.map(e=>e.name),["keyDown","keyUp"]);
    assert(denied.events.every(e=>e.trusted),"actual physical W3C E events required");
    assert(denied.events[1].ms-denied.events[0].ms>=320,
      "real E held longer than READY320ms still cannot start Combat");
    assert.deepEqual(denied.sent,[],"retired KeyE cannot reserve or send source1 Combat");
    assert.deepEqual(denied.acks,[],"retired KeyE produces no Combat transport ACK");
    assert.deepEqual(denied.errors,[]);
    assert.equal(denied.snapshot.nextSequence,1);
    assert.equal(denied.snapshot.nextGestureId,1);
    assert.equal(denied.snapshot.pending,0);
    assert.equal(denied.snapshot.closed,false);
    assert.deepEqual(denied.snapshot.activeSources,[]);
    assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=(?:1|9|10)/.test(output),
      "physical E cannot mutate original Rust World Combat state");
    assert(!/M201_AUTH_HIT tick=\d+ attacker=1/.test(output),
      "physical E cannot commit a HIT");

    // Positive same-lease LMB proof: E did not steal seq1 or kill outbox.
    await wd("POST",base+"/actions",{actions:[{
      type:"pointer",id:"core8a-native-real-lmb",parameters:{pointerType:"mouse"},
      actions:[
        {type:"pointerMove",origin:"viewport",x:120,y:120,duration:0},
        {type:"pointerDown",button:0},
        {type:"pause",duration:6},
        {type:"pointerUp",button:0},
      ],
    }]});
    const accepted=await poll("physical LMB still reaches original World after held E",async()=>{
      const x=await wd("POST",base+"/execute/sync",{
        script:"return {acks:window.lab.acks,sent:window.lab.sent,events:window.lab.events,errors:window.lab.errors,snapshot:window.lab.snapshot};",args:[],
      });
      const world=output.split("\n").find(line=>
        /M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=1/.test(line));
      return {...x,world,ok:x.acks?.length===2&&x.acks.every(a=>a.status===1)&&
        x.snapshot?.pending===0&&!!world};
    });
    assert.deepEqual(accepted.events.map(e=>e.name),["keyDown","keyUp","lmbDown","lmbUp"]);
    assert.equal(accepted.events[2].id,accepted.events[3].id);
    assert.deepEqual(accepted.sent.map(e=>[e.sequence,e.gestureId,e.source,e.action]),
      [[1,1,0,1],[2,1,0,3]]);
    assert.deepEqual(accepted.acks.map(e=>[e.sequence,e.gestureId,e.source,e.status]),
      [[1,1,0,1],[2,1,0,1]]);
    assert.deepEqual(accepted.errors,[]);
    assert.equal(accepted.snapshot.closed,false);
    assert.deepEqual(accepted.snapshot.activeSources,[]);
    assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=9/.test(output),
      "held E and short LMB cannot start HeavyWindup");
    console.log("CORE8_NATIVE_SHARED_OUTBOX_KEYE_RETIRED_PASS",JSON.stringify({
      originalWorld:true,pinnedQUIC:true,oneCore8AOutbox:true,
      physicalHeldEms:denied.events[1].ms-denied.events[0].ms,
      source0Only:accepted.sent,acks:accepted.acks,world:accepted.world,
    }));
  } else if(upgradeLossTest) {
    // Genuine WebDriver DOWN stays physically held while seq1 is lost and
    // seq2 UPGRADE reaches original Rust QUIC BEFORE its predecessor.
    await wd("POST",base+"/actions",{actions:[{
      type:"pointer",id:"auth-shared-mouse",parameters:{pointerType:"mouse"},
      actions:[{type:"pointerMove",origin:"viewport",x:120,y:120,duration:0},
               {type:"pointerDown",button:0}],
    }]});
    const before=await poll("physical held early UPGRADE with lost PRESS",async()=>{
      const state=await wd("POST",base+"/execute/sync",{
        script:"return {events:window.lab.events,sent:window.lab.sent,dropped:window.lab.dropped,acks:window.lab.acks,errors:window.lab.errors,snapshot:window.lab.snapshot};",
        args:[],
      });
      return {...state,ok:state.events?.some(e=>e.name==="heldUpgrade") ||
        state.errors?.length>0};
    });
    assert.deepEqual(before.errors,[],"late browser sampler must not forge UPGRADE");
    assert.deepEqual(before.events.map(e=>e.name),["lmbDown","heldUpgrade"]);
    assert(before.events.every(e=>e.trusted),"real native W3C mouse required");
    assert(before.events[1].heldMs<135,"unchanged precontact cutoff");
    assert.deepEqual(before.sent.map(e=>[e.sequence,e.action,e.attempt]),
      [[1,1,1],[2,2,1]],"same authentic Core8A outbox and lease");
    assert.deepEqual(before.dropped,[{sequence:1,source:0,gestureId:1,attempt:1}]);
    assert.deepEqual(before.acks,[],"server must withhold out-of-order seq2 ACK");
    assert.equal(before.snapshot.pending,2);
    assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=1/.test(output),
      "no original World Light without delivered PRESS");
    for(const sequence of [1,2]) {
      const retry=await wd("POST",base+"/execute/async",{
        script:"window.lab.resendOne().then(arguments[0],e=>arguments[0]({error:String(e)}));",
        args:[],
      });
      assert.deepEqual(retry,{sequence,gestureId:1,source:0,attempt:2},
        "identical original Core8A edges, ordered after loss");
      await poll("authenticated accepted same-lease edge "+sequence,async()=>{
        const ack=await wd("POST",base+"/execute/sync",{
          script:"return window.lab.acks.find(a=>a.sequence===arguments[0])||null;",
          args:[sequence],
        });
        return {ok:ack?.status===1,ack};
      });
    }
    // Both genuine original QUIC receipts may be admitted under ONE World
    // tick/lock. Tick-sampled M201_AUTH_ACTION can compress 0→1→9 to 0→9.
    // Verify BOTH exact actor/lease-bound admission receipts, rather than
    // demanding an intermediate frame that never existed.
    await poll("original under-lock PRESS and precontact UPGRADE receipts",async()=>({
      // Source receipts are the actor/gesture authority. One World tick
      // may publish compressed 0→9, whereas adjacent ticks publish
      // distinct 0→1 and 1→9; BOTH are real and strictly constrained.
      ok:/M201_AUTH_GESTURE_ACTION tick=\d+ fighter=1 source=0 gesture=1 sequence=1 eventAction=1 status=1 from=0 to=1/.test(output) &&
         /M201_AUTH_GESTURE_ACTION tick=\d+ fighter=1 source=0 gesture=1 sequence=2 eventAction=2 status=1 from=1 to=9/.test(output) &&
         (/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=9/.test(output) ||
          (/M201_AUTH_ACTION tick=\d+ fighter=1 from=0 to=1/.test(output) &&
           /M201_AUTH_ACTION tick=\d+ fighter=1 from=1 to=9/.test(output)))
    }));
    await pause(390);
    const held=await wd("POST",base+"/execute/sync",{
      script:"return {events:window.lab.events,errors:window.lab.errors,snapshot:window.lab.snapshot};",
      args:[],
    });
    assert.deepEqual(held.events.map(e=>e.name),["lmbDown","heldUpgrade"]);
    assert.deepEqual(held.errors,[]);
    assert.equal(held.snapshot.pending,0);
    assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=9 to=10/.test(output),
      "original World may not release heavy before authentic physical UP");
    assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=1 to=2/.test(output),
      "no parallel LightActive after held precontact UPGRADE");
    await wd("POST",base+"/actions",{actions:[{
      type:"pointer",id:"auth-shared-mouse",parameters:{pointerType:"mouse"},
      actions:[{type:"pointerUp",button:0}],
    }]});
    const accepted=await poll("one genuine original World Heavy after W3C UP",async()=>{
      const state=await wd("POST",base+"/execute/sync",{
        script:"return {events:window.lab.events,sent:window.lab.sent,acks:window.lab.acks,errors:window.lab.errors,settlements:window.lab.settlements,snapshot:window.lab.snapshot};",
        args:[],
      });
      return {...state,ok:state.acks?.length===3&&state.snapshot?.pending===0&&
        /M201_AUTH_ACTION tick=\d+ fighter=1 from=9 to=10/.test(output)};
    });
    assert.deepEqual(accepted.errors,[]);
    assert.deepEqual(accepted.events.map(e=>e.name),["lmbDown","heldUpgrade","lmbUp"]);
    assert(accepted.events.every(e=>e.trusted));
    assert.equal(accepted.events[0].id,accepted.events[2].id);
    assert(accepted.events[2].ms-accepted.events[0].ms>=320);
    assert.deepEqual(accepted.sent.map(e=>[e.sequence,e.gestureId,e.source,e.action,e.attempt]),
      [[1,1,0,1,1],[2,1,0,2,1],[1,1,0,1,2],[2,1,0,2,2],[3,1,0,3,1]]);
    assert.deepEqual(accepted.acks.map(a=>[a.sequence,a.gestureId,a.source,a.status]),
      [[1,1,0,1],[2,1,0,1],[3,1,0,1]]);
    assert(accepted.settlements.every(a=>a.transportSettled&&!a.combatCommitted));
    assert.equal(accepted.snapshot.closed,false);
    assert.deepEqual(accepted.snapshot.activeSources,[]);
    for(const [from,to,sequence] of [[0,1,1],[1,9,2]]) {
      const count=output.split("\n").filter(line=>
        line.includes("M201_AUTH_GESTURE_ACTION") &&
        line.includes(" fighter=1 source=0 gesture=1 sequence="+sequence+" ") &&
        line.includes(" status=1 from="+from+" to="+to)).length;
      assert.equal(count,1,"one real under-lock World admission receipt "+from+"→"+to);
    }
    const worldLines=output.split("\n").filter(line=>line.includes("M201_AUTH_ACTION") &&
      line.includes(" fighter=1 "));
    const count=(from,to)=>worldLines.filter(line=>
      line.includes(" fighter=1 from="+from+" to="+to)).length;
    // Exactly one of the true 60Hz observation shapes is admissible:
    // same-tick compressed 0→9 OR adjacent-tick 0→1→9. Neither skips
    // the required authenticated same-gesture receipts above.
    const compressed=count(0,9)===1&&count(0,1)===0&&count(1,9)===0;
    const adjacent=count(0,9)===0&&count(0,1)===1&&count(1,9)===1;
    assert(compressed||adjacent,"original World observer must match one exact admission chronology");
    assert.equal(output.split("\n").filter(line=>
      line.includes("M201_AUTH_ACTION") &&
      line.includes(" fighter=1 from=9 to=10")).length,1,
      "genuine physical release commits one original World heavy");
    assert(!/M201_AUTH_ACTION tick=\d+ fighter=1 from=1 to=2/.test(output));
    assert(!/M201_AUTH_HIT tick=\d+ attacker=1/.test(output),
      "one real actor has no target; cannot invent Heavy damage");
    console.log("CORE8_NATIVE_ONE_SHARED_OUTBOX_LOST_PRESS_EARLY_UPGRADE_PASS",
      JSON.stringify({genuineW3C:true,originalQUIC:true,originalWorld:true,
        illustrativeHoldMs:accepted.events[1].heldMs,
        physicalHoldMs:accepted.events[2].ms-accepted.events[0].ms,
        dropped:before.dropped,sent:accepted.sent,acks:accepted.acks,
        snapshot:accepted.snapshot}));
  } else {
  // One native W3C schedule: physical source0 LMB remains the ONLY Combat edge.
  // Trusted KeyE down/up DURING light windup must leave queue and World untouched.
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
    // Only seq1 was deliberately lost; seq2 genuine LMB RELEASE reached the
    // actual Rust QUIC listener first. The server must await the missing PRESS
    // before accepting source0 terminal or running the original World attack.
    await pause(140);
    const before=await wd("POST",base+"/execute/sync",{
      script:"return {acks:window.lab.acks, sent:window.lab.sent, dropped:window.lab.dropped, snapshot:window.lab.snapshot};",
      args:[],
    });
    assert.deepEqual(before.dropped,[{sequence:1,source:0,gestureId:1,attempt:1}]);
    assert.equal(before.acks.length,0,"source0 RELEASE cannot be ACKed ahead of lost LMB PRESS");
    assert.equal(before.snapshot.pending,2,"only two real source0 LMB edges remain pending");
    assert(!output.includes("fighter=1 from=1 to=2"),
      "no original LightActive without the authenticated missing LMB PRESS");
    // Only the real Core8A queue decides which edge is retried. The driver
    // never reconstructs packets or assigns sequence/source/gesture IDs.
    for(let sequence=1;sequence<=2;sequence++) {
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
      return {...v,ok:v.acks?.length===1&&v.snapshot?.pending===1
        &&v.droppedAcks?.length===1};
    });
    assert.deepEqual(before.droppedAcks,[{sequence:1,status:1}],
      "must discard ONLY authentic server ACCEPTED for already-admitted seq1");
    assert.deepEqual(before.acks.map(x=>x.sequence).sort((a,b)=>a-b),[2]);
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
    return {...x,ok:x.acks?.length===2 && x.snapshot?.pending===0
      &&x.acks?.every(a=>a.status===(ackLossTest&&a.sequence===1?2:1))
      &&output.includes("M201_AUTH_ACTION")&&output.includes("fighter=1 from=1 to=2")};
  });
  assert.deepEqual(accepted.events.map(x=>x.name),
    ["lmbDown","keyDown","keyUp","lmbUp"]);
  assert.equal(accepted.events[0].id,accepted.events[3].id);
  assert(accepted.events.slice(1,3).every(x=>x.trusted),"genuine W3C physical KeyE required");
  assert.deepEqual(accepted.sent.filter(x=>x.attempt===1).map(x=>[x.sequence,x.gestureId,x.source,x.action]),
    [[1,1,0,1],[2,1,0,3]]);
  assert.deepEqual(accepted.sent.filter(x=>x.attempt===2).map(x=>x.sequence),
    lossTest?[1,2]:ackLossTest?[1]:[]);
  assert.deepEqual(accepted.acks.map(x=>[x.sequence,x.gestureId,x.source,x.status]).sort((a,b)=>a[0]-b[0]),
    [[1,1,0,ackLossTest?2:1],[2,1,0,1]]);
  assert.deepEqual(accepted.droppedAcks,ackLossTest?[{sequence:1,status:1}]:[]);
  assert.equal(accepted.sent.some(edge=>edge.source!==0),false,
    "physical E cannot become a Combat source or consume outbox ordering");
  assert(accepted.acks.every(ack=>ack.source===0),
    "retired E must never receive a Combat ACK");
  assert.equal(accepted.snapshot.nextSequence,3);
  assert.equal(accepted.snapshot.nextGestureId,2);
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
