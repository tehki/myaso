import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createM35CueRegistry, m35PrearmedCueScript } from "../scripts/m35-prearmed-windup-cue.mjs";
import { dispatchM41ObservedParry, readM41ScalarWorldCue } from "../scripts/m41-native-observed-parry.mjs";

const light = "Attack committed - your windup is readable.";
const heavy = "Heavy strike committed - the long windup is readable.";
function observer(receipt, registry) {
  let now = 0, poll, pointer, mutation, disconnected = false;
  const timers = new Map();
  const state = {online: "Online - player #1 - server tick 100", events: [], eventTransitions: [], startedAt: 0};
  const window = {__MYASO_M30_UI__: state};
  const packets = [];
  const arena = {
    addEventListener(type, fn) { assert.equal(type, "pointerdown"); pointer = fn; },
    removeEventListener(type, fn) { if (pointer === fn) pointer = null; },
  };
  const script = "(function(){" + m35PrearmedCueScript()
    + "}).apply(null,[token,0,1,180]);";
  const armed = vm.runInNewContext(script, {
    window, token: receipt.token, document: {querySelector: () => arena},
    performance: {now: () => now},
    MutationObserver: class {
      constructor(fn) { mutation = fn; }
      observe() {}
      disconnect() { disconnected = true; }
    },
    setInterval(fn, ms) { assert.equal(ms, 4); poll = fn; return 1; },
    clearInterval() { poll = null; },
    setTimeout(fn, ms) { timers.set(2, fn); assert.equal(ms, 1500); return 2; },
    clearTimeout(id) { timers.delete(id); },
    fetch(url, options) {
      assert.equal(url, "/__myaso_m35_rendered_windup");
      const packet = JSON.parse(options.body); packets.push(packet);
      registry.receive(packet);
      return Promise.resolve();
    },
  });
  assert.equal(armed, true);
  return {
    state, window, packets,
    down(trusted = true) { pointer?.({isTrusted: trusted, button: 0}); },
    event(text) { state.events.push(text); state.eventTransitions.push({text, t: now}); },
    time(ms) { now += ms; poll?.(); },
    mutations() { if (!disconnected) mutation(); },
    get active() { return !!poll || !!pointer || timers.size > 0 || !disconnected; },
  };
}

test("prearmed M35 observes real browser cue while same-session click ACK/observer request is queued", async () => {
  const registry = createM35CueRegistry(), receipt = registry.issue(0, 1);
  const b = observer(receipt, registry);
  let finishClick, wheels = 0;
  const clickAck = new Promise(done => { finishClick = done; });
  const flight = dispatchM41ObservedParry({
    sendAttack: () => { b.down(); return clickAck; },
    awaitWorldCue: () => receipt.wait(),
    sendWheel: async () => { wheels++; },
  });
  b.event(heavy); b.time(4);
  assert.equal(wheels, 0, "M35 cannot act on transient Heavy");
  b.event(light); b.time(4);
  await new Promise(setImmediate);
  assert.equal(wheels, 1, "one real wheel may be dispatched before click ACK");
  // The old post-action observer is allowed to start only when the queued
  // action command returns; the current event can already be Active or HIT.
  b.event("Opponent hit - 34 HP.");
  assert.equal(readM41ScalarWorldCue(b.state, 0, 1), null,
    "the legacy late observer correctly rejects superseded history");
  finishClick();
  assert.equal((await flight).nativeClickAck, true);
  assert.equal(b.active, false);
  assert.equal(registry.receive(b.packets[0]), false, "single-use receipt");
  receipt.close();
});

test("M35 reads rendered Light in its mutation microtask even when polling timers stall", async () => {
  const registry = createM35CueRegistry(), receipt = registry.issue(0, 1);
  const b = observer(receipt, registry);
  b.down(); b.event(light);
  b.mutations(); // No timer callback/driver command has executed.
  const cue = await receipt.wait();
  assert.equal(cue.text, light);
  assert.equal(cue.observationLagMs, 0);
  assert.equal(b.packets.length, 1);
  b.mutations(); b.time(200);
  assert.equal(b.packets.length, 1, "one receipt, even if a timer was already queued");
  assert.equal(b.active, false);
  receipt.close();
});

test("no trusted click, foreign actor, Heavy and superseded cues never admit M35", async () => {
  const registry = createM35CueRegistry(), receipt = registry.issue(0, 1);
  const b = observer(receipt, registry);
  b.down(false); b.event(light); b.time(10);
  assert.equal(b.packets.length, 0);
  b.down();
  b.state.online = "Online - player #2 - server tick 101";
  b.event(light); b.time(10);
  assert.equal(b.packets.length, 0);
  b.state.online = "Online - player #1 - server tick 102";
  b.event(heavy); b.time(10);
  b.event(light); b.event("Strike active - committed hit window."); b.time(10);
  assert.equal(b.packets.length, 0);
  b.time(181);
  assert.equal(await receipt.wait(), null);
  assert.equal(b.window.__MYASO_M41_LAST_TIMEOUT__.timedOut, true);
  assert.equal(b.active, false);
  receipt.close();
});

test("M35 registry rejects forged roles, stale indices, Heavy, invalid time and closed tokens", async () => {
  const registry = createM35CueRegistry(), receipt = registry.issue(3, 1);
  const cue = {actorId: 1, eventIndex: 3, eventCount: 4, t: 50, text: light, latestText: light};
  for (const change of [{actorId: 2}, {eventIndex: 2}, {eventCount: 8},
    {t: NaN}, {t: -1}, {text: heavy}, {latestText: heavy}]) {
    assert.equal(registry.receive({token: receipt.token, cue: {...cue, ...change}}), false);
  }
  assert.equal(registry.receive({token: "old", cue}), false);
  assert.equal(registry.receive({token: receipt.token, cue}), true);
  assert.deepEqual(await receipt.wait(), cue);
  receipt.close();
  assert.equal(registry.receive({token: receipt.token, cue}), false);
});
