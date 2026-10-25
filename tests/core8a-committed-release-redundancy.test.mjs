import assert from "node:assert/strict";
import test from "node:test";
import {connectAuthoritativeClient} from "../web/authoritative-client.mjs";
import {decodeInputPacket,encodeInputPacket} from "../src/network/input-codec.mjs";
import {createInputRedundancy} from "../src/network/input-redundancy.mjs";
import {InputIngressWindow} from "../src/network/input-ingress.mjs";

const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function blockedReleaseFlight(release,{blockTick=58,neutralTicks=3}={}){
  const original=globalThis.WebTransport;
  let unblock;
  const gate=new Promise(resolve=>{unblock=resolve;});
  const written=[];
  class QuicFixture{
    constructor(){
      this.ready=Promise.resolve();this.closed=new Promise(resolve=>{this.end=resolve;});
      this.datagrams={
        writable:{getWriter:()=>({ready:Promise.resolve(),releaseLock(){},write:async bytes=>{
          const packet=decodeInputPacket(bytes);written.push(packet);
          if(packet.clientTick===blockTick)await gate;
        }})},
        readable:new ReadableStream({start:controller=>{this.input=controller;}}),
      };
    }
    async createBidirectionalStream(){return {writable:new WritableStream(),
      readable:new ReadableStream({start:controller=>{this.reliable=controller;}})};}
    close(){this.end();try{this.input.close();this.reliable.close();}catch{}}
  }
  globalThis.WebTransport=QuicFixture;
  const client=await connectAuthoritativeClient({webTransportUrl:"https://127.0.0.1:4433/game"});
  try{
    client.sendInput({tick:56});await flush();
    for(let tick=57;tick<=blockTick;tick++){
      client.sendInput({tick,attack:true,heavyAttack:true});await flush();
    }
    client.sendInput({tick:blockTick+1,...release});
    for(let tick=blockTick+2;tick<=blockTick+1+neutralTicks;tick++)client.sendInput({tick});
    unblock();await flush();
    return written;
  }finally{
    client.close();unblock();await flush();
    if(original===undefined)delete globalThis.WebTransport;else globalThis.WebTransport=original;
  }
}

for(const [name,release] of [["light",{attack:true,heavyAttack:false}],["heavy",{attack:false,heavyAttack:true}]]){
  test(`actual ${name} terminal retains its ORIGINAL three frames after more than four ticks of stalled writes`,async()=>{
    const written=await blockedReleaseFlight(release,{blockTick:79,neutralTicks:7});
    assert.deepEqual(written.slice(-4).map(p=>p.clientTick),[80,81,82,87]);
    assert.equal(written.at(-1).samples.some(s=>s.tick===80),false,
      "latest neutral no longer contains the expired terminal; recovery must use ORIGINAL frames");
    for(const packet of written.filter(p=>p.clientTick>=80&&p.clientTick<=82)){
      const terminal=packet.samples.find(s=>s.tick===80);
      assert.ok(terminal);
      assert.equal(terminal.attack,release.attack);
      assert.equal(terminal.heavyAttack,release.heavyAttack);
      assert.ok(((packet.clientTick-terminal.tick)>>>0)<=2);
    }
  });
}

test("actual long-held heavy release remains the original one-bit physical terminal after congestion",async()=>{
  const written=await blockedReleaseFlight({attack:false,heavyAttack:true},{blockTick:79});
  const latest=written.at(-1);
  assert.equal(latest.clientTick,83);
  assert.ok(latest.samples.some(s=>s.tick===80&&!s.attack&&s.heavyAttack),
    "the genuine heavy terminal must not disappear behind later neutral state");
  assert.equal(latest.samples[0].heavyAttack,false);
});

test("actual standard client preserves committed light release59 through blocked held write58",async()=>{
  const written=await blockedReleaseFlight({attack:true,heavyAttack:false,moveY:-1,facing:0.75});
  assert.deepEqual(written.map(p=>p.clientTick),[56,57,58,59,60,61,62],"same writer retains original hold AND terminal replay frames before latest movement");
  assert.ok(written.filter(p=>p.clientTick===57||p.clientTick===58)
    .every(p=>p.samples[0].attack&&p.samples[0].heavyAttack),"real held samples were written first");
  const latest=written.at(-1);
  const light=latest.samples.find(s=>s.tick===59&&s.attack&&!s.heavyAttack);
  assert.ok(light,"committed original light release cannot vanish behind later neutral packets");
  assert.equal(light.moveY,-1);
  assert.ok(Math.abs(light.facing-0.75)<0.001);
  assert.deepEqual(latest.samples.map(s=>s.tick),[62,61,59]);
  assert.equal(latest.samples[0].attack,false,"actual current neutral is never rewritten as attack");
});

