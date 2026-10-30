import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchM212AttackLedShortBlock } from "../scripts/m212-attack-led-short-block.mjs";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

test("M212 true wheel fires 48ms before one Chrome down and one up", async () => {
  const wheelLead = deferred();
  const clickHold = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    sendWheel: () => { events.push("wheel"); },
    sendAttackDown: () => { events.push("down"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: ms => {
      events.push("pause:" + ms);
      return ms === 48 ? wheelLead.promise : clickHold.promise;
    },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel", "pause:48"]);
  time = 48;
  wheelLead.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel", "pause:48", "down", "pause:10"]);
  time = 58;
  clickHold.resolve();
  const result = await flight;
  assert.deepEqual(events, ["wheel", "pause:48", "down", "pause:10", "up"]);
  assert.equal(result.wheelDispatchMs, 0);
  assert.equal(result.wheelAckMs, 0);
  assert.equal(result.attackDownDispatchMs, 48);
  assert.equal(result.attackDownAckMs, 48);
  assert.equal(result.attackUpDispatchMs, 58);
  assert.equal(result.attackUpAckMs, 58);
  assert.equal(result.wheelHeadStartMs, 48);
});

test("M212 late real Firefox ACK gates Chrome down without duplicate inputs", async () => {
  const wheel = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    sendWheel: () => { events.push("wheel"); return wheel.promise; },
    sendAttackDown: () => { events.push("down"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: ms => { events.push("pause:" + ms); if (ms === 48) time = 48; return Promise.resolve(); },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel", "pause:48"]);
  time = 120;
  wheel.resolve();
  const result = await flight;
  assert.deepEqual(events, ["wheel", "pause:48", "down", "pause:10", "up"]);
  assert.equal(result.wheelAckMs, 120);
  assert.equal(result.attackDownDispatchMs, 120);
  assert.equal(result.wheelHeadStartMs, 48);
});

test("M212 early Firefox failure prevents Chrome down/up", async () => {
  let down = 0, up = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => { throw Error("Firefox rejected"); },
    sendAttackDown: () => { down++; },
    sendAttackUp: () => { up++; },
    sleep: () => Promise.resolve(),
  }), /Firefox rejected/);
  assert.equal(down, 0);
  assert.equal(up, 0);
});

test("M212 late Firefox wheel rejection fails before any Chrome input", async () => {
  const wheel = deferred();
  const events = [];
  const flight = dispatchM212AttackLedShortBlock({
    sendWheel: () => { events.push("wheel"); return wheel.promise; },
    sendAttackDown: () => { events.push("down"); },
    sendAttackUp: () => { events.push("up"); },
    sleep: () => Promise.resolve(),
  });
  await new Promise(setImmediate);
  wheel.reject(Error("Late Firefox wheel rejected"));
  await assert.rejects(flight, /Late Firefox wheel rejected/);
  assert.deepEqual(events, ["wheel"]);
});

test("M212 Chrome down failure is fatal and never sends a mouse up", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => {},
    sendAttackDown: () => { throw Error("Chrome down failed"); },
    sendAttackUp: () => { ups++; },
    sleep: () => Promise.resolve(),
  }), /Chrome down failed/);
  assert.equal(ups, 0);
});

test("M212 Chrome release failure fails closed with one mouse up", async () => {
  let ups = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => {},
    sendAttackDown: () => {},
    sendAttackUp: () => { ups++; throw Error("Chrome up failed"); },
    sleep: () => Promise.resolve(),
  }), /Chrome up failed/);
  assert.equal(ups, 1);
});

test("M212 rejects missing W3C callbacks and unbounded input timing", async () => {
  for (const overrides of [{ sendWheel: null }, { sendAttackDown: null },
    { sendAttackUp: null }, { sleep: null }, { wheelHeadStartMs: -1 },
    { wheelHeadStartMs: Infinity }, { wheelHeadStartMs: 126 },
    { clickHoldMs: -1 }, { clickHoldMs: 101 }]) {
    await assert.rejects(() => dispatchM212AttackLedShortBlock({
      sendWheel: () => {}, sendAttackDown: () => {}, sendAttackUp: () => {},
      sleep: () => Promise.resolve(), ...overrides,
    }), TypeError);
  }
});

