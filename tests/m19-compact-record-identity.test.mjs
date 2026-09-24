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
  new URL("./fixtures/m19-snapshot-varint-v1.hex", import.meta.url),
  "utf8",
).trim();
const fixture = Uint8Array.from(Buffer.from(fixtureHex, "hex"));
const legacyFixtureHex = readFileSync(new URL("./fixtures/m4-snapshot-v1.hex", import.meta.url), "utf8").trim();
const legacyFixture = Uint8Array.from(Buffer.from(legacyFixtureHex, "hex"));

function fullRecord(netId) {
  return {
    netId,
    mask: SNAPSHOT_FIELDS.FULL,
    x: 400,
    y: 800,
    facing: 16384,
    hp: 66,
    guard: 75,
    action: 1,
    flags: 2,
  };
}
test("compact snapshot matches the Rust M19 fixture", () => {
  const packet = encodeSnapshot({
    sequence: 7,
    baselineSequence: 6,
    serverTick: 1234,
    records: [fullRecord(1)],
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.VARINT_IDS,
  });
  assert.equal(Buffer.from(packet).toString("hex"), fixtureHex);

  const decoded = decodeSnapshot(fixture);
  assert.equal(decoded.encoding, SNAPSHOT_ENCODINGS.VARINT_IDS);
  assert.equal(decoded.records.length, 1);
  assert.equal(decoded.records[0].netId, 1);
  assert.equal(decoded.records[0].x, 400);
  assert.equal(decoded.records[0].action, 1);
});

test("in-place browser decoder still accepts legacy encoding zero", () => {
  const state = new Map();
  const result = applySnapshotPacketInPlace(state, legacyFixture);
  assert.equal(result.encoding, SNAPSHOT_ENCODINGS.LEGACY_U32_IDS);
  assert.equal(state.get(1).x, 100);
  assert.equal(state.get(1).hp, 66);
});

test("compact IDs round-trip uint32 varint boundaries", () => {
  const ids = [0, 127, 128, 16383, 16384, 0x0fffffff, 0xffffffff];
  const records = ids.map((netId) => ({ netId, mask: SNAPSHOT_FIELDS.REMOVED }));
  const packet = encodeSnapshot({
    sequence: 9,
    baselineSequence: 8,
    serverTick: 456,
    records,
    maxBytes: 1100,
    encoding: SNAPSHOT_ENCODINGS.VARINT_IDS,
  });
  assert.equal(packet.byteLength, 39);
  assert.deepEqual(decodeSnapshot(packet).records.map((record) => record.netId), ids);
});

function compactPacket(tail) {
  const bytes = new Uint8Array(14 + tail.length);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 1);
  view.setUint8(1, 2);
  view.setUint8(3, SNAPSHOT_ENCODINGS.VARINT_IDS);
  view.setUint16(4, 1, true);
  view.setUint16(6, 0xffff, true);
  view.setUint32(8, 1, true);
  view.setUint16(12, 1, true);
  bytes.set(tail, 14);
  return bytes;
}
test("compact decoders fail closed on unknown and malformed encodings", () => {
  const unknown = fixture.slice();
  unknown[3] = 9;
  assert.throws(() => decodeSnapshot(unknown), /unsupported snapshot encoding 9/);
  assert.throws(() => applySnapshotPacketInPlace(new Map(), unknown), /unsupported snapshot encoding 9/);

  const noncanonical = compactPacket(Uint8Array.of(0x80, 0x00, SNAPSHOT_FIELDS.REMOVED));
  assert.throws(() => decodeSnapshot(noncanonical), /non-canonical snapshot varint/);
  assert.throws(() => applySnapshotPacketInPlace(new Map(), noncanonical), /non-canonical snapshot varint/);

  const truncated = compactPacket(Uint8Array.of(0x80));
  assert.throws(() => decodeSnapshot(truncated), /snapshot record is truncated/);
  assert.throws(
    () => applySnapshotPacketInPlace(new Map(), truncated),
    /snapshot record is truncated/,
  );

  const overflow = compactPacket(Uint8Array.of(
    0xff,
    0xff,
    0xff,
    0xff,
    0x10,
    SNAPSHOT_FIELDS.REMOVED,
  ));
  assert.throws(() => decodeSnapshot(overflow), /invalid snapshot varint/);
  assert.throws(() => applySnapshotPacketInPlace(new Map(), overflow), /invalid snapshot varint/);
});
