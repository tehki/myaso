import test from "node:test";
import assert from "node:assert/strict";
import { mergeReliableSnapshotPacketInPlace } from "../web/authoritative-client.mjs";
import { encodeSnapshot, SNAPSHOT_FIELDS } from "../src/network/snapshot-codec.mjs";

function fullRecord(netId, x) {
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

function reliablePacket(serverTick, records) {
  return encodeSnapshot({
    sequence: serverTick & 0xffff,
    serverTick,
    full: true,
    records,
    maxBytes: null,
  });
}
test("stale reliable state cannot roll back a newer realtime entity", () => {
  const state = new Map([[1, {
    netId: 1,
    x: 250,
    y: 100,
    facing: 0,
    hp: 100,
    guard: 100,
    action: 0,
    flags: 0,
    serverTick: 20,
  }]]);
  const known = new Set([1]);
  const packet = reliablePacket(10, [fullRecord(1, 100), fullRecord(2, 200)]);

  const result = mergeReliableSnapshotPacketInPlace(state, known, packet);

  assert.equal(state.get(1).x, 250);
  assert.equal(state.get(1).serverTick, 20);
  assert.equal(state.get(2).x, 200);
  assert.equal(state.get(2).serverTick, 10);
  assert.deepEqual([...known].sort((a, b) => a - b), [1, 2]);
  assert.deepEqual(result.mergedIds, [2]);
});
test("stale reliable omission is preserved until a newer reliable baseline removes it", () => {
  const state = new Map();
  const known = new Set();
  mergeReliableSnapshotPacketInPlace(
    state,
    known,
    reliablePacket(10, [fullRecord(1, 100), fullRecord(2, 200)]),
  );
  Object.assign(state.get(2), { x: 999, serverTick: 30 });

  const staleRemoval = mergeReliableSnapshotPacketInPlace(
    state,
    known,
    reliablePacket(20, [fullRecord(1, 120)]),
  );
  assert.equal(state.get(2).x, 999);
  assert.equal(staleRemoval.removedIds.length, 0);
  assert.equal(known.has(2), true);

  const freshRemoval = mergeReliableSnapshotPacketInPlace(
    state,
    known,
    reliablePacket(40, [fullRecord(1, 140)]),
  );
  assert.equal(state.has(2), false);
  assert.deepEqual(freshRemoval.removedIds, [2]);
  assert.deepEqual([...known], [1]);
});
