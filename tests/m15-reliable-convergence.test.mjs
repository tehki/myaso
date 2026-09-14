import test from "node:test";
import assert from "node:assert/strict";
import { createReliableSnapshotMergeState, mergeReliableSnapshotPacketInPlace } from "../web/authoritative-client.mjs";
import { encodeSnapshot, SNAPSHOT_FIELDS } from "../src/network/snapshot-codec.mjs";

function record(netId, x) {
  return {
    netId,
    mask: SNAPSHOT_FIELDS.FULL,
    x: Math.round(x * 4),
    y: 400,
    facing: 0,
    hp: 100,
    guard: 100,
    action: 0,
    flags: 0,
  };
}

function packet(serverTick, records) {
  return encodeSnapshot({ sequence: serverTick & 0xffff, serverTick, full: true, records, maxBytes: null });
}
test("reliable convergence reports only browser-visible state advances", () => {
  const state = new Map([
    [1, { netId: 1, x: 500, y: 100, facing: 0, hp: 100, guard: 100, action: 0, flags: 0, serverTick: 40 }],
    [2, { netId: 2, x: 200, y: 100, facing: 0, hp: 100, guard: 100, action: 0, flags: 0, serverTick: 10 }],
  ]);
  const reliable = createReliableSnapshotMergeState();
  reliable.knownIds.add(1); reliable.knownIds.add(2);
  const result = mergeReliableSnapshotPacketInPlace(
    state,
    reliable,
    packet(30, [record(1, 300), record(2, 330), record(3, 360)]),
  );

  assert.equal(state.get(1).x, 500);
  assert.equal(state.get(1).serverTick, 40);
  assert.equal(state.get(2).x, 330);
  assert.equal(state.get(2).serverTick, 30);
  assert.equal(state.get(3).x, 360);
  assert.deepEqual(result.advancedIds.sort((a, b) => a - b), [2, 3]);
  assert.deepEqual(result.mergedIds.sort((a, b) => a - b), [2, 3]);
});
