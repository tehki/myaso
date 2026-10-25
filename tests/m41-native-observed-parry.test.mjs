import assert from "node:assert/strict";
import test from "node:test";
import { dispatchM41ObservedParry, readM41ScalarWorldCue } from "../scripts/m41-native-observed-parry.mjs";
const heavy="Heavy strike committed - the long windup is readable.";
const cue="Attack committed - your windup is readable.";
const state={online:"Online - player #1 - server tick 1637",events:[heavy,cue],
  eventTransitions:[{text:heavy,t:1173.0},{text:cue,t:1176.4}]};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(setImmediate);

test("scalar cue is actual fresh same-actor recorded World text, never stale history or a copied foreign cue",()=>{
  assert.equal(readM41ScalarWorldCue(state,0,1).t,1176.4);
  assert.equal(readM41ScalarWorldCue(state,0,2),null);
  assert.equal(readM41ScalarWorldCue(state,1,1).t,1176.4);
  assert.equal(readM41ScalarWorldCue(state,2,1),null);
  assert.equal(readM41ScalarWorldCue({...state,events:[heavy],
    eventTransitions:[{text:heavy,t:1173.0}]},0,1),null,
    "an earlier real heavy charge cannot trigger the short-click wheel");
  assert.equal(readM41ScalarWorldCue({...state,eventTransitions:[{text:heavy,t:1173.0},{text:"forged",t:1176.4}]},0,1),null);
  assert.equal(readM41ScalarWorldCue({...state,eventTransitions:[]},0,1),null);
  assert.equal(readM41ScalarWorldCue({...state,events:["Opponent hit - 34 HP."]},0,1),null);
  assert.equal(readM41ScalarWorldCue({...state,events:[heavy,cue,"Opponent hit - 34 HP."]},0,1),null,
    "a fresh but already superseded windup cannot trigger a late native wheel");
});
test("fresh observed cue sends one native wheel before unrelated click ACK, but both ACKs remain mandatory",async()=>{
  const attack=deferred(),observed=deferred(),wheel=deferred();const calls=[];
  const flight=dispatchM41ObservedParry({sendAttack:()=>{calls.push("native-click");return attack.promise;},
    awaitWorldCue:()=>observed.promise,sendWheel:()=>{calls.push("native-wheel");return wheel.promise;}});
  await tick();assert.deepEqual(calls,["native-click"]);
  observed.resolve(readM41ScalarWorldCue(state,0,1));await tick();
  assert.deepEqual(calls,["native-click","native-wheel"]);
  wheel.resolve();await tick();
  assert.equal(await Promise.race([flight.then(()=>"done"),tick().then(()=>"waiting")]),"waiting");
  attack.resolve();const result=await flight;assert.equal(result.cue.actorId,1);
});
test("missing fresh cue sends no wheel, waits for actual click and preserves its failure too",async()=>{
  const attack=deferred();let wheels=0;
  const flight=dispatchM41ObservedParry({sendAttack:()=>attack.promise,awaitWorldCue:()=>null,sendWheel:()=>{wheels++;}});
  await tick();assert.equal(wheels,0);
  assert.equal(await Promise.race([flight.then(()=>"done",()=>"failed"),tick().then(()=>"waiting")]),"waiting");
  const rejected=assert.rejects(flight,error=>error instanceof AggregateError&&error.errors.some(e=>e.message==="native click failed"));
  attack.reject(new Error("native click failed"));await rejected;
});
test("failed native wheel still awaits click completion; no duplicate native command is authored",async()=>{
  const attack=deferred();let wheels=0;
  const flight=dispatchM41ObservedParry({sendAttack:()=>attack.promise,
    awaitWorldCue:()=>readM41ScalarWorldCue(state,0,1),sendWheel:()=>{wheels++;throw new Error("native wheel failed");}});
  await tick();assert.equal(wheels,1);
  const rejected=assert.rejects(flight,/native wheel failed/);attack.resolve();await rejected;
});
