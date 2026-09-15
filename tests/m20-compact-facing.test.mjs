import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decodeSnapshot,
  encodeSnapshot,
  SNAPSHOT_ENCODINGS,
  SNAPSHOT_FIELDS,
} from "../src/network/snapshot-codec.mjs";
import { applySnapshotPacketInPlace } from "../src/browser/snapshot-store.mjs";

const fixtureHex = readFileSync(
  new URL("./fixtures/m20-snapshot-u8-facing-v1.hex", import.meta.url),
  "utf8",
).trim();
const fixture = Uint8Array.from(Buffer.from(fixtureHex, "hex"));

function fullRecord(netId, facing = 16384) {
  return {
    netId,
    mask: SNAPSHOT_FIELDS.FULL,
    x: 400,
    y: 800,
    facing,
    hp: 66,
    guard: 75,
    action: 1,
    flags: 2,
  };
}

test("M20 encoding two matches the historical compact-facing fixture", () => {
  const packet = encodeSnapshot({
    sequence: 7,
    baselineSequence: 6,
    serverTick: 1234,
    records: [fullRecord(1)],
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.VARINT_IDS_U8_FACING,
  });
  assert.equal(Buffer.from(packet).toString("hex"), fixtureHex);
  assert.equal(packet.byteLength, 25);

  const decoded = decodeSnapshot(packet);
  assert.equal(decoded.encoding, SNAPSHOT_ENCODINGS.VARINT_IDS_U8_FACING);
  assert.equal(decoded.records[0].facing, 16448);
  assert.ok(Math.abs(decoded.records[0].facing - 16384) <= 128);
});

test("M20 browser hot path expands compact facing without changing other fields", () => {
  const state = new Map();
  const result = applySnapshotPacketInPlace(state, fixture);
  const entity = state.get(1);
  assert.equal(result.encoding, SNAPSHOT_ENCODINGS.VARINT_IDS_U8_FACING);
  assert.equal(entity.x, 100);
  assert.equal(entity.y, 200);
  assert.equal(entity.hp, 66);
  assert.ok(Math.abs(entity.facing - ((64 / 255) * Math.PI * 2)) < 1e-12);
});

test("M20 compact facing stays within half-step error across uint16 boundaries", () => {
  for (const facing of [0, 1, 128, 129, 16384, 32768, 65407, 65535]) {
    const packet = encodeSnapshot({
      sequence: 1,
      serverTick: 1,
      records: [{ netId: 1, mask: SNAPSHOT_FIELDS.FACING, facing }],
      maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.VARINT_IDS_U8_FACING,
    });
    const decodedFacing = decodeSnapshot(packet).records[0].facing;
    assert.equal(packet.byteLength, 17);
    assert.ok(Math.abs(decodedFacing - facing) <= 128, `${facing} -> ${decodedFacing}`);
  }
});