test("M221 runner preserves real wheel/W3C down-up and original no-parry/no-HP guards", () => {
  const source = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const segment = source.slice(source.indexOf("async function runOnlineUiGuardBreakFlight("),
    source.indexOf("async function waitForUiGuardBreakEvidence("));
  assert.ok(segment.includes("dispatchR2ReleaseLedShortBlock({"));
  assert.ok(segment.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(segment.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  const w3cClick = source.slice(source.indexOf("async function setArenaAttackButton("),
    source.indexOf("async function performArenaAttackBurst("));
  assert.ok(w3cClick.includes('pressed ? "pointerDown" : "pointerUp"'));
  assert.ok(w3cClick.includes("button: 0"));
  assert.ok(w3cClick.includes('/session/${session.sessionId}/actions'));
  // The real failure must log both W3C harness-clock ingress and Firefox/
  // Chrome-local observations BEFORE the original fatal guard assertions.
  const diagnosticsOffset = segment.indexOf('console.log("M212_GUARD_BREAK_INGRESS "');
  assert.ok(diagnosticsOffset > 0);
  assert.ok(segment.includes("wheelToImpactOrParryMs: m212Duration("));
  assert.ok(segment.includes('event.text.startsWith("Block held")'));
  assert.ok(segment.includes("end.t >= start.t"));
  assert.ok(segment.includes("genuineClickHoldMs: m212Duration("));
  assert.ok(segment.includes("harnessW3c: m212Exchange"));
  assert.ok(diagnosticsOffset < segment.indexOf("M193 guard-break exchange"));
  assert.ok(diagnosticsOffset < segment.indexOf("M34 guard-break staging allowed an unblocked strike"));
  assert.ok(segment.includes('feedbackTransitions.includes("parried")'));
  assert.ok(segment.includes("defenderState?.playerHp !== 100"));
  assert.ok(segment.includes("defenderResult.playerGuard !== 0"));
  assert.ok(segment.includes("defenderResult.playerHp !== 100"));
});


test("M221 genuine trusted Firefox event permits Chrome attack while wheel ACK is pending", async () => {
  const wheel = deferred();
  const observed = deferred();
  const pause = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    sendWheel: () => { events.push("real-wheel"); return wheel.promise; },
    awaitTrustedWheel: () => observed.promise,
    sendAttackDown: () => { events.push("real-down"); },
    sendAttackUp: () => { events.push("real-up"); },
    sleep: ms => { events.push("pause:" + ms); return ms === 30 ? pause.promise : Promise.resolve(); },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["real-wheel"]);
  time = 18;
  observed.resolve({trusted:true,deltaY:120});
  await new Promise(setImmediate);
  assert.deepEqual(events, ["real-wheel","pause:30"]);
  time = 48;
  pause.resolve();
  await new Promise(setImmediate);
  assert.ok(events.includes("real-down"));
  assert.ok(events.includes("real-up"));
  let settled = false;
  flight.then(()=>{ settled=true; });
  await new Promise(setImmediate);
  assert.equal(settled,false,"genuine W3C ACK remains mandatory for final success");
  time = 128;
  wheel.resolve();
  const result=await flight;
  assert.equal(result.wheelAckMs,128);
  assert.equal(result.attackDownDispatchMs,48);
  assert.equal(result.trustedWheelObservedMs,18);
  assert.deepEqual(events,["real-wheel","pause:30","real-down","pause:10","real-up"]);
});

test("M221 browser event receipt rejects untrusted wheel; never attacks",async()=>{
  const seen=[];
  await assert.rejects(()=>dispatchM212AttackLedShortBlock({
    sendWheel:()=>{seen.push("wheel");},
    awaitTrustedWheel:()=>({trusted:false,deltaY:120}),
    sendAttackDown:()=>{seen.push("down");},
    sendAttackUp:()=>{seen.push("up");},
    sleep:()=>Promise.resolve(),
  }),/actual trusted wheel-back/);
  assert.deepEqual(seen,["wheel"]);
});

test("M221 late WebDriver rejection remains fatal after attested genuine click",async()=>{
  const wheel=deferred();
  const events=[];
  const flight=dispatchM212AttackLedShortBlock({
    sendWheel:()=>wheel.promise,
    awaitTrustedWheel:()=>({trusted:true,deltaY:120}),
    sendAttackDown:()=>events.push("down"),
    sendAttackUp:()=>events.push("up"),
    sleep:()=>Promise.resolve(),
  });
  await new Promise(setImmediate);
  wheel.reject(Error("geckodriver rejected action"));
  await assert.rejects(flight,/geckodriver rejected action/);
  assert.ok(events.length===0 || events.join(",")==="down,up");
});

test("M221 one W3C click batch has no down-ACK to up barrier", async () => {
  const events = [];
  const result = await dispatchM212AttackLedShortBlock({
    sendWheel: () => { events.push("real-wheel"); },
    awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
    sendAttackClick: holdMs => { events.push("real-W3C-click:" + holdMs); },
    sleep: ms => { events.push("pause:" + ms); },
    now: () => 0,
  });
  assert.deepEqual(events, ["real-wheel", "pause:48", "real-W3C-click:10"]);
  assert.equal(result.attackDownAckMs, null, "no invented down ACK in single W3C batch");
  assert.equal(result.attackUpDispatchMs, null, "no invented up dispatch timestamp");
  assert.equal(result.attackUpAckMs, 0);
});

test("M221 rejected genuine W3C click batch fails closed without retry", async () => {
  let clicks = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    sendWheel: () => {},
    awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
    sendAttackClick: () => { clicks++; throw Error("Chrome W3C batch rejected"); },
    sleep: () => {},
  }), /Chrome W3C batch rejected/);
  assert.equal(clicks, 1);
});

