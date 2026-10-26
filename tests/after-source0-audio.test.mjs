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

test("keyboard-first WASD never unlocks before the actual transmitted movement", () => {
  const h = harness();
  assert.equal(h.helper.noteKeyboardGesture("KeyW"), true);
  assert.equal(h.helper.afterOriginalSend({moveX:0,moveY:0}), false);
  assert.deepEqual(h.events, []);
  assert.equal(h.helper.afterOriginalSend({moveX:0,moveY:-1}), true);
  assert.deepEqual(h.events, ["schedule:50"]);
  h.run();
  assert.deepEqual(h.events, ["schedule:50", "unlock", "play:step"]);
  assert.equal(h.helper.afterOriginalSend({moveY:-1}), false, "one initial cue");
});

test("first Space produces jump only after original source0; committed jump attack favors light", () => {
  const jump = harness();
  assert.equal(jump.helper.noteKeyboardGesture("Space"), true);
  assert.equal(jump.helper.afterOriginalSend({jump:false}), false);
  assert.equal(jump.helper.afterOriginalSend({jump:true,attack:false,heavyAttack:false}), true);
  jump.run();
  assert.deepEqual(jump.events, ["schedule:50", "unlock", "play:jump"]);
  const attack = harness();
  attack.helper.noteKeyboardGesture("Space");
  assert.equal(attack.helper.afterOriginalSend({jump:true,attack:true,heavyAttack:false}), true);
  attack.run();
  assert.deepEqual(attack.events, ["schedule:50", "unlock", "play:light"]);
});

test("keyboard auto-repeat, reserved Use, and canceled startup never trigger WebAudio", () => {
  const h = harness();
  assert.equal(h.helper.noteKeyboardGesture("KeyE"), false);
  assert.equal(h.helper.noteKeyboardGesture("KeyW", true), false);
  assert.equal(h.helper.afterOriginalSend({moveY:-1}), false);
  assert.equal(h.helper.noteKeyboardGesture("KeyD"), true);
  assert.equal(h.helper.afterOriginalSend({moveX:1}), true);
  h.helper.reset();
  h.run();
  assert.deepEqual(h.events, ["schedule:50", "cancel:17"]);
});

test("source0 keyboard handler does not perform synchronous first-use WebAudio startup", async () => {
  const { readFileSync } = await import("node:fs");
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  const start = online.indexOf('canvas.addEventListener("keydown"');
  const end = online.indexOf('window.addEventListener("keyup"', start);
  assert.ok(start >= 0 && end > start);
  const keyboard = online.slice(start, end);
  assert.match(keyboard, /afterSource0Audio\?\.noteKeyboardGesture\(event\.code, event\.repeat\)/);
  assert.doesNotMatch(keyboard, /audio\.unlock\(\)/);
  assert.match(online, /networkClient\.sendInput\(\{ tick: outgoingTick, \.\.\.currentInput \}\);[\s\S]{0,230}afterSource0Audio\?\.afterOriginalSend\(currentInput\)/);
});
