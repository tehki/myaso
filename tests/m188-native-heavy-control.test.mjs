import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { requireM188NativeHeldLmb } from "../scripts/m188-native-heavy-control.mjs";

const pair = (x=.75,heldMs=450) => [
  {type:"pointerdown",button:0,x,y:.5,t:100,trusted:true,pointerId:1},
  {type:"pointerup",button:0,x,y:.5,t:100+heldMs,trusted:true,pointerId:1},
];
test("M188 requires real aimed native LMB held through READY and matching actual release",()=>{
  assert.equal(requireM188NativeHeldLmb(pair(),true).heldMs,450);
  assert.equal(requireM188NativeHeldLmb(pair(.25),false).heldMs,450);
  for(const bad of [[],pair().slice(0,1),pair(.75,319),pair(.25),[pair()[0],{...pair()[1],pointerId:2}],
    [{...pair()[0],y:undefined},pair()[1]],
    pair().map(e=>({...e,trusted:false})),[{type:"keydown",code:"KeyE",t:1},{type:"keyup",code:"KeyE",t:451}]]){
    assert.throws(()=>requireM188NativeHeldLmb(bad,true),/missing genuine aimed LMB/);
  }
});
test("M188 old calibration hold cannot qualify a later short or missing release",()=>{
  const old=pair(),short=pair(.75,40).map(e=>({...e,t:e.t+700}));
  assert.throws(()=>requireM188NativeHeldLmb([...old,...short],true),/missing genuine aimed LMB/);
  assert.throws(()=>requireM188NativeHeldLmb([...old,{...old[0],t:800}],true),/missing genuine aimed LMB/);
  assert.equal(requireM188NativeHeldLmb([...pair(.25),...pair().map(e=>({...e,t:e.t+700}))],true).heldMs,450);
});
test("M188 calibration and M223 exchange use the original native held-LMB helper, retain server phase and strict outcomes",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const section=source.slice(source.indexOf("async function calibrateHeavyIngress("),source.indexOf("async function runOnlineUiHeavyBlockFlight("));
  assert.doesNotMatch(section,/pulseMovementKey\(attacker, "e"/);
  assert.match(section,/performM110NativeHeldLmb\(attacker, attackerElementId, -attackOffset\)/);
  assert.match(section,/performM110NativeHeldLmb\(attacker, attackerElementId, attackOffset\)/);
  assert.match(section,/await awaitM223HeavyWindup\(/);
  assert.match(section,/const \[eResult, wheelResult\] = await Promise\.all/);
  assert.match(source,/defenderResult\.playerGuard !== 100/);
  assert.match(source,/Opponent blocked - guard -64\./);
  assert.match(source,/M107 heavy block accidentally resolved as parry/);
});

test("remaining native heavy producers retire E and retain physical release-based phases",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  assert.doesNotMatch(source,/pulseMovementKey\([^\n]*"e"|setMovementKey\([^\n]*"e"|type: "keyDown", value: "e"/);
  const strike=source.slice(source.indexOf("async function runOnlineUiHeavyStrikeFlight("),source.indexOf("async function prepareHeavyCounterplayFlight("));
  assert.match(strike,/performM110NativeHeldLmb\(attacker, attackerElementId, attackOffset\)/);
  assert.match(strike,/opponentHp !== 54/);
  const whiff=source.slice(source.indexOf("async function runOnlineUiHeavyWhiffPunishFlight("),source.indexOf("async function ",source.indexOf("async function runOnlineUiHeavyWhiffPunishFlight(")+40));
  assert.match(whiff,/performM110NativeHeldLmb\(attacker, attackerElementId, whiffOffset\)/);
  assert.match(whiff,/M109 heavy whiff punish", !attackRight/);
  assert.match(source,/performM110NativeHeldLmb\(heavyAttacker, heavyArena, 200\)/);
  assert.match(source,/100 \+ M110_LMB_HEAVY_HOLD_MS - COMBAT.heavyAttack.windupMs/);
  assert.match(source,/M171 physical LMB release produced a phantom light or duplicate heavy/);
});

test("M171 native W3C plan keeps wheel at70ms inside a450ms physical LMB hold",async()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const start=source.indexOf("async function performArenaHeavyFeint(");
  const end=source.indexOf("\nasync function ",start+30);
  let command;
  const fn=runInNewContext("("+source.slice(start,end)+")",{
    M110_LMB_HEAVY_HOLD_MS:450,
    webdriver:async(_base,method,_path,data)=>{assert.equal(method,"POST");command=data;},
  });
  await fn({base:"native-driver",sessionId:"real-session",name:"chrome"},"canvas",200);
  assert.equal(command.actions.length,2);
  const pointer=command.actions.find(a=>a.type==="pointer"),wheel=command.actions.find(a=>a.type==="wheel");
  assert.ok(pointer&&wheel);assert.equal(command.actions.some(a=>a.type==="key"),false);
  let time=0,down=null,up=null,scroll=null;
  for(let index=0;index<pointer.actions.length;index++){
    const p=pointer.actions[index],w=wheel.actions[index];
    if(p.type==="pointerDown")down=time;
    if(p.type==="pointerUp")up=time;
    if(w.type==="scroll"){scroll=time;assert.equal(w.deltaY,120);}
    time+=Math.max(p.duration??0,w.duration??0);
  }
  assert.equal(scroll-down,70);assert.equal(up-down,450);
  assert.ok(scroll>down&&scroll<up,"real wheel command precedes physical release; plan is not a World outcome claim");
});