test("M221 slow trusted wheel receipt consumes, not restarts, qualified 48ms head start", async () => {
  let elapsed = 0;
  const commands = [];
  const result = await dispatchM212AttackLedShortBlock({
    now: () => elapsed,
    sendWheel: () => { commands.push("genuine-wheel"); },
    awaitTrustedWheel: () => { elapsed = 33; return { trusted: true, deltaY: 120 }; },
    sendAttackClick: holdMs => { commands.push("genuine-W3C-click:" + holdMs); },
    sleep: ms => { commands.push("wait:" + ms); elapsed += ms; },
  });
  assert.deepEqual(commands, ["genuine-wheel", "wait:15", "genuine-W3C-click:10"]);
  assert.equal(result.trustedWheelObservedMs, 33);
  assert.equal(result.attackDownDispatchMs, 48);
  assert.equal(result.attackDownAckMs, null);
});

test("M221 receipt later than 48ms never triggers a second full wait or unauthenticated attack", async () => {
  let elapsed = 0;
  const commands = [];
  const outcome = await dispatchM212AttackLedShortBlock({
    now: () => elapsed,
    sendWheel: () => { commands.push("genuine-wheel"); },
    awaitTrustedWheel: () => { elapsed = 83; return { trusted: true, deltaY: 120 }; },
    sendAttackClick: holdMs => { commands.push("genuine-W3C-click:" + holdMs); },
    sleep: ms => { commands.push("wait:" + ms); elapsed += ms; },
  });
  assert.deepEqual(commands, ["genuine-wheel", "genuine-W3C-click:10"]);
  assert.equal(outcome.attackDownDispatchMs, 83);
  assert.equal(outcome.trustedWheelObservedMs, 83);
});

test("M221 missing trusted Firefox event cannot send Chrome click even after 48ms", async () => {
  let elapsed = 0;
  let clicks = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    now: () => elapsed,
    sendWheel: () => {},
    awaitTrustedWheel: () => { elapsed = 140; throw Error("trusted wheel absent"); },
    sendAttackClick: () => { clicks++; },
    sleep: ms => { elapsed += ms; },
  }), /trusted wheel absent/);
  assert.equal(clicks, 0);
});

