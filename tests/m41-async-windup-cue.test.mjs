import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { m41NativeAsyncCueScript } from "../scripts/m41-native-observed-parry.mjs";

const light = "Attack committed - your windup is readable.";
const heavy = "Heavy strike committed - the long windup is readable.";
function browserObserver({ baseline=1, actor=1, allowHeavy=false, timeout=180 } = {}) {
  let now=0;
  let poll;
  let cleared=0;
  const completed=[];
  const state={online:"Online - player #1 - server tick 100",
    events:["Connecting to authoritative server..."],
    eventTransitions:[{text:"Connecting to authoritative server...",t:1}]};
  const script="(function() {" + m41NativeAsyncCueScript()
    + "\n}).apply(null, [baseline, actor, allowHeavy, timeout, done]);";
  vm.runInNewContext(script,{
    window:{__MYASO_M30_UI__:state},performance:{now:()=>now},
    setInterval(cb,ms){ assert.equal(ms,4); poll=cb; return 99; },
    clearInterval(id){assert.equal(id,99);cleared++;},
    baseline,actor,allowHeavy,timeout,
    done(value){completed.push(value);},
  });
  return {
    event(text) {state.events.push(text);state.eventTransitions.push({text,t:now});},
    actor(value) {state.online="Online - player #"+value+" - server tick 101";},
    time(ms){now+=ms;poll();},
    completed,get cleared(){return cleared;},
  };
}

test("fresh current-attempt actor-bound Light cue is returned without any extra WebDriver poll",()=>{
  const b=browserObserver();
  b.time(12);assert.equal(b.completed.length,0);
  b.event(light);b.time(4);
  assert.equal(b.completed.length,1);
  assert.equal(b.completed[0].actorId,1);
  assert.equal(b.completed[0].eventIndex,1);
  assert.equal(b.completed[0].text,light);
  assert.equal(b.cleared,1);
});

test("stale event, foreign actor, and superseded windup cannot trigger genuine wheel",()=>{
  const stale=browserObserver({baseline:2});
  stale.event(light);stale.time(5);
  assert.equal(stale.completed.length,0);
  stale.time(176);assert.equal(stale.completed[0],null);
  const foreign=browserObserver({actor:2});
  foreign.event(light);foreign.time(4);
  assert.equal(foreign.completed.length,0);
  const superseded=browserObserver();
  superseded.event(light);
  superseded.event("Opponent hit - 34 HP.");
  superseded.time(4);
  assert.equal(superseded.completed.length,0);
});

test("M35 Light-only and M41 explicitly-allowed early Heavy remain distinct",()=>{
  const m35=browserObserver();
  m35.event(heavy);m35.time(4);assert.equal(m35.completed.length,0);
  const m41=browserObserver({allowHeavy:true});
  m41.event(heavy);m41.time(4);
  assert.equal(m41.completed.length,1);
  assert.equal(m41.completed[0].text,heavy);
});

test("deadline without fresh original browser World cue fails closed",()=>{
  const b=browserObserver({timeout:180});
  b.time(179);assert.equal(b.completed.length,0);
  b.time(2);assert.deepEqual(b.completed,[null]);
  assert.equal(b.cleared,1);
});
