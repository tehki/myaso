import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { COMBAT } from "../src/combat/model.mjs";
import { dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(setImmediate);

test("M194 holds genuine Chrome LMB until late trusted Firefox wheel, then releases exactly once", async () => {
  const trusted = deferred(), ack = deferred(), ceiling = deferred();
  let now = 0;
  const calls = [];
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    now: () => now,
    sleep: ms => { calls.push("ceiling:" + ms); return ceiling.promise; },
    sendAttackDown: () => { calls.push("native-down"); now = 7; },
    sendWheel: () => { calls.push("native-wheel"); return ack.promise; },
    awaitTrustedWheel: () => trusted.promise,
    sendAttackUp: () => { calls.push("native-up"); },
  });
  await tick();
  assert.deepEqual(calls, ["native-down", "ceiling:190", "native-wheel"]);
  now = 143;
  trusted.resolve({ trusted: true, deltaY: 120 });
  await tick();
  assert.deepEqual(calls, ["native-down", "ceiling:190", "native-wheel", "native-up"]);
  let complete = false;
  flight.then(() => { complete = true; });
  await tick();
  assert.equal(complete, false, "real Firefox wheel W3C ACK remains mandatory");
  now = 160; ack.resolve();
  const evidence = await flight;
  assert.equal(evidence.attackUpDispatchMs, 143);
  assert.equal(evidence.trustedWheelObservedMs, 143);
  assert.equal(evidence.clickHoldMs, 143);
  assert.equal(evidence.wheelAckMs, 160);
  assert.ok(evidence.clickHoldMs < COMBAT.heavyAttack.windupMs);
  assert.equal(calls.filter(x => x === "native-up").length, 1);
});

test("M194 missing trusted wheel fails closed before Chrome LMB release", async () => {
  const trusted = deferred(), ceiling = deferred();
  let ups = 0, now = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    now: () => now,
    sleep: ms => { assert.equal(ms, 190); return ceiling.promise; },
    sendAttackDown: () => {},
    sendWheel: () => {},
    awaitTrustedWheel: () => trusted.promise,
    sendAttackUp: () => { ups++; },
  });
  await tick();
  now = 190;
  ceiling.resolve();
  await assert.rejects(flight, /M194 trusted native wheel not delivered/);
  assert.equal(ups, 0);
});

test("M194 invalid or untrusted wheel and failed genuine W3C action never pass", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    sleep: () => new Promise(() => {}),
    sendAttackDown: () => {}, sendWheel: () => {},
    awaitTrustedWheel: () => ({ trusted: false, deltaY: 120 }),
    sendAttackUp: () => { ups++; },
  }), /trusted real Firefox/);
  assert.equal(ups, 0);
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190,
    sleep: () => new Promise(() => {}),
    sendAttackDown: () => {}, sendWheel: () => { throw Error("geckodriver wheel failure"); },
    awaitTrustedWheel: () => new Promise(() => {}),
    sendAttackUp: () => { ups++; },
  }), /geckodriver wheel failure/);
  assert.equal(ups, 0);
});

test("M194 mode is confined to its genuine guard-break scenario and preserves strict proof gates", async () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const section = runner.slice(runner.indexOf("async function runOnlineUiGuardBreakFlight("),
    runner.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.match(section, /trustedWheelWaitMs: \(wheelFirstGuardOnly \|\| m151ReleaseAnchoredGuardOnly\) \? 190 : 0/);
  assert.match(section, /awaitTrustedWheel: \(\) => challenge\.wait\(\)/);
  assert.match(section, /if \(!trustedWheelBeforeRelease\)/);
  assert.match(section, /M193 guard-break exchange/);
  assert.match(section, /defenderState\?\.playerHp !== 100/);
  assert.match(section, /defenderResult\.playerGuard !== 0/);
  assert.match(section, /M320_GUARD_BREAK_AUTH_TRACE/);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.guardDamage, 38);
  assert.equal(COMBAT.heavyAttack.windupMs, 320);
  let downCount = 0;
  for (const invalid of [-1, 280, 320, Infinity, NaN]) {
    await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
      trustedWheelWaitMs: invalid,
      sendAttackDown: () => { downCount++; }, sendWheel: () => {},
      awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
      sendAttackUp: () => {},
    }), TypeError);
  }
  assert.equal(downCount, 0);
});