test("M329 holds genuine W3C short click 45ms after trusted Firefox DOM receipt", async () => {
  let time = 0;
  const events = [];
  const outcome = await dispatchM212AttackLedShortBlock({
    now: () => time,
    wheelHeadStartMs: 0,
    postTrustedWheelMs: 45,
    sendWheel: () => { events.push("real-wheel"); },
    awaitTrustedWheel: () => {
      time = 12;
      events.push("trusted-receipt");
      return { trusted: true, deltaY: 120 };
    },
    sendAttackClick: holdMs => { events.push("real-W3C-click:" + holdMs + "@" + time); },
    sleep: ms => { events.push("wait:" + ms); time += ms; },
  });
  assert.deepEqual(events, [
    "real-wheel", "trusted-receipt", "wait:45", "real-W3C-click:10@57",
  ]);
  assert.equal(outcome.trustedWheelObservedMs, 12, "report actual DOM receipt, not delayed click time");
  assert.equal(outcome.attackDownDispatchMs, 57);
  assert.equal(outcome.postTrustedWheelMs, 45);
  assert.equal(outcome.wheelHeadStartMs, 0);
  assert.equal(outcome.attackDownAckMs, null);
  assert.equal(outcome.attackUpDispatchMs, null);
});

test("M330 slow trusted receipt consumes the extra pause instead of expiring the guard", async () => {
  for (const [receiptMs, expectedPauseMs] of [[5, 45], [12, 45], [30, 27], [70, 0], [105, 0]]) {
    let time = 0;
    const events = [];
    const outcome = await dispatchM212AttackLedShortBlock({
      now: () => time,
      wheelHeadStartMs: 0,
      postTrustedWheelMs: 45,
      sendWheel: () => { events.push("trusted-W3C-wheel-command"); },
      awaitTrustedWheel: () => {
        time = receiptMs;
        events.push("real-trusted-receipt");
        return { trusted: true, deltaY: 120 };
      },
      sendAttackClick: () => { events.push("one-real-W3C-click@" + time); },
      sleep: ms => { events.push("wait:" + ms); time += ms; },
    });
    const expected = ["trusted-W3C-wheel-command", "real-trusted-receipt"];
    if (expectedPauseMs > 0) expected.push("wait:" + expectedPauseMs);
    expected.push("one-real-W3C-click@" + (receiptMs + expectedPauseMs));
    assert.deepEqual(events, expected);
    assert.equal(outcome.trustedWheelObservedMs, receiptMs);
    assert.equal(outcome.attackDownDispatchMs, receiptMs + expectedPauseMs);
    assert.equal(outcome.postTrustedWheelMs, 45);
  }
});

test("M330 rejects missing trusted receipt even when slow-wheel compensation is enabled", async () => {
  let clicks = 0;
  await assert.rejects(() => dispatchM212AttackLedShortBlock({
    wheelHeadStartMs: 0,
    postTrustedWheelMs: 45,
    sendWheel: () => {},
    awaitTrustedWheel: () => { throw Error("missing trusted real wheel"); },
    sendAttackClick: () => { clicks++; },
    sleep: () => {},
  }), /missing trusted real wheel/);
  assert.equal(clicks, 0);
});

test("M329 rejects unbounded post-trusted receipt time without sending W3C input", async () => {
  let wheel = 0, click = 0;
  for (const delay of [-1, 61, Infinity, NaN]) {
    await assert.rejects(() => dispatchM212AttackLedShortBlock({
      postTrustedWheelMs: delay,
      sendWheel: () => { wheel++; },
      awaitTrustedWheel: () => ({ trusted: true, deltaY: 120 }),
      sendAttackClick: () => { click++; },
      sleep: () => {},
    }), TypeError);
  }
  assert.equal(wheel, 0);
  assert.equal(click, 0);
});

