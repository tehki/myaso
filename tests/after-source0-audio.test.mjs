import test from "node:test";
import assert from "node:assert/strict";
import { createAfterSource0Audio } from "../src/browser/after-source0-audio.mjs";

function harness() {
  const events = [];
  let pending = null;
  let unlocked = false;
  const audio = {
    isUnlocked: () => unlocked,
    unlock() { events.push("unlock"); unlocked = true; },
    play(name) { events.push("play:" + name); },
  };
  const helper = createAfterSource0Audio({
    audio,
    schedule(task, ms) { pending = task; events.push("schedule:" + ms); return 17; },
    cancel(token) { events.push("cancel:" + token); pending = null; },
  });
  return { helper, events, run: () => { const fn = pending; pending = null; fn?.(); } };
}

test("initial genuine released Light is sent before audio unlock; held sample cannot qualify", () => {
  const h = harness();
  assert.equal(h.helper.noteRelease("light"), true);
  assert.equal(h.helper.afterOriginalSend({attack:true,heavyAttack:true}), false);
  assert.deepEqual(h.events, [], "held 34-byte source0 charge must not warm audio");
  assert.equal(h.helper.afterOriginalSend({attack:true,heavyAttack:false}), true);
  assert.deepEqual(h.events, ["schedule:50"]);
  h.run();
  assert.deepEqual(h.events, ["schedule:50", "unlock", "play:light"]);
  assert.equal(h.helper.afterOriginalSend({attack:true,heavyAttack:false}), false);
});
test("heavy release and immediate committed Light preserve first cue classification", () => {
  const heavy = harness();
  heavy.helper.noteRelease("heavy");
  assert.equal(heavy.helper.afterOriginalSend({attack:true,heavyAttack:true}), false);
  assert.equal(heavy.helper.afterOriginalSend({attack:false,heavyAttack:true}), true);
  heavy.run();
  assert.deepEqual(heavy.events, ["schedule:50", "unlock", "play:heavy"]);
  const immediate = harness();
  immediate.helper.noteRelease("committed");
  assert.equal(immediate.helper.afterOriginalSend({attack:false,heavyAttack:false}), true);
  immediate.run();
  assert.deepEqual(immediate.events, ["schedule:50", "unlock", "play:light"]);
});
test("focus loss retires pending or scheduled first-release audio", () => {
  const h = harness();
  h.helper.noteRelease("light");
  h.helper.reset();
  assert.equal(h.helper.afterOriginalSend({attack:true,heavyAttack:false}), false);
  h.helper.noteRelease("light");
  h.helper.afterOriginalSend({attack:true,heavyAttack:false});
  h.helper.reset();
  assert.deepEqual(h.events, ["schedule:50", "cancel:17"]);
  h.run();
  assert.deepEqual(h.events, ["schedule:50", "cancel:17"]);
});
test("invalid input and audio objects fail closed", () => {
  assert.throws(() => createAfterSource0Audio(), TypeError);
  assert.throws(() => createAfterSource0Audio({audio:{unlock(){},isUnlocked(){},play(){}},delayMs:-1}),RangeError);
  const h = harness();
  assert.equal(h.helper.noteRelease(null), false);
  assert.equal(h.helper.afterOriginalSend({attack:true,heavyAttack:false}), false);
});