test("M194 wheel-first native chronology requires trusted Firefox wheel BEFORE one real Chrome click", async () => {
  const trusted = deferred(), ack = deferred(), timeoutCeiling = deferred();
  const calls = [];
  let now = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs: 15, trustedWheelWaitMs: 190,
    now: () => now,
    sleep: ms => {
      calls.push("wait:" + ms);
      if (ms === 190) return timeoutCeiling.promise;
      now += ms;
      return Promise.resolve();
    },
    sendWheel: () => { calls.push("real-fox-wheel"); return ack.promise; },
    awaitTrustedWheel: () => trusted.promise,
    sendAttackDown: () => { calls.push("real-chrome-down"); now += 7; },
    sendAttackUp: () => { calls.push("real-chrome-up"); now += 9; },
  });
  await tick();
  assert.equal(calls.includes("real-chrome-down"), false);
  now = 15;
  trusted.resolve({ trusted: true, deltaY: 120 });
  await tick();
  assert.deepEqual(calls.filter(x => x.startsWith("real-")), [
    "real-fox-wheel", "real-chrome-down", "real-chrome-up",
  ]);
  const pending = Promise.race([flight.then(() => "complete"), tick().then(() => "still-awaiting-original-wheel-ACK")]);
  assert.equal(await pending, "still-awaiting-original-wheel-ACK");
  now = 75;
  ack.resolve();
  const receipt = await flight;
  assert.equal(receipt.wheelHeadStartMs, 15);
  assert.equal(receipt.postTrustedWheelMs, 15);
  assert.equal(receipt.attackDownDispatchMs, 30);
  assert.equal(receipt.attackUpDispatchMs, 37);
  assert.equal(receipt.clickHoldMs, 7);
  assert.ok(receipt.clickHoldMs < COMBAT.heavyAttack.windupMs);
  assert.equal(calls.filter(x => x === "real-chrome-up").length, 1);
});

test("M194 wheel-first misses native trusted wheel and aborts BEFORE Chrome LMB down", async () => {
  let downs = 0, ups = 0;
  await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs: 15, trustedWheelWaitMs: 190,
    sendWheel: () => {},
    awaitTrustedWheel: () => new Promise(() => {}),
    sendAttackDown: () => { downs++; },
    sendAttackUp: () => { ups++; },
    sleep: ms => ms === 190 ? Promise.resolve() : Promise.reject(Error("unexpected extra wait")),
  }), /wheel not delivered before wheel-first attack/);
  assert.equal(downs, 0);
  assert.equal(ups, 0);
  for (const invalid of [NaN, -1, 81, Infinity]) {
    await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
      preWheelHeadStartMs: invalid, trustedWheelWaitMs: 190,
      sendWheel: () => {}, awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
      sendAttackDown: () => { downs++; }, sendAttackUp: () => { ups++; },
    }), TypeError);
  }
  assert.equal(downs, 0);
});

test("M194 and M152 wheel-first remain unchanged; M151 uses genuine release-anchored wheel", () => {
  const runner = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const guardOnly = runner.match(/const wheelFirstGuardOnly = (\[[\s\S]*?\])\.includes\(scenario\);/);
  assert.ok(guardOnly, "only explicit native guard-only scenarios may opt in");
  assert.deepEqual(JSON.parse(guardOnly[1]), ["uiguardbreak", "uiguardbreakpunishffahit"]);
  assert.match(runner, /const m151ReleaseAnchoredGuardOnly = scenario === "uiguardbreakpunishffa"/);
  assert.match(runner, /preWheelHeadStartMs: wheelFirstGuardOnly \? 15 : 0/);
  assert.match(runner, /postTrustedWheelMs: m151ReleaseAnchoredGuardOnly \? 25 : 0/);
  assert.match(runner, /trustedWheelWaitMs: \(wheelFirstGuardOnly \|\| m151ReleaseAnchoredGuardOnly\) \? 190 : 0/);
  assert.equal(COMBAT.block.parryWindowMs, 125);
  assert.equal(COMBAT.block.shortBlockMs, 240);
  assert.equal(COMBAT.attack.guardDamage, 38);
});