test("M249 R1 zero fixed head start still gates the only genuine click on trusted wheel event", async () => {
  const wheelAck = deferred(), trustedWheel = deferred();
  const events = [];
  let time = 0;
  const flight = dispatchM212AttackLedShortBlock({
    now: () => time,
    wheelHeadStartMs: 0,
    sendWheel: () => { events.push("wheel-start"); return wheelAck.promise; },
    awaitTrustedWheel: () => trustedWheel.promise,
    sendAttackClick: ms => { events.push("real-click:" + ms); },
    sleep: ms => { events.push("sleep:" + ms); },
  });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel-start"]);
  time = 21;
  trustedWheel.resolve({ trusted: true, deltaY: 120 });
  await new Promise(setImmediate);
  assert.deepEqual(events, ["wheel-start", "real-click:10"]);
  let completed = false;
  flight.then(() => { completed = true; });
  await new Promise(setImmediate);
  assert.equal(completed, false, "wheel W3C ACK remains a final success prerequisite");
  time = 49;
  wheelAck.resolve();
  const proof = await flight;
  assert.equal(proof.wheelHeadStartMs, 0);
  assert.equal(proof.trustedWheelObservedMs, 21);
  assert.equal(proof.attackDownDispatchMs, 21);
  assert.equal(proof.wheelAckMs, 49);
  assert.equal(proof.attackDownAckMs, null);
  assert.equal(proof.attackUpDispatchMs, null);
  assert.deepEqual(events, ["wheel-start", "real-click:10"]);
});

