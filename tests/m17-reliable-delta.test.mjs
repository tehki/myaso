import test from "node:test";
import assert from "node:assert/strict";
import { createReliableSnapshotMergeState, mergeReliableSnapshotPacketInPlace } from "../web/authoritative-client.mjs";
import { encodeSnapshot, SNAPSHOT_FIELDS } from "../src/network/snapshot-codec.mjs";

function fullRecord(netId, x, facing = 0) {
  return {
    netId,
    mask: SNAPSHOT_FIELDS.FULL,
    x: Math.round(x * 4),
    y: 400,
    facing,
    hp: 100,
    guard: 100,
    action: 0,
    flags: 0,
  };
}

function fullPacket(sequence, serverTick, records) {
  return encodeSnapshot({ sequence, serverTick, full: true, records, maxBytes: null });
}

function deltaPacket(sequence, baselineSequence, serverTick, records) {
  return encodeSnapshot({ sequence, baselineSequence, serverTick, full: false, records, maxBytes: null });
}

test("reliable delta updates only carried fields and preserves newer untouched realtime fields", () => {
  const state = new Map();
  const reliable = createReliableSnapshotMergeState();
  mergeReliableSnapshotPacketInPlace(
    state,
    reliable,
    fullPacket(10, 10, [fullRecord(1, 100, 1000)]),
  );
  Object.assign(state.get(1), { x: 250, serverTick: 20 });

  const delta = deltaPacket(11, 10, 30, [{
    netId: 1,
    mask: SNAPSHOT_FIELDS.FACING,
    facing: 32000,
  }]);
  const result = mergeReliableSnapshotPacketInPlace(state, reliable, delta);

  assert.equal(state.get(1).x, 250);
  assert.equal(state.get(1).serverTick, 30);
  assert.notEqual(state.get(1).facing, 1000);
  assert.deepEqual(result.advancedIds, [1]);
  assert.equal(reliable.sequence, 11);
});

test("reliable delta chain fails closed on a mismatched baseline", () => {
  const state = new Map();
  const reliable = createReliableSnapshotMergeState();
  mergeReliableSnapshotPacketInPlace(
    state,
    reliable,
    fullPacket(20, 20, [fullRecord(1, 100)]),
  );

  const bad = deltaPacket(21, 19, 30, [{
    netId: 1,
    mask: SNAPSHOT_FIELDS.FACING,
    facing: 1234,
  }]);
  assert.throws(
    () => mergeReliableSnapshotPacketInPlace(state, reliable, bad),
    /does not match/,
  );
  assert.equal(reliable.sequence, 20);
  assert.equal(state.get(1).serverTick, 20);
});
