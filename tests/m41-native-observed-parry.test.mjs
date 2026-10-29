import assert from "node:assert/strict";
import test from "node:test";
import { dispatchM41ObservedParry, readM41ScalarWorldCue, summarizeM41CueTimeout, m41NativeAsyncCueScript } from "../scripts/m41-native-observed-parry.mjs";
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
  const charging={...state,events:[heavy],
    eventTransitions:[{text:heavy,t:1173.0}]};
  assert.equal(readM41ScalarWorldCue(charging,0,1),null,
    "M35 never uses the preceding heavy charge");
  assert.equal(readM41ScalarWorldCue(charging,0,1,true)?.t,1173.0,
    "M41 retains its previously qualified earlier heavy cue");
  assert.equal(readM41ScalarWorldCue(charging,1,1,true),null,
    "even M41 must never use a stale attempt");
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

test("original M41 cue-to-wheel host chronology is read-only and never gates a native parry", async () => {
  const attack = deferred(), wheel = deferred(), seen = [];
  let epoch = 1793015340300;
  const now = () => { epoch += 7; return epoch; };
  const flight = dispatchM41ObservedParry({
    now,
    sendAttack: () => { seen.push("real-click"); return attack.promise; },
    awaitWorldCue: () => { seen.push("actor-cue"); return readM41ScalarWorldCue(state, 0, 1); },
    sendWheel: () => { seen.push("real-wheel"); return wheel.promise; },
  });
  await tick();
  assert.deepEqual(seen, ["real-click", "actor-cue", "real-wheel"]);
  wheel.resolve(); await tick();
  assert.equal(await Promise.race([flight.then(() => "done"), tick().then(() => "waiting")]), "waiting");
  attack.resolve();
  const result = await flight;
  assert.deepEqual(seen, ["real-click", "actor-cue", "real-wheel"],
    "no additional input source or second wheel");
  const t = result.chronology;
  assert.ok(t.attackIssuedEpochMs < t.cueResolvedEpochMs);
  assert.ok(t.cueResolvedEpochMs < t.wheelIssuedEpochMs);
  assert.ok(t.wheelIssuedEpochMs < t.wheelAckEpochMs);
  assert.ok(t.wheelIssuedEpochMs < t.attackAckEpochMs,
    "wheel dispatch does not wait for the click ACK");
  assert.equal(result.nativeWheelAck, true);
  assert.equal(result.nativeClickAck, true);
});

test("no fresh M41 actor cue means no wheel despite chronology instrumentation", async () => {
  let wheels = 0;
  await assert.rejects(dispatchM41ObservedParry({
    now: () => 100,
    sendAttack: async () => {},
    awaitWorldCue: async () => null,
    sendWheel: () => { wheels++; },
  }), /missing fresh actor-bound World cue/);
  assert.equal(wheels, 0);
});

test("native reaction pacing waits after the genuine cue and before one wheel without waiting for click ACK", async () => {
  const attack=deferred(), reaction=deferred(), seen=[];
  const flight=dispatchM41ObservedParry({
    sendAttack:()=>{seen.push("click");return attack.promise;},
    awaitWorldCue:()=>{seen.push("cue");return readM41ScalarWorldCue(state,0,1);},
    waitForReaction:()=>{seen.push("reaction");return reaction.promise;},
    sendWheel:async()=>{seen.push("wheel");},
  });
  await tick();assert.deepEqual(seen,["click","cue","reaction"]);
  reaction.resolve();await tick();
  assert.deepEqual(seen,["click","cue","reaction","wheel"]);
  attack.resolve();assert.equal((await flight).nativeWheelAck,true);
  let reactions=0;
  await assert.rejects(dispatchM41ObservedParry({sendAttack:async()=>{},
    awaitWorldCue:async()=>null,waitForReaction:async()=>{reactions++;},
    sendWheel:async()=>{throw new Error("no wheel without cue");}}),/missing fresh/);
  assert.equal(reactions,0,"pacing cannot turn a missing cue into permission for input");
});

// First-red #40354245925: original World delivered 34HP while the async
// observer returned no fresh current-attempt light cue. Retain that failure.
test("M41 timeout retains bounded original event provenance without treating past windup as fresh", () => {
  const previous = Array.from({ length: 10 }, (_, index) => (
    index === 8 ? cue : "combat-message-" + index));
  const recording = {
    online: "Online - player #1 - server tick 1114",
    events: previous,
    eventTransitions: previous.map((text, index) => ({ text, t: index * 10 })),
  };
  const snapshot = summarizeM41CueTimeout(recording, 4, 1, 181.7);
  assert.equal(snapshot.timedOut, true);
  assert.equal(snapshot.observedActorId, 1);
  assert.equal(snapshot.expectedActorId, 1);
  assert.equal(snapshot.baselineEventCount, 4);
  assert.equal(snapshot.eventCount, 10);
  assert.equal(snapshot.observerElapsedMs, 182);
  assert.deepEqual(snapshot.recentEvents.map(entry => entry.index), [6, 7, 8, 9]);
  assert.equal(snapshot.recentEvents[2].text, cue);
  assert.equal(readM41ScalarWorldCue(recording, 4, 1), null,
    "superseded windup is never authorized for a late native wheel");
  assert.equal(readM41ScalarWorldCue(recording, 10, 1), null);
  assert.equal(summarizeM41CueTimeout(null, 0, 1, 180).observedActorId, null);
  assert.equal(summarizeM41CueTimeout({events: ["x".repeat(250)]}, 0, 1, 180)
    .recentEvents[0].text.length, 100, "bounded event text");
  const script = m41NativeAsyncCueScript();
  assert.match(script, /timeoutEvidence\(state, baseline, actorId, performance.now\(\) - started\)/);
  assert.ok(script.includes("done(cue ?? null)"), "native timeout response stays null");
  assert.ok(script.includes("window.__MYASO_M41_LAST_TIMEOUT__ = timeoutEvidence"),
    "bounded failure-only read-only browser snapshot is retained separately");
  assert.doesNotMatch(script, /dispatchEvent\(|new PointerEvent\(|\.click\(/);
});

test("M41 timeout sentinel always fails closed without dispatching any wheel", async () => {
  let wheels = 0;
  const timeout = summarizeM41CueTimeout(state, 2, 1, 180);
  await assert.rejects(dispatchM41ObservedParry({
    sendAttack: async () => {},
    awaitWorldCue: async () => timeout,
    sendWheel: () => { wheels++; },
  }), /missing fresh actor-bound World cue/);
  assert.equal(wheels, 0);
});
