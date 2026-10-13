import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchM208WheelLedW3cExchange } from "../scripts/m208-w3c-wheel-headstart.mjs";

const defer = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {resolve=res; reject=rej;});
  return { promise, resolve, reject };
};
test("M208 fast genuine wheel ACK precedes exactly one Chrome LMB and keeps M203 parry pause", async () => {
  let time=0;
  const events=[];
  const result=await dispatchM208WheelLedW3cExchange({
    now:()=>time, sleep:()=>new Promise(()=>{}),
    sendWheel:()=>{events.push("wheel");time=20;},
    sendAttack:p=>{events.push("attack:"+p);},
  });
  assert.deepEqual(events,["wheel","attack:40"]);
  assert.equal(result.wheelAckBeforeAttack,true);
  assert.equal(result.wheelAckMs,20);
  assert.equal(result.pointerPauseMs,40);
});
test("M208 slow Firefox ACK cannot postpone first real Chrome attack beyond 65ms harness wait", async () => {
  const wheel=defer();
  const events=[];
  let time=0;
  const flight=dispatchM208WheelLedW3cExchange({
    now:()=>time,
    sleep:()=>{time=65;return Promise.resolve();},
    sendWheel:()=>{events.push("wheel-start");return wheel.promise;},
    sendAttack:p=>{events.push("attack:"+p);},
  });
  // Promise.race -> scheduler -> Promise.all may require several microtasks;
  // yield one actual Node loop turn rather than asserting prematurely.
  await new Promise(setImmediate);
  assert.deepEqual(events,["wheel-start","attack:0"]);
  time=130;
  wheel.resolve();
  const result=await flight;
  assert.equal(result.wheelAckBeforeAttack,false);
  assert.equal(result.chromeDispatchMs,65);
  assert.equal(result.wheelAckMs,130);
  assert.equal(result.pointerPauseMs,0);
});
test("M208 does not attack if real wheel fails before bounded ACK wait", async()=>{
  let attacks=0;
  await assert.rejects(()=>dispatchM208WheelLedW3cExchange({
    sendWheel:()=>Promise.reject(new Error("Firefox W3C failed")),
    sendAttack:()=>{attacks++;},
    sleep:()=>new Promise(()=>{}),
  }),/Firefox W3C failed/);
  assert.equal(attacks,0);
});
test("M208 does not conceal real wheel failure after attacker dispatch", async()=>{
  const wheel=defer();
  let attacks=0;
  const run=dispatchM208WheelLedW3cExchange({
    sendWheel:()=>wheel.promise,sendAttack:()=>{attacks++;},
    sleep:()=>Promise.resolve(),
  });
  for(let i=0;i<3;i++)await Promise.resolve();
  wheel.reject(new Error("late Firefox W3C failed"));
  await assert.rejects(run,/late Firefox W3C failed/);
  assert.equal(attacks,1);
});
test("M208 fails closed on invalid head-start or synthetic dispatch callbacks", async()=>{
  for(const maxWheelHeadStartMs of [-1,151,NaN,Infinity]) {
    await assert.rejects(()=>dispatchM208WheelLedW3cExchange({
      sendWheel:()=>{},sendAttack:()=>{},sleep:()=>{},
      maxWheelHeadStartMs,
    }),RangeError);
  }
});
test("M208 helper remains testable but M212 runner now uses attack-first W3C scheduling",()=>{
  const source=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const segment=source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(segment.includes("dispatchM212AttackLedShortBlock({"));
  assert.ok(segment.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(segment.includes("attacker, m198Plan.clicksPerWheel, 0"));
  assert.ok(segment.includes("feedbackTransitions.includes(\"parried\")"));
  assert.ok(segment.includes("defenderState?.playerHp !== 100"));
  assert.ok(segment.includes("defenderResult.playerGuard !== 0"));
  assert.ok(segment.includes("defenderResult.playerHp !== 100"));
});
