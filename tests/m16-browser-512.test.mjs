import test from "node:test";
import assert from "node:assert/strict";
import { createReliableSnapshotMergeState, mergeReliableSnapshotPacketInPlace } from "../web/authoritative-client.mjs";
import { encodeSnapshot, SNAPSHOT_FIELDS } from "../src/network/snapshot-codec.mjs";

function record(netId) {
  return {
    netId,
    mask: SNAPSHOT_FIELDS.FULL,
    x: 160 + (netId % 32) * 40,
    y: 160 + Math.floor((netId - 1) / 32) * 40,
    facing: netId & 0xffff,
    hp: 100,
    guard: 100,
    action: 0,
    flags: 0,
  };
}

test("reliable browser baseline materializes all 512 authoritative occupants", () => {
  const records = Array.from({ length: 512 }, (_, index) => record(index + 1));
  const payload = encodeSnapshot({ sequence: 91, serverTick: 91, full: true, records, maxBytes: null });
  const state = new Map();
  const reliable = createReliableSnapshotMergeState();
  const result = mergeReliableSnapshotPacketInPlace(state, reliable, payload);

  assert.equal(state.size, 512);
  assert.equal(reliable.knownIds.size, 512);
  assert.equal(result.advancedIds.length, 512);
  assert.equal(result.mergedIds.length, 512);
  assert.equal(state.get(1).serverTick, 91);
  assert.equal(state.get(512).serverTick, 91);
});
