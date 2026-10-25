import test from "node:test";
import assert from "node:assert/strict";
import {connectAuthoritativeClient} from "../web/authoritative-client.mjs";
import {decodeInputPacket,encodeInputPacket} from "../src/network/input-codec.mjs";
import {InputIngressWindow} from "../src/network/input-ingress.mjs";
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function fixture(run,{blockTick=null,blockReady=false}={}){
 const original=globalThis.WebTransport,sessions=[];
 let unblock;const gate=new Promise(r=>{unblock=r;});
 class QuicFixture{
  constructor(){
   sessions.push(this);this.ready=Promise.resolve();this.writes=[];this.closed=new Promise(r=>this.end=r);
   this.datagrams={writable:{getWriter:()=>({ready:blockReady?gate:Promise.resolve(),
    write:async bytes=>{this.writes.push(bytes);if(decodeInputPacket(bytes).clientTick===blockTick)await gate;},releaseLock(){}})},
    readable:new ReadableStream({start:c=>{this.input=c;}})};
  }
  async createBidirectionalStream(){return {writable:new WritableStream(),readable:new ReadableStream({start:c=>{this.reliable=c;}})};}
  close(){this.end();try{this.input.close();this.reliable.close();}catch{}}
 }
 globalThis.WebTransport=QuicFixture;
 const make=()=>connectAuthoritativeClient({webTransportUrl:"https://127.0.0.1:4433/game"});
 const client=await make();
 try{await run({client,sessions,unblock,make});}
 finally{client.close();unblock();await flush();if(original===undefined)delete globalThis.WebTransport;else globalThis.WebTransport=original;}
}

test("actual standard client retains original three-copy recovery across uint32 tick wrap",()=>fixture(async({client,sessions})=>{
 for(const tick of [0xffff_fffd,0xffff_fffe,0xffff_ffff,0]){
  client.sendInput({tick,attack:tick!==0xffff_fffd,heavyAttack:tick!==0xffff_fffd});
  await flush();
 }
 const packets=sessions[0].writes.map(decodeInputPacket);
 assert.equal(packets.at(-1).clientTick,0);
 assert.deepEqual(packets.at(-1).samples.map(s=>s.tick),[0,0xffff_ffff,0xffff_fffe]);
}));
test("actual client retains original 40/41/42 encoded replay packets while write40 is blocked",()=>fixture(async({client,sessions,unblock})=>{
 client.sendInput({tick:39});await flush();
 client.sendInput({tick:40,attack:true,heavyAttack:true});await flush();
 for(const tick of [41,42,43])client.sendInput({tick,attack:true,heavyAttack:true});
 unblock();await flush();
 const packets=sessions[0].writes.map(decodeInputPacket);
 assert.deepEqual(packets.map(p=>p.clientTick),[39,40,41,42,43]);
 const originals=packets.filter(p=>p.samples.some(s=>s.tick===40&&s.attack&&s.heavyAttack));
 assert.deepEqual(originals.filter(p=>p.clientTick<=42).map(p=>p.clientTick),[40,41,42],"all three ORIGINAL replay opportunities must survive");
 assert.ok(packets.filter(p=>p.clientTick>40).some(p=>p.samples.some(s=>s.tick===40&&s.heavyAttack)),"first-drop recovery");
 assert.ok(packets.filter(p=>p.clientTick>41).some(p=>p.samples.some(s=>s.tick===40&&s.heavyAttack)),"first and second opportunity loss recover from original third");
 for(const droppedThrough of [40,41]){
  const ingress=new InputIngressWindow(),recovered=[];
  for(const packet of packets){
   if(packet.clientTick>=40&&packet.clientTick<=droppedThrough)continue;
   const accepted=ingress.ingest(encodeInputPacket(packet)).accepted;
   for(const sample of accepted)if(sample.tick===40&&sample.heavyAttack)recovered.push(packet.clientTick);
  }
  assert.equal(recovered.length,1,"the original tick enters ingress exactly once");
  assert.ok(recovered[0]-40<=2,"M230 original three-copy bound is never weakened");
 }
},{blockTick:40}));
test("ordinary movement remains latest-wins while the same writer is blocked",()=>fixture(async({client,sessions,unblock})=>{
 for(let tick=1;tick<=100;tick++)client.sendInput({tick,moveX:1});
 assert.equal(client.transport.v1ReplayWindow.pending,0);
 unblock();await flush();
 assert.deepEqual(sessions[0].writes.map(decodeInputPacket).map(p=>p.clientTick),[100]);
},{blockReady:true}));
test("eight retained original packets bound memory and ninth retires the current lease",()=>fixture(async({client,sessions,unblock})=>{
 client.sendInput({tick:0});
 for(let tick=1;tick<=8;tick++)client.sendInput({tick,attack:tick%2===1});
 assert.equal(client.transport.v1ReplayWindow.pending,8);
 assert.throws(()=>client.sendInput({tick:9,attack:true}),/overflow/);
 assert.equal(client.transport.closed,true);
 assert.equal(client.transport.v1ReplayWindow.pending,0);
 unblock();await flush();
 assert.equal(sessions[0].writes.length,0,"retired ready waiter cannot send retained old inputs");
},{blockReady:true}));
test("1500ms replay stall retires old work and a fresh client cannot inherit its input",async t=>{
 t.mock.timers.enable({apis:["setTimeout","Date"]});
 await fixture(async({client,sessions,unblock,make})=>{
  client.sendInput({tick:1,attack:true,heavyAttack:true});
  t.mock.timers.tick(1499);assert.equal(client.transport.closed,false);
  t.mock.timers.tick(1);assert.equal(client.transport.closed,true);
  unblock();await flush();assert.equal(sessions[0].writes.length,0);
  const fresh=await make();
  try{fresh.sendInput({tick:100,moveX:1});await flush();
   assert.deepEqual(sessions[1].writes.map(decodeInputPacket).map(p=>p.clientTick),[100]);
  }finally{fresh.close();}
 },{blockReady:true});
});