test("actual held cancellation remains neutral and cannot invent a light release",async()=>{
  const written=await blockedReleaseFlight({attack:false,heavyAttack:false});
  assert.deepEqual(written.map(p=>p.clientTick),[56,57,58,59,62]);
  assert.deepEqual(written.at(-1).samples.map(s=>s.tick),[62,61,60]);
  assert.ok(written.at(-1).samples.every(s=>!s.attack&&!s.heavyAttack));
  assert.ok(written.every(p=>p.samples.every(s=>s.tick!==59||!s.attack)));
});


function releasePackets(){
  const redundancy=createInputRedundancy();
  const samples=[{tick:56},{tick:57,attack:true,heavyAttack:true},
    {tick:58,attack:true,heavyAttack:true},{tick:59,attack:true,heavyAttack:false},
    ...[60,61,62,63,64].map(tick=>({tick}))];
  return samples.map((sample,sequence)=>({clientTick:sample.tick,sequence,
    samples:redundancy.push(sample)}));
}

test("committed release keeps current/previous controls and expires at unchanged four-tick age",()=>{
  const packets=releasePackets();
  for(const tick of [62,63]){
    const packet=packets.find(p=>p.clientTick===tick);
    assert.deepEqual(packet.samples.map(s=>s.tick),[tick,tick-1,59]);
    assert.equal(packet.samples[0].attack,undefined,"newest neutral not rewritten");
    assert.ok(packet.samples[2].attack&&!packet.samples[2].heavyAttack);
  }
  assert.deepEqual(packets.at(-1).samples.map(s=>s.tick),[64,63,62]);
  assert.ok(packets.at(-1).samples.every(s=>!s.attack&&!s.heavyAttack));
});

test("actual encoded committed release enters unchanged ingress once despite repeated carried copies",()=>{
  const packets=releasePackets(),ingress=new InputIngressWindow();
  for(const packet of packets.filter(p=>p.clientTick<=58))ingress.ingest(encodeInputPacket(packet));
  // Original59 and ordinary copies60/61 were erased while the one writer
  // waited. NEW62 recovers the ORIGINAL59, not a later held substitute.
  const first=packets.find(p=>p.clientTick===62);
  const accepted=ingress.ingest(encodeInputPacket(first)).accepted;
  assert.equal(accepted.filter(s=>s.tick===59&&s.attack&&!s.heavyAttack).length,1);
  assert.equal(ingress.ingest(encodeInputPacket(first)).accepted.length,0);
  for(const packet of packets.filter(p=>p.clientTick>62)){
    assert.ok(ingress.ingest(encodeInputPacket(packet)).accepted.every(s=>s.tick!==59));
  }
});

test("reset, repeated tick and a fresh connection cannot inherit committed release",()=>{
  const makePinned=()=>{
    const redundancy=createInputRedundancy();
    redundancy.push({tick:57,attack:true,heavyAttack:true});
    redundancy.push({tick:58,attack:true,heavyAttack:true});
    redundancy.push({tick:59,attack:true,heavyAttack:false});
    return redundancy;
  };
  const old=makePinned();
  assert.ok(old.push({tick:62}).some(s=>s.tick===59));
  assert.deepEqual(old.push({tick:1}),[{tick:1}]);
  assert.ok(old.push({tick:2}).every(s=>!s.attack&&!s.heavyAttack));
  const repeated=makePinned();
  assert.deepEqual(repeated.push({tick:59}),[{tick:59}]);
  assert.deepEqual(createInputRedundancy().push({tick:59}),[{tick:59}]);
});

test("a newer real action replaces committed-release pin without reviving it after cancellation",()=>{
  const redundancy=createInputRedundancy();
  redundancy.push({tick:57,attack:true,heavyAttack:true});
  redundancy.push({tick:58,attack:true,heavyAttack:true});
  redundancy.push({tick:59,attack:true,heavyAttack:false});
  redundancy.push({tick:60});
  const newer={tick:61,kick:true,moveX:1};
  assert.equal(redundancy.push(newer)[0],newer);
  const neutral=redundancy.push({tick:62});
  assert.deepEqual(neutral.map(s=>s.tick),[62,61,60]);
  assert.ok(neutral.every(s=>s.tick!==59));
});
