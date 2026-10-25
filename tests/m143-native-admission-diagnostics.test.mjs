import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
const start=runner.indexOf("async function runOnlineUiJumpRecoveryFfaFocusFlight(");
const end=runner.indexOf("\nasync function ",start+40);
const flight=runner.slice(start,end);

test("M143 passive native witness records actual source chronology without altering or authoring input",()=>{
  const script=flight.match(/await execute\(jumpAttacker\.base, jumpAttacker\.sessionId, `([\s\S]*?)`\);/)?.[1];
  assert.ok(script);
  const handlers=new Map();
  const window={__MYASO_ACCEPTANCE_STATE__:Object.freeze({serverTick:346}),
    addEventListener(type,fn){handlers.set(type,fn);}};
  const document={hidden:false,activeElement:{id:"arena"},addEventListener(type,fn){handlers.set(type,fn);}};
  const install=runInNewContext("(function(){"+script+"})",{window,document,Date:{now:()=>1792913067070}});
  assert.equal(install(),true);
  const emit=event=>handlers.get(event.type)(Object.freeze({...event,preventDefault(){assert.fail("observer cannot consume native input");}}));
  emit({type:"pointerdown",button:0,isTrusted:true});
  emit({type:"keydown",code:"Space",isTrusted:true});
  emit({type:"keydown",code:"KeyE",isTrusted:true});
  assert.equal(window.__MYASO_M143_NATIVE_TIMELINE__.length,2);
  assert.equal(window.__MYASO_M143_NATIVE_TIMELINE__[0].serverTick,346);
  assert.equal(window.__MYASO_M143_NATIVE_TIMELINE__[1].code,"Space");
  document.hidden=true;emit({type:"visibilitychange",isTrusted:true});
  assert.equal(window.__MYASO_M143_NATIVE_TIMELINE__.at(-1).hidden,true);
  for(let index=0;index<70;index++)emit({type:"blur",isTrusted:true});
  assert.equal(window.__MYASO_M143_NATIVE_TIMELINE__.length,64);
  assert.deepEqual(window.__MYASO_ACCEPTANCE_STATE__,{serverTick:346});
});

test("M143 reports original physical, sender, replica and World evidence before untouched fatal assertions",()=>{
  const diagnostic=flight.indexOf('console.log("M143_NATIVE_SOURCE_WORLD_DIAGNOSTIC "');
  assert.ok(diagnostic>0&&diagnostic<flight.indexOf("if (punishIndex < 0 || nearestReturnIndex <= punishIndex)"));
  assert.match(flight,/actualOriginalSender: jumpState\.acceptance\?\.inputSubmissions/);
  assert.match(flight,/originalWorld: m201ServerOutput\(\)\.slice\(jumpServerLogOffset\)/);
  assert.match(flight,/geometryBefore: baseline\.map/);
  assert.match(flight,/geometryAfter: evidence\.map/);
  assert.match(flight,/performArenaPreAimedJumpAttackChord\(jumpAttacker, 90\)/);
  assert.match(flight,/Math\.abs\(spaceDowns\[0\]\.epochMs - attackDowns\[0\]\.epochMs\) > 60/);
  assert.match(flight,/windupIndex < 0 \|\| activeIndex <= windupIndex \|\| recoveryIndex <= activeIndex \|\| idleIndex <= recoveryIndex/);
  assert.doesNotMatch(flight,/dispatchEvent\(|new KeyboardEvent\(|new PointerEvent\(/);
  assert.match(runner,/scenario === "uijumprecoveryffa"[\s\S]*?\? "1" : "0"/);
});
