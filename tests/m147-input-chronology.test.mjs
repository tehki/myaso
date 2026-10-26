import test from "node:test";
import assert from "node:assert/strict";
import { createM147InputChronology } from "../src/browser/m147-input-chronology.mjs";

test("trusted real pointer UP -> synchronous Light -> first sample -> v1 sender is read-only and timed", () => {
  let t = 36;
  const p = createM147InputChronology({ clock: () => t, epoch: () => 1000 + t });
  p.pointerUp({ button: 0, isTrusted: true, pointerId: 7, timeStamp: 12 });
  t = 37;
  p.releaseInvocation();
  p.onLight();
  p.release("light");
  t = 43;
  p.raf(43);
  p.sampled({ attack: true, heavyAttack: false }, 2);
  p.sampled({ attack: true, heavyAttack: false }, 3);
  t = 44;
  p.sendInput({ attack: true, heavyAttack: false }, 77);
  assert.deepEqual(p.events.map(e => e.stage), [
    "pointerup-handler-entry", "charge-release-invocation", "onLight-callback", "charge-release-return",
    "raf-entry", "first-prediction-sample", "original-sendInput-invocation",
  ]);
  assert.equal(p.events[0].callbackLagMs, 24);
  assert.equal(p.events[0].trusted, true);
  assert.equal(p.events[5].predictionStep, 2);
  assert.equal(p.events[6].clientTick, 77);
  assert.equal(p.events[6].heavyAttack, false);
  t = 60;
  p.raf(60);
  p.sendInput({ attack: false }, 78);
  assert.equal(p.events.length, 7);
});

test("bounded frames expose stalls without inventing input", () => {
  let t = 1;
  const p = createM147InputChronology({ clock: () => t, epoch: () => t, maxEvents: 4 });
  p.raf(1);
  p.pointerUp({isTrusted: false, pointerId: 3, timeStamp: 40});
  assert.equal(p.events[0].callbackLagMs, null);
  p.onLight();
  t = 201;
  p.raf(201);
  assert.equal(p.events.at(-1).frameGapMs, 200);
  p.sampled({attack:true}, 12);
  p.sendInput({attack:true}, 12);
  assert.equal(p.events.length, 4);
  assert.equal(p.events.at(-1).clientTick, 12);
  assert.throws(() => createM147InputChronology({maxEvents:257}), RangeError);
});
