import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOwnSnapshotAckGate } from "../src/browser/own-snapshot-ack-gate.mjs";
import { createPredictionHistory, reconcilePrediction } from "../src/browser/reconciliation.mjs";

const ack=(clientTick,serverTick)=>({processedClientTick:clientTick,serverTick,playerNetId:7});

test("R1 ACK is deferred until local authoritative player position catches up", () => {
  const gate=createOwnSnapshotAckGate();
  const applied=[];
  assert.equal(gate.offer(ack(12,500)),true);
  assert.equal(gate.flush({serverTick:497},a=>applied.push(a)),null);
  assert.deepEqual(applied,[]);
  assert.equal(gate.metrics().waiting,true);
  const resolved=gate.flush({serverTick:500},a=>applied.push(a));
  assert.equal(resolved?.processedClientTick,12);
  assert.equal(applied.length,1);
  assert.equal(gate.lastAppliedClientTick,12);
  assert.equal(gate.metrics().waiting,false);
});

test("R1 coalesces newer pending acknowledgements, ignores stale out-of-order ACKs",()=>{
 const gate=createOwnSnapshotAckGate();
 assert.equal(gate.offer(ack(20,210)),true);
 assert.equal(gate.offer(ack(18,208)),false);
 assert.equal(gate.offer(ack(23,213)),true);
 const applied=[];
 assert.equal(gate.flush({serverTick:212},a=>applied.push(a)),null);
 assert.equal(gate.flush({serverTick:214},a=>applied.push(a)),applied[0]);
 assert.deepEqual(applied.map(a=>a.processedClientTick),[23]);
 assert.equal(gate.offer(ack(20,215)),false);
 assert.equal(gate.metrics().coalesced,1);
 assert.equal(gate.metrics().applied,1);
});

test("R1 pending ACK never loses prediction inputs before a fresh position anchor",()=>{
 const gate=createOwnSnapshotAckGate();
 const history=createPredictionHistory({maxEntries:16});
 history.push(12,{moveX:1});
 history.push(13,{moveX:1});
 history.push(14,{moveX:-1});
 const local={x:990};
 gate.offer(ack(13,203));
 gate.flush({serverTick:200,x:100},a=>{
  reconcilePrediction({history,processedClientTick:a.processedClientTick,authoritativeState:{x:100},
    restoreAuthoritative(o){local.x=o.x},replayInput(e){local.x+=e.moveX*2}});
 });
 assert.equal(history.size,3);
 assert.equal(local.x,990);
 gate.flush({serverTick:203,x:100},a=>{
  reconcilePrediction({history,processedClientTick:a.processedClientTick,authoritativeState:{x:100},
    restoreAuthoritative(o){local.x=o.x},replayInput(e){local.x+=e.moveX*2}});
 });
 assert.equal(local.x,98);
 assert.deepEqual(history.snapshot().map(e=>e.tick),[14]);
});

test("R1 uint32 wraparound is accepted but wrapped older ACKs cannot regress reconciliation",()=>{
 const gate=createOwnSnapshotAckGate();
 gate.offer(ack(0xffffffff,0xfffffff0));
 gate.flush({serverTick:0xfffffff1},()=>{});
 assert.equal(gate.offer(ack(0,1)),true);
 assert.equal(gate.flush({serverTick:0xffffffff},()=>{}),null);
 assert.equal(gate.flush({serverTick:2},()=>{}).processedClientTick,0);
 assert.equal(gate.offer(ack(0xffffffff,3)),false);
 assert.equal(gate.lastAppliedClientTick,0);
});

test("R1 must not apply a mismatched own fighter or malformed ACK",()=>{
 const gate=createOwnSnapshotAckGate();
 assert.throws(()=>gate.offer({processedClientTick:1,serverTick:1,playerNetId:0}));
 gate.offer(ack(2,40));
 assert.equal(gate.flush(null,()=>{}),null);
 assert.equal(gate.flush({serverTick:38},()=>{}),null);
 assert.equal(gate.metrics().applied,0);
});

test("R1 authoritative client defers prediction discard until the aligned own snapshot",()=>{
 const client=readFileSync(new URL("../web/authoritative-client.mjs",import.meta.url),"utf8");
 const online=readFileSync(new URL("../web/online-game.mjs",import.meta.url),"utf8");
 assert.match(client,/ackGate\.offer\(ack\)/);
 assert.match(client,/ackGate\.flush\(own, \(ack\) => \{/);
 assert.match(client,/predictionHistory\.discardThrough\(ack\.processedClientTick\)/);
 assert.match(client,/get processedClientTick\(\) \{ return ackGate\.lastAppliedClientTick; \}/);
 assert.match(online,/reconcilePrediction\(\{/);
 assert.match(online,/visualCamera\.absorb\(/);
 assert.match(online,/Deferred reconciles/);
 assert.doesNotMatch(client,/latestServerTick !== pendingAck\.serverTick/);
});

test("R1 strict Chrome/Firefox flight counts actual server ACK packets, not deferred presentation replay",()=>{
 const client=readFileSync(new URL("../web/authoritative-client.mjs",import.meta.url),"utf8");
 const pvp=readFileSync(new URL("../web/pvp-flight.mjs",import.meta.url),"utf8");
 const flight=readFileSync(new URL("../web/flight.mjs",import.meta.url),"utf8");
 const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
 assert.match(client,/onProcessedAck,/);
 assert.match(client,/if \(receivedNewAck\) onProcessedAck\?\.\(ack\)/);
 assert.match(client,/ackGate\.flush\(own, \(ack\) => \{/);
 for(const source of [pvp,flight]){
   const start=source.indexOf("onProcessedAck()");
   const end=source.indexOf("onAck()",start);
   assert.ok(start>0 && end>start);
   assert.match(source.slice(start,end),/acknowledgements \+= 1/);
   assert.doesNotMatch(source.slice(end,end+100),/acknowledgements \+= 1/);
 }
 assert.match(pvp,/snapshots >= 10 && acknowledgements >= 10 && sentInputs >= 20/);
 assert.match(runner,/result\.snapshots < 10 \|\| result\.acknowledgements < 10 \|\| result\.sentInputs < 20/);
});
