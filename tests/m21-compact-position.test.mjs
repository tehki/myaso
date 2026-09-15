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
  new URL("./fixtures/m21-snapshot-u12-position-v1.hex", import.meta.url),
  "utf8",
).trim();
const fixture = Uint8Array.from(Buffer.from(fixtureHex, "hex"));

function fullRecord(overrides = {}) {
  return {
    netId: 1,
    mask: SNAPSHOT_FIELDS.FULL,
    x: 400,
    y: 800,
    facing: 16384,
    hp: 66,
    guard: 75,
    action: 1,
    flags: 2,
    ...overrides,
  };
}

test("M21 current encoding matches the compact-position fixture", () => {
  const packet = encodeSnapshot({
    sequence: 7,
    baselineSequence: 6,
    serverTick: 1234,
    records: [fullRecord()],
    maxBytes: 1100,
  });
  assert.equal(Buffer.from(packet).toString("hex"), fixtureHex);
  assert.equal(packet.byteLength, 24);
  const decoded = decodeSnapshot(packet);
  assert.equal(decoded.encoding, SNAPSHOT_ENCODINGS.VARINT_IDS_U8_FACING_U12_POSITION);
  assert.equal(decoded.records[0].x, 400);
  assert.equal(decoded.records[0].y, 800);
});

test("M21 compact positions stay within one world unit", () => {
  for (const position of [0, 1, 3, 4, 7, 8, 32759, 32763]) {
    const packet = encodeSnapshot({
      sequence: 1,
      serverTick: 1,
      records: [fullRecord({ mask: SNAPSHOT_FIELDS.POSITION, x: position, y: position })],
      maxBytes: 1100,
    });
    const decoded = decodeSnapshot(packet).records[0];
    assert.ok(Math.abs(decoded.x - position) <= 4, `${position} -> ${decoded.x}`);
    assert.ok(Math.abs(decoded.y - position) <= 4, `${position} -> ${decoded.y}`);
  }
});

test("M21 falls back to exact wide positions outside the default arena envelope", () => {
  const packet = encodeSnapshot({
    sequence: 8,
    baselineSequence: 7,
    serverTick: 1235,
    records: [fullRecord({ x: 40000 })],
    maxBytes: 1100,
  });
  const decoded = decodeSnapshot(packet);
  assert.equal(packet.byteLength, 25);
  assert.equal(decoded.records[0].mask & SNAPSHOT_FIELDS.WIDE_POSITION, SNAPSHOT_FIELDS.WIDE_POSITION);
  assert.equal(decoded.records[0].x, 40000);
  assert.equal(decoded.records[0].y, 800);

  const state = new Map();
  applySnapshotPacketInPlace(state, packet);
  assert.equal(state.get(1).x, 10000);
  assert.equal(state.get(1).y, 200);
});

test("M21 browser hot path decodes packed positions in place", () => {
  const state = new Map();
  const result = applySnapshotPacketInPlace(state, fixture);
  assert.equal(result.encoding, SNAPSHOT_ENCODINGS.CURRENT);
  assert.equal(state.get(1).x, 100);
  assert.equal(state.get(1).y, 200);
});

test("M21 rejects a wide-position marker without a position field", () => {
  const packet = new Uint8Array(encodeSnapshot({ sequence: 1, serverTick: 1, records: [fullRecord({ mask: SNAPSHOT_FIELDS.FACING })], maxBytes: 1100 }));
  packet[15] |= SNAPSHOT_FIELDS.WIDE_POSITION;
  assert.throws(() => decodeSnapshot(packet), /invalid compact-position marker/);
  assert.throws(() => applySnapshotPacketInPlace(new Map(), packet), /invalid compact-position marker/);
});
