import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createM41PhysicalInputChronology } from "../src/browser/m41-physical-input-chronology.mjs";

const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");

test("M41 genuine wheel -> callback completion -> first source0 Block -> one existing v1 invocation", () => {
  let perf = 1000, epochMs = 1793017539000;
  const chron = createM41PhysicalInputChronology({ clock: () => perf, epoch: () => epochMs });
  const physical = { deltaY: 120, timeStamp: 998, isTrusted: true };
  const token = chron.wheelStart(physical);
  perf = 1001; epochMs++;
  chron.wheelEnd(token);
  const originalInput = Object.freeze({ attack: false, block: true });
  perf = 1017; epochMs += 16;
  chron.sampled(originalInput, 248);
  perf = 1033; epochMs += 16;
  const result = chron.sendInvocation(123, originalInput);
  assert.equal(result.wheel.trusted, true);
  assert.equal(result.wheel.deltaY, 120);
  assert.equal(result.wheel.callbackLagMs, 2);
  assert.equal(result.wheel.callbackEndPerfMs, 1001);
  assert.equal(result.firstBlockSample.perfMs, 1017);
  assert.equal(result.firstBlockSample.predictionStep, 248);
  assert.equal(result.originalV1ClientTick, 123);
  assert.equal(result.originalV1SendInvocationPerfMs, 1033);
  assert.deepEqual(originalInput, { attack: false, block: true }, "observer never changes game state");
});

test("M41 observer does not fabricate Block or accept roll as a parry", () => {
  const chron = createM41PhysicalInputChronology({ clock: () => 200, epoch: () => 300 });
  assert.equal(chron.wheelStart({ deltaY: -120, isTrusted: true }), null);
  chron.sampled({ block: true }, 1);
  assert.equal(chron.sendInvocation(5, { block: true }), null);
  const token = chron.wheelStart({ deltaY: 120, isTrusted: false, timeStamp: 198 });
  chron.wheelEnd(token);
  chron.sampled({ block: false }, 2);
  assert.equal(chron.sendInvocation(6, { block: true }), null);
  chron.sampled({ block: true }, 3);
  const untrusted = chron.sendInvocation(7, { block: true });
  assert.equal(untrusted.wheel.trusted, false, "never falsify physical authenticity");
  chron.reset();
  assert.equal(chron.sendInvocation(8, { block: true }), null, "blur/reconnect cannot reuse stale wheel");
});

test("M41 source observer is scenario-scoped, read-only, and precedes the one original sender", () => {
  assert.match(source, /const m41PhysicalChronology = acceptanceScenario === "uiparrytell"/);
  assert.match(source, /m41PhysicalChronology\?\.wheelStart\(event\)/);
  assert.match(source, /m41PhysicalChronology\?\.wheelEnd\(m41WheelToken\)/);
  assert.match(source, /m41PhysicalChronology\?\.sampled\(currentInput, predictionStep \+ 1\)/);
  const start = source.indexOf("function simulatePrediction(");
  const sender = source.slice(start, source.indexOf("function ", start + 24));
  assert.ok(sender.includes("m41PhysicalChronology?.sendInvocation(outgoingTick, currentInput)"));
  assert.ok(sender.indexOf("m41PhysicalChronology?.sendInvocation") < sender.indexOf("networkClient.sendInput("));
  assert.equal((sender.match(/networkClient\.sendInput\(/g) ?? []).length, 1,
    "only the original 34-byte v1 packet writer is invoked");
  assert.match(source, /m41PhysicalChronology\?\.reset\(\)/);
});

test("M41 authentic DOM-edge source0 send never claims a fabricated 120Hz sample",()=>{
 let tick=1000;
 const chron=createM41PhysicalInputChronology({
  clock:()=>tick,epoch:()=>tick+1793000000000,
 });
 assert.equal(chron.immediateSendInvocation(4,{block:true}),null);
 chron.wheelStart({deltaY:120,timeStamp:998,isTrusted:false});
 assert.equal(chron.immediateSendInvocation(5,{block:true}),null,
  "a synthetic wheel cannot take the early sender");
 chron.wheelStart({deltaY:120,timeStamp:998,isTrusted:true});
 tick=1001;
 assert.equal(chron.immediateSendInvocation(6,{block:false}),null);
 const real=chron.immediateSendInvocation(7,{block:true});
 assert.equal(real.submissionKind,"physical-wheel-original-v1");
 assert.equal(real.originalV1ClientTick,7);
 assert.equal(real.firstBlockSample,null,
  "read-only telemetry must not invent a prediction-step event");
 assert.equal(real.wheel.trusted,true);
 chron.reset();
 assert.equal(chron.immediateSendInvocation(8,{block:true}),null,
  "blur/reconnect must erase the old physical wheel identity");
});
