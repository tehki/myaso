import test from "node:test";
import assert from "node:assert/strict";
import { createInputSendClock } from "../src/browser/input-send-clock.mjs";
import { encodeInputPacket, decodeInputPacket } from "../src/network/input-codec.mjs";

function scheduler() {
  let clock = 0, serial = 0;
  const jobs = new Map();
  return {
    jobs,
    schedule(callback, delay) { const id = ++serial; jobs.set(id, { callback, at: clock + delay }); return id; },
    cancel(id) { jobs.delete(id); },
    wakeAt(time) {
      clock = time;
      const due = [...jobs].filter(([, job]) => job.at <= clock);
      for (const [id, job] of due) { jobs.delete(id); job.callback(); }
    },
  };
}

test("committed jump chord reaches the real input codec while no render frames run", () => {
  const timers = scheduler();
  let tick = 100;
  let requested = { attack: true, jump: true };
  const packets = [];
  const clock = createInputSendClock({
    ...timers, shouldSend: () => true,
    send() {
      packets.push(decodeInputPacket(encodeInputPacket({
        sequence: tick, clientTick: tick, ackSnapshotSequence: 0xffff,
        ackServerTick: 0, samples: [{ tick, ...requested }],
      })));
      tick++;
      requested = {};
    },
  });
  clock.start();
  timers.wakeAt(17);
  timers.wakeAt(34);
  assert.equal(packets.length, 2);
  assert.equal(packets[0].samples[0].attack, true);
  assert.equal(packets[0].samples[0].jump, true);
  assert.equal(packets[1].samples[0].attack, false);
  assert.equal(packets[1].samples[0].jump, false);
  clock.stop();
});

test("a late timer emits one fresh sample, never render-style catch-up packets", () => {
  const timers = scheduler();
  let sent = 0;
  const clock = createInputSendClock({ ...timers, send: () => sent++, shouldSend: () => true });
  clock.start();
  clock.start();
  timers.wakeAt(180);
  assert.equal(sent, 1);
  assert.equal(timers.jobs.size, 1);
  timers.wakeAt(181);
  assert.equal(sent, 1);
  timers.wakeAt(197);
  assert.equal(sent, 2);
  clock.stop();
});

test("hidden and stopped input clocks send no actions or stale callback work", () => {
  const timers = scheduler();
  let visible = false, sent = 0;
  const clock = createInputSendClock({ ...timers, send: () => sent++, shouldSend: () => visible });
  clock.start();
  const stale = [...timers.jobs.values()][0].callback;
  timers.wakeAt(17);
  assert.equal(sent, 0);
  clock.stop();
  visible = true;
  stale();
  assert.equal(sent, 0);
  assert.equal(timers.jobs.size, 0);
  clock.start();
  stale();
  assert.equal(sent, 0, "a previous visibility generation cannot send after restart");
  assert.equal(timers.jobs.size, 1);
  timers.wakeAt(34);
  assert.equal(sent, 1);
  clock.stop();
});
