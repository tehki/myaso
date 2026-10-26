import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createGameAudio, createRemoteActionAudioTracker, soundForCombatFeedback,
} from "../src/browser/game-audio.mjs";

class Param {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class Node {
  connect() { return this; }
  disconnect() {}
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.destination = new Node();
    this.oscillators = 0;
    FakeAudioContext.instances.push(this);
  }
  createGain() { return Object.assign(new Node(), { gain: new Param() }); }
  createStereoPanner() { return Object.assign(new Node(), { pan: new Param() }); }
  createOscillator() {
    this.oscillators++;
    return Object.assign(new Node(), { frequency: new Param(), start() {}, stop() {} });
  }
  createBiquadFilter() { return Object.assign(new Node(), { frequency: new Param() }); }
  createBuffer(_channels, length) {
    const samples = new Float32Array(length);
    return { getChannelData() { return samples; } };
  }
  createBufferSource() { return Object.assign(new Node(), { start() {} }); }
  resume() { this.state = "running"; return Promise.resolve(); }
}

test("R3 browser sound stays silent before first user activation and never blocks without AudioContext", () => {
  const disabled = createGameAudio({ AudioContextImpl: null, storage: null });
  assert.equal(disabled.unlock(), false);
  assert.equal(disabled.play("light"), false);
  const audio = createGameAudio({ AudioContextImpl: FakeAudioContext, storage: null });
  assert.equal(audio.isUnlocked(), false);
  assert.equal(audio.play("light"), false, "must not autoplay");
  assert.equal(FakeAudioContext.instances.length, 0);
  assert.equal(audio.unlock(), true);
  assert.equal(audio.isUnlocked(), true);
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(audio.play("light"), true);
  assert.equal(FakeAudioContext.instances[0].oscillators, 1);
  assert.equal(audio.play("light"), false, "one cue cannot stack within one simulation tick");
  FakeAudioContext.instances[0].currentTime += .100;
  assert.equal(audio.play("light"), true);
  assert.equal(FakeAudioContext.instances[0].oscillators, 2);
});

test("R3 volume/mute persistence clamps safely and never modifies combat", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, val) => values.set(key, val) };
  const audio = createGameAudio({ AudioContextImpl: FakeAudioContext, storage });
  audio.setVolume(10);
  assert.equal(audio.getVolume(), 1);
  audio.setVolume(-5);
  assert.equal(audio.getVolume(), 0);
  audio.setVolume(.36);
  audio.setMuted(true);
  audio.unlock();
  assert.equal(audio.play("heavy"), false);
  const restored = createGameAudio({ AudioContextImpl: FakeAudioContext, storage });
  assert.equal(restored.isMuted(), true);
  assert.equal(restored.getVolume(), .36);
  restored.setMuted(false);
  restored.unlock();
  assert.equal(restored.play("heavy"), true);
  assert.equal(restored.play("unknown-cue"), false);
});

test("R3 remote sounds only emerge on nearby authoritative action transitions, once per transition", () => {
  const tracker = createRemoteActionAudioTracker();
  const own = { netId: 1, x: 0, y: 0, action: 0 };
  const remote = { netId: 2, x: 100, y: 0, action: 0 };
  const events = [];
  const emit = (cue, options) => events.push({ cue, ...options });
  tracker.observe(new Map([[1, own], [2, remote]]), 1, emit);
  assert.equal(events.length, 0, "initial replicated state is not an action onset");
  const update = (action, x = 100) => tracker.observe(
    new Map([[1, own], [2, { ...remote, action, x }]]), 1, emit);
  update(1);
  assert.equal(events.length, 1);
  assert.equal(events[0].cue, "light");
  assert.ok(events[0].level > 0 && events[0].level < 1);
  assert.ok(events[0].pan > 0);
  update(1);
  assert.equal(events.length, 1, "repeated identical snapshots are silent");
  update(3); // recovery
  update(9); // heavy onset
  assert.equal(events.at(-1).cue, "heavy");
  update(0, 1000); // out of range
  update(12, 1000);
  assert.equal(events.length, 2, "far-away actions are inaudible");
  update(0);
  update(12);
  assert.equal(events.at(-1).cue, "kick");
  tracker.reset();
  update(1);
  assert.equal(events.length, 3, "first state after reset seeds without replay");
});

