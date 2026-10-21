import test from "node:test";
import assert from "node:assert/strict";
import { observeM161NativeKnockdown } from "../scripts/m161-native-knockdown-observation.mjs";

const knockdown = { action: 19, epochMs: 850, serverTick: 331 };
const matches = event => event.action === 19 && Number.isFinite(event.epochMs)
  && Number.isSafeInteger(event.serverTick);

test("M161 polls victim during native input and returns only real own knockdown", async () => {
  let clock = 0;
  let reads = 0;
  let nativeAck = false;
  const captured = await observeM161NativeKnockdown({
    startIndex: 1, isKnockdown: matches, deadlineEpochMs: 100,
    now: () => clock,
    sleep: async () => { clock += 12; },
    readOwnActions: async () => {
      reads++;
      assert.equal(nativeAck, false, "observation must not wait for native ACK");
      return reads < 3
        ? [{ action: 0, epochMs: 1, serverTick: 1 }]
        : [{ action: 0, epochMs: 1, serverTick: 1 }, knockdown];
    },
  });
  assert.deepEqual(captured, knockdown);
  assert.equal(reads, 3);
});

test("M161 cannot promote old, peer, malformed or absent action into victim knockdown", async () => {
  let clock = 0;
  const result = await observeM161NativeKnockdown({
    startIndex: 1, isKnockdown: matches, deadlineEpochMs: 36,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    readOwnActions: async () => [
      knockdown, // old offset-0 transition must be ignored
      { action: 12, epochMs: 860, serverTick: 332 },
      { action: 19, epochMs: 862, serverTick: "not-a-tick" },
    ],
  });
  assert.equal(result, null);
  assert.equal(clock, 36);
});

test("M161 bounded victim reader respects stop without creating synthetic evidence", async () => {
  let reads = 0;
  const result = await observeM161NativeKnockdown({
    startIndex: 0, isKnockdown: matches, deadlineEpochMs: 100,
    now: () => 0,
    shouldStop: () => reads > 0,
    sleep: async () => { throw Error("must stop before sleeping"); },
    readOwnActions: async () => { reads++; return []; },
  });
  assert.equal(result, null);
  assert.equal(reads, 1);
});

test("M161 rejects invalid observers and propagates victim browser read errors", async () => {
  await assert.rejects(() => observeM161NativeKnockdown({
    readOwnActions: async () => [], startIndex: -1, isKnockdown: matches,
    deadlineEpochMs: 10, sleep: async () => {},
  }), /bounded real victim reads/);
  await assert.rejects(() => observeM161NativeKnockdown({
    readOwnActions: async () => { throw Error("Firefox executor stalled"); },
    startIndex: 0, isKnockdown: matches, deadlineEpochMs: 10,
    now: () => 0, sleep: async () => {},
  }), /Firefox executor stalled/);
});
