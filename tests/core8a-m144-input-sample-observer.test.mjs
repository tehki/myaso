import test from "node:test";
import assert from "node:assert/strict";
import {appendM144InputSample} from "../src/browser/m144-input-sample-observer.mjs";
const s=(tick, flags={})=>({clientTick:tick,epochMs:1792688300000+tick*33,attack:false,jump:false,heavyAttack:false,...flags});
test("last two genuine idle ticks prior to an action and first two afterward survive hundreds of later idle 30Hz samples",()=>{
  const events=[];
  for(let tick=1;tick<=100;tick++)appendM144InputSample(events,s(tick));
  assert.deepEqual(events.map(x=>x.clientTick),[99,100]);
  appendM144InputSample(events,s(101,{attack:true,heavyAttack:true}));
  appendM144InputSample(events,s(102,{attack:true,jump:true}));
  for(let tick=103;tick<=460;tick++)appendM144InputSample(events,s(tick));
  assert.deepEqual(events.map(x=>x.clientTick),[99,100,101,102,103,104]);
  assert.equal(events[2].heavyAttack,true);
  assert.equal(events[3].jump,true);
  assert.ok(events.every(e=>Object.isFrozen(e)));
});
test("distinct action-bearing samples remain in original order while out-of-band input flags are never rewritten",()=>{
  const events=[];
  for(let tick=1;tick<=18;tick++)appendM144InputSample(events,s(tick,{attack:tick%2===0,jump:tick===9,heavyAttack:tick%4===0}));
  assert.equal(events.length,18);
  assert.deepEqual(events.map(x=>x.clientTick),Array.from({length:18},(_,i)=>i+1));
  assert.deepEqual(events.map(x=>x.jump).filter(Boolean),[true]);
  assert.ok(events.filter(x=>x.heavyAttack).every(e=>e.attack));
});
test("unbounded actor attacks fail safe at exactly 32 retained samples without unbounded memory",()=>{
  const events=[];
  for(let i=0;i<500;i++)appendM144InputSample(events,s(i,{attack:true}));
  assert.equal(events.length,32);
  assert.deepEqual(events.map(x=>x.clientTick),Array.from({length:32},(_,i)=>468+i));
});
test("observer rejects invalid buffer rather than creating global mutable state",()=>{
  assert.throws(()=>appendM144InputSample(null,s(1)),TypeError);
  const a=[],b=[];
  appendM144InputSample(a,s(1,{attack:true}));
  assert.equal(a.length,1);
  assert.equal(b.length,0);
});