test("R3 confirmed feedback maps to distinct combat sounds", () => {
  for (const [feedback, expected] of [
    ["hit-confirm", "hit"], ["damage-taken", "damage"],
    ["block-confirm", "block"], ["guard-broken", "guardbreak"],
    ["parry-success", "parry"], ["parried", "parry"],
    ["kick-confirm", "hit"], ["rolled-over", "damage"],
  ]) assert.equal(soundForCombatFeedback(feedback), expected);
  assert.equal(soundForCombatFeedback("stamina-denied"), null);
});

test("R3 shared audio is wired to both runtimes without delaying light attacks", () => {
  const html = readFileSync(new URL("../web/index.html", import.meta.url), "utf8");
  assert.match(html, /id="audio-toggle"/);
  assert.match(html, /id="audio-volume"/);
  for (const name of ["game", "online-game"]) {
    const source = readFileSync(new URL("../web/" + name + ".mjs", import.meta.url), "utf8");
    assert.match(source, /installGameAudioControls\(audio\)/);
    if (name === "online-game") {
      assert.match(source, /afterSource0Audio\.noteKeyboardGesture\(event\.code, event\.repeat\)/,
        "online keyboard-first WebAudio startup must occur after genuine source0 send");
    } else {
      assert.match(source, /audio\.unlock\(\)/, "offline audio keeps its trusted-gesture unlock");
    }
    assert.match(source, /onLight\(\) \{[\s\S]*?audio\.play\("light"\)/);
    assert.match(source, /audio\.play\("step"/);
    assert.match(source, /audio\.play\("jump"\)/);
    const lightCallback = source.slice(source.indexOf("  onLight() {"), source.indexOf("  onHeavy()"));
    assert.ok(lightCallback.indexOf('committedLightMove =') < lightCallback.indexOf('audio.play("light")'),
      "finish movement/stamina input bookkeeping before constructing WebAudio nodes");
    const pointerDown = source.slice(source.indexOf('canvas.addEventListener("pointerdown"'), source.indexOf("function onLeftPointerUp"));
    const pointerUp = source.slice(source.indexOf("function onLeftPointerUp"), source.indexOf('canvas.addEventListener("pointerup"'));
    assert.match(pointerDown, /leftButtonCharge\.press\(event\.pointerId/,
      "native pointerDOWN must still commit attack immediately");
    assert.doesNotMatch(pointerDown, /audio\.unlock\(/,
      "first-use AudioContext startup cannot postpone a native pointerUP");
    assert.match(pointerUp, /const committed = leftButtonCharge\.release\(event\.pointerId\)/,
      "release classification completes before audio startup");
    if (name === "online-game") {
      assert.doesNotMatch(pointerUp, /audio\.unlock\(/,
        "first-use WebAudio must not freeze genuine online pointerUP before source0 send");
      assert.match(pointerUp, /afterSource0Audio\?\.noteRelease\(committed\)/,
        "real first release must remain eligible for its own delayed audio");
      assert.ok(source.indexOf("networkClient.sendInput(") < source.indexOf("afterSource0Audio?.afterOriginalSend(currentInput)"),
        "the existing single QUIC writer must run before presentation initialization");
    } else {
      assert.ok(pointerUp.indexOf("leftButtonCharge.release(") < pointerUp.indexOf("audio.unlock()"),
        "offline first-use audio unlock must follow classification");
      assert.match(pointerUp, /audio\.play\(committed === "heavy" \? "heavy" : "light"\)/,
        "offline release continues to initialize and play its committed cue");
    }
  }
  const online = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(online, /remoteActionAudio\.observe/);
  assert.match(online, /soundForCombatFeedback\(feedback\)/);
});