test("M194 compound click starts once after trusted wheel and awaits both original command ACKs", async () => {
  const trusted=deferred(),wheelAck=deferred(),clickAck=deferred(),ceiling=deferred();
  let now=0,clicks=0,split=0;
  const flight=dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs:15,trustedWheelWaitMs:190,now:()=>now,
    sleep:ms=>ms===190?ceiling.promise:Promise.resolve(now+=ms),
    sendWheel:()=>wheelAck.promise,awaitTrustedWheel:()=>trusted.promise,
    sendAttackDown:()=>{split++;},sendAttackUp:()=>{split++;},
    sendAttackClick:()=>{clicks++;return clickAck.promise;},
  });
  await tick();assert.equal(clicks,0);
  now=20;trusted.resolve({trusted:true,deltaY:120});await tick();
  assert.equal(clicks,1);assert.equal(split,0);
  now=147;clickAck.resolve();await tick();
  assert.equal(await Promise.race([flight.then(()=>"done"),tick().then(()=>"pending")]),"pending");
  now=180;wheelAck.resolve();
  const result=await flight;
  assert.equal(result.attackClickDispatchMs,35);assert.equal(result.attackClickAckMs,147);
  assert.equal(result.wheelAckMs,180);assert.equal(result.trustedWheelObservedMs,20);
  for(const key of ["attackDownDispatchMs","attackDownAckMs","attackUpDispatchMs","attackUpAckMs","clickHoldMs"])
    assert.equal(result[key],null,"compound command ACK cannot fabricate physical edge timing");
  assert.equal(result.postTrustedWheelMs,15);
});

test("M194 compound click ACK remains mandatory even after wheel ACK", async()=>{
  const clickAck=deferred(),ceiling=deferred();let clicks=0;
  const flight=dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs:15,trustedWheelWaitMs:190,
    sleep:ms=>ms===190?ceiling.promise:Promise.resolve(),
    sendWheel:()=>{},awaitTrustedWheel:()=>({trusted:true,deltaY:120}),
    sendAttackDown:()=>assert.fail("split down"),sendAttackUp:()=>assert.fail("split up"),
    sendAttackClick:()=>{clicks++;return clickAck.promise;},
  });
  await tick();assert.equal(clicks,1);
  assert.equal(await Promise.race([flight.then(()=>"done"),tick().then(()=>"pending")]),"pending");
  clickAck.resolve();await flight;
});

test("M194 absent or untrusted wheel admits no compound click and legacy cannot opt in", async()=>{
  for(const report of [null,{trusted:false,deltaY:120},{trusted:true,deltaY:-120}]){
    let clicks=0;
    await assert.rejects(()=>dispatchR2ReleaseLedShortBlock({
      preWheelHeadStartMs:15,trustedWheelWaitMs:190,
      sleep:ms=>ms===190&&report===null?Promise.resolve():new Promise(()=>{}),
      sendWheel:()=>{},awaitTrustedWheel:()=>report===null?new Promise(()=>{}):report,
      sendAttackDown:()=>assert.fail("split down"),sendAttackUp:()=>assert.fail("split up"),
      sendAttackClick:()=>{clicks++;},
    }),/wheel/);
    assert.equal(clicks,0);
  }
  await assert.rejects(()=>dispatchR2ReleaseLedShortBlock({
    sendAttackDown:()=>{},sendAttackUp:()=>{},sendWheel:()=>{},awaitTrustedWheel:()=>{},sendAttackClick:()=>{},
  }),TypeError);
});