test("M325 runner uses a bounded real-wheel head start and preserves strict fail-closed guards", () => {
  const s = readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs", import.meta.url), "utf8");
  const begin = s.indexOf("async function runOnlineUiGuardBreakFlight(");
  const end = s.indexOf("async function waitForUiGuardBreakEvidence(", begin);
  assert.ok(begin >= 0 && end > begin);
  const flight = s.slice(begin, end);
  const scheduling = flight.indexOf("m212Exchange = await dispatchR2ReleaseLedShortBlock({");
  assert.ok(scheduling > 0);
  // Scope to the genuine dispatch call, not an arbitrary character count:
  // original first-red notes can grow without hiding unchanged W3C gates.
  const options = flight.slice(scheduling, flight.indexOf("\n      } finally {", scheduling));
  assert.ok(options.includes("awaitTrustedWheel: () => challenge.wait()"));
  assert.ok(options.includes("sendAttackDown: () => setArenaAttackButton(attacker, true)"));
  assert.ok(options.includes("awaitTrustedWheel: () => challenge.wait()"));
  assert.ok(options.includes("sendWheel: () => scrollArenaWheel(defender, defenderElementId, 120, 0)"));
  assert.ok(options.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  assert.ok(flight.includes('defenderState?.playerHp !== 100'));
  assert.ok(flight.includes('feedbackTransitions.includes("parried")'));
  assert.ok(flight.includes('defenderResult.playerGuard !== 0'));
  assert.ok(flight.includes('defenderResult.playerHp !== 100'));
  assert.ok(flight.includes('console.log("M212_GUARD_BREAK_INGRESS "'));
});


// R2 acceptance requires genuine DOWN, Firefox wheel, Chrome UP, both
// subsequent attestation and W3C ACK, and native DOM event ordering.
import { dispatchR2ReleaseLedShortBlock } from "../scripts/r2-release-led-short-block.mjs";

test("R2 fast trusted wheel releases real held LMB then waits for wheel ACK", async () => {
  const wheel=deferred(),trusted=deferred();
  const events=[];
  let time=0;
  const flight=dispatchR2ReleaseLedShortBlock({
    now:()=>time,
    sleep:ms=>{events.push("timer:"+ms);return new Promise(()=>{});},
    sendAttackDown:()=>{events.push("native-down");time=5;},
    sendWheel:()=>{events.push("native-wheel");return wheel.promise;},
    awaitTrustedWheel:()=>trusted.promise,
    sendAttackUp:()=>{events.push("native-up");time=23;},
  });
  await new Promise(setImmediate);
  assert.deepEqual(events,["native-down","timer:100","native-wheel"]);
  time=18;
  trusted.resolve({trusted:true,deltaY:120});
  await new Promise(setImmediate);
  assert.deepEqual(events,["native-down","timer:100","native-wheel","native-up"]);
  let settled=false;
  flight.then(()=>{settled=true;});
  await new Promise(setImmediate);
  assert.equal(settled,false,"W3C wheel ACK is still mandatory");
  time=39;
  wheel.resolve();
  const proof=await flight;
  assert.equal(proof.attackUpDispatchMs,18);
  assert.equal(proof.trustedWheelObservedMs,18);
  assert.equal(proof.wheelAckMs,39);
  assert.equal(proof.clickHoldMs,18);
});

test("R2 delayed receipt never stretches a real held LMB past bounded 100ms grace", async()=>{
  const wheel=deferred(), trusted=deferred(),timer=deferred();
  const events=[]; let time=0;
  const flight=dispatchR2ReleaseLedShortBlock({
    now:()=>time,
    sleep:ms=>{events.push("grace:"+ms);return timer.promise;},
    sendAttackDown:()=>{events.push("down");time=5;},
    sendWheel:()=>{events.push("wheel");return wheel.promise;},
    awaitTrustedWheel:()=>trusted.promise,
    sendAttackUp:()=>{events.push("up");time=115;},
  });
  await new Promise(setImmediate);
  assert.deepEqual(events,["down","grace:100","wheel"]);
  time=105;
  timer.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(events,["down","grace:100","wheel","up"]);
  let settled=false;
  flight.then(()=>{settled=true;});
  await new Promise(setImmediate);
  assert.equal(settled,false,"late real Firefox receipt must still be validated");
  time=255; trusted.resolve({trusted:true,deltaY:120});
  await new Promise(setImmediate);
  time=271; wheel.resolve();
  const proof=await flight;
  assert.equal(proof.attackUpDispatchMs,105);
  assert.equal(proof.trustedWheelObservedMs,255);
  assert.equal(proof.wheelAckMs,271);
  assert.equal(proof.clickHoldMs,105);
});

test("R2 genuine 59ms wheel attestation wins before 100ms grace and releases once",async()=>{
  const trusted=deferred(),wheel=deferred(),timer=deferred();
  const events=[]; let time=0;
  const flight=dispatchR2ReleaseLedShortBlock({
    now:()=>time,
    sleep:ms=>{events.push("grace:"+ms);return timer.promise;},
    sendAttackDown:()=>{events.push("down");time=5;},
    sendWheel:()=>{events.push("wheel");return wheel.promise;},
    awaitTrustedWheel:()=>trusted.promise,
    sendAttackUp:()=>{events.push("up");},
  });
  await new Promise(setImmediate);
  assert.deepEqual(events,["down","grace:100","wheel"]);
  time=59;
  trusted.resolve({trusted:true,deltaY:120});
  await new Promise(setImmediate);
  assert.deepEqual(events,["down","grace:100","wheel","up"]);
  // The still-unresolved timeout must not issue an extra release.
  time=100;timer.resolve();
  await new Promise(setImmediate);
  assert.equal(events.filter(x=>x==="up").length,1);
  time=105;wheel.resolve();
  const evidence=await flight;
  assert.equal(evidence.attackUpDispatchMs,59);
  assert.equal(evidence.trustedWheelObservedMs,59);
  assert.equal(evidence.wheelAckMs,105);
});

test("R2 145ms wheel attestation cannot delay light past the 100ms block-window grace", async () => {
  const trusted=deferred(), wheel=deferred(), timer=deferred();
  const events=[]; let time=0;
  const flight=dispatchR2ReleaseLedShortBlock({
    now:()=>time,
    sleep:ms=>{events.push("grace:"+ms);return timer.promise;},
    sendAttackDown:()=>{events.push("down");time=5;},
    sendWheel:()=>{events.push("wheel");return wheel.promise;},
    awaitTrustedWheel:()=>trusted.promise,
    sendAttackUp:()=>{events.push("up");},
  });
  await new Promise(setImmediate);
  assert.deepEqual(events,["down","grace:100","wheel"]);
  time=100; timer.resolve();
  await new Promise(setImmediate);
  assert.deepEqual(events,["down","grace:100","wheel","up"]);
  let settled=false;
  flight.then(()=>{settled=true;});
  await new Promise(setImmediate);
  assert.equal(settled,false,"trusted DOM attestation must still arrive before acceptance");
  time=145; trusted.resolve({trusted:true,deltaY:120});
  await new Promise(setImmediate);
  assert.equal(events.filter(e=>e==="up").length,1);
  time=170; wheel.resolve();
  const result=await flight;
  assert.equal(result.trustedWheelObservedMs,145);
  assert.equal(result.attackUpDispatchMs,100);
  assert.equal(result.clickHoldMs,100);
  assert.equal(result.wheelAckMs,170);
  assert.equal(result.receiptGraceMs,100);
});

test("R2 invalid early trusted Firefox wheel fails before native mouseUP",async()=>{
  let ups=0;
  await assert.rejects(()=>dispatchR2ReleaseLedShortBlock({
    sleep:()=>new Promise(()=>{}),
    sendAttackDown:()=>{},
    sendWheel:()=>{},
    awaitTrustedWheel:()=>({trusted:false,deltaY:120}),
    sendAttackUp:()=>{ups++;},
  }),/trusted real Firefox/);
  assert.equal(ups,0);
});

test("R2 missing late attestation cannot pass even after a bounded native release",async()=>{
  const trusted=deferred();let ups=0;
  const run=dispatchR2ReleaseLedShortBlock({
    sleep:()=>Promise.resolve(),
    sendAttackDown:()=>{},
    sendWheel:()=>{},
    awaitTrustedWheel:()=>trusted.promise,
    sendAttackUp:()=>{ups++;},
  });
  await new Promise(setImmediate);
  assert.equal(ups,1);
  trusted.reject(Error("wheel receipt missing"));
  await assert.rejects(run,/wheel receipt missing/);
});

test("R2 refuses any held native release past the server charge budget",async()=>{
  let time=0,ups=0;
  await assert.rejects(()=>dispatchR2ReleaseLedShortBlock({
    now:()=>time,
    sleep:()=>{time=320;return Promise.resolve();},
    sendAttackDown:()=>{time=5;},
    sendWheel:()=>{},
    awaitTrustedWheel:()=>new Promise(()=>{}),
    sendAttackUp:()=>{ups++;},
  }),/exceeded light-charge budget/);
  assert.equal(ups,0);
});

test("R2 real wheel transport failure is fatal before LMB release",async()=>{
  let ups=0;
  await assert.rejects(()=>dispatchR2ReleaseLedShortBlock({
    sleep:()=>new Promise(()=>{}),
    sendAttackDown:()=>{},
    sendWheel:()=>Promise.reject(Error("wheel transport rejected")),
    awaitTrustedWheel:()=>new Promise(()=>{}),
    sendAttackUp:()=>{ups++;},
  }),/wheel transport rejected/);
  assert.equal(ups,0);
});

test("R2 native acceptance validates trusted wheel epoch preceding Chrome UP and strict HP/guard/parry",()=>{
  const runner=readFileSync(new URL("../scripts/pvp_browser_flight_runner.mjs",import.meta.url),"utf8");
  const begin=runner.indexOf("async function runOnlineUiGuardBreakFlight(");
  const end=runner.indexOf("\nasync function runOnlineUiGuardBreakTellFlight(",begin);
  const section=runner.slice(begin,end);
  assert.ok(section.includes("m212FirefoxWheel.epochMs <= m212ChromeUp.epochMs"));
  assert.ok(section.includes("if (!trustedWheelBeforeRelease)"));
  assert.ok(section.includes("M334 trusted Firefox wheel did not precede"));
  assert.ok(section.includes("defenderState?.playerHp !== 100"));
  assert.ok(section.includes('feedbackTransitions.includes("parried")'));
  assert.ok(section.includes("defenderResult.playerGuard !== 0"));
  assert.ok(section.includes("defenderResult.playerHp !== 100"));
  assert.ok(section.includes("sendAttackUp: () => setArenaAttackButton(attacker, false)"));
  assert.ok(section.includes("awaitTrustedWheel: () => challenge.wait()"));
});
