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

test("legacy M33 uiparry records trusted physical wheel and original source0 without changing the sender", () => {
  // M176 protected quality runs the legacy uiparry path (not uiparrytell).
  // It must expose the SAME optional read-only provenance when a genuine
  // short-click parry fails closed with original World damage.
  const setup = source.slice(source.indexOf("const m41PhysicalChronology ="),
    source.indexOf("installGameAudioControls(audio);"));
  assert.match(setup, /acceptanceScenario === "uiparry"/,
    "physical wheel observer must be active in the original legacy uiparry flight");
  const recorder = source.slice(source.indexOf("function recordAcceptanceState("),
    source.indexOf("const acceptance = window.__MYASO_ACCEPTANCE_STATE__", source.indexOf("function recordAcceptanceState(")));
  assert.match(recorder, /"uiparry"/,
    "legacy uiparry must publish a bounded acceptance snapshot for native failure logs");
  const sender = source.slice(source.indexOf("function simulatePrediction("),
    source.indexOf("function ", source.indexOf("function simulatePrediction(") + 24));
  assert.match(sender, /const m41InputProbe =[\s\S]*?acceptanceScenario === "uiparry"/,
    "record only actual block samples that pass through the original writer");
  assert.ok(sender.indexOf("m41PhysicalChronology?.sendInvocation") < sender.indexOf("networkClient.sendInput("));
  assert.equal((sender.match(/networkClient\.sendInput\(/g) ?? []).length, 1,
    "legacy acceptance never installs a second source0 writer");
});