test("M194 compound failure waits for wheel ACK and preserves both original errors", async()=>{
  const wheelAck=deferred(),ceiling=deferred(),clickError=Error("native compound click failed"),wheelError=Error("native wheel failed");
  const flight=dispatchR2ReleaseLedShortBlock({
    preWheelHeadStartMs:15,trustedWheelWaitMs:190,
    sleep:ms=>ms===190?ceiling.promise:Promise.resolve(),
    sendWheel:()=>wheelAck.promise,awaitTrustedWheel:()=>({trusted:true,deltaY:120}),
    sendAttackDown:()=>assert.fail("split down"),sendAttackUp:()=>assert.fail("split up"),
    sendAttackClick:()=>{throw clickError;},
  });
  await tick();
  assert.equal(await Promise.race([flight.then(()=>"done",()=>"failed"),tick().then(()=>"pending")]),"pending");
  const rejected=assert.rejects(flight,error=>error instanceof AggregateError&&error.errors[0]===clickError&&error.errors[1]===wheelError);
  wheelAck.reject(wheelError);await rejected;
});

test("M151 one authentic down then trusted wheel then short release keeps strict W3C ACK", async () => {
  const trusted = deferred(), wheelAck = deferred(), releaseAck = deferred();
  const ceiling = deferred();
  const calls = [];
  let time = 0;
  const flight = dispatchR2ReleaseLedShortBlock({
    trustedWheelWaitMs: 190, postTrustedWheelMs: 25,
    now: () => time,
    sleep: ms => {
      calls.push("pause:" + ms);
      if (ms === 190) return ceiling.promise;
      time += ms;
      return Promise.resolve();
    },
    sendAttackDown: () => { calls.push("real-down"); time = 10; },
    sendWheel: () => { calls.push("real-wheel"); return wheelAck.promise; },
    awaitTrustedWheel: () => trusted.promise,
    sendAttackUp: () => { calls.push("real-up"); return releaseAck.promise; },
  });
  await tick();
  assert.deepEqual(calls.filter(x => x.startsWith("real-")), ["real-down", "real-wheel"]);
  time = 40;
  trusted.resolve({ trusted: true, deltaY: 120 });
  await tick();
  assert.deepEqual(calls.filter(x => x.startsWith("real-")),
    ["real-down", "real-wheel", "real-up"]);
  assert.ok(calls.includes("pause:25"));
  assert.equal(await Promise.race([flight.then(() => "passed"), tick().then(() => "pending")]),
    "pending", "genuine W3C release and wheel ACK are mandatory");
  releaseAck.resolve();
  await tick();
  assert.equal(await Promise.race([flight.then(() => "passed"), tick().then(() => "pending")]),
    "pending", "genuine wheel W3C ACK is still mandatory");
  time = 82;
  wheelAck.resolve();
  const result = await flight;
  assert.equal(result.postTrustedWheelMs, 25);
  assert.equal(result.attackUpDispatchMs, 65);
  assert.equal(result.clickHoldMs, 65);
  assert.equal(calls.filter(x => x === "real-up").length, 1);
});

test("M151 cannot admit untrusted or absent wheel as an accepted light", async () => {
  let upCount = 0;
  for (const report of [null, { trusted: false, deltaY: 120 },
    { trusted: true, deltaY: -120 }]) {
    await assert.rejects(() => dispatchR2ReleaseLedShortBlock({
      trustedWheelWaitMs: 190, postTrustedWheelMs: 25,
      sendAttackDown: () => {},
      sendWheel: () => {},
      awaitTrustedWheel: () => report === null
        ? Promise.reject(Error("missing genuine wheel")) : report,
      sendAttackUp: () => { upCount++; },
      sleep: ms => ms === 190 ? new Promise(() => {}) : Promise.resolve(),
    }), /wheel/);
  }
  assert.equal(upCount, 0, "never release a credited light on missing wheel");
});
