// Core X1 cross-department *test-only* identity byte contract. This is a
// golden-vector oracle, NOT a new authoritative ID registry or login layer.
// Core 8B owns persistent identity; Core 8C owns transactional zone authority.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/core-x1-character-id-v1.json", import.meta.url), "utf8"));
const MAX_U128 = (1n << 128n) - 1n;
const MAX_U64 = (1n << 64n) - 1n;
const MAX_SQL_BIGINT = (1n << 63n) - 1n;
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

function requireCharacterId(raw) {
  if (!/^[0-9a-f]{32}$/.test(raw)) throw new RangeError("canonical character ID must be 32 lowercase hexadecimal digits");
  const id = BigInt("0x" + raw);
  if (id === 0n || id > MAX_U128) throw new RangeError("zero or overflowing character ID");
  return id;
}
function uintBytes(value, width, endian) {
  if (value < 0n || value >= (1n << BigInt(8 * width))) throw new RangeError("integer cannot fit");
  const bytes = new Uint8Array(width);
  for (let i = 0; i < width; i++) {
    bytes[endian === "little" ? i : width - 1 - i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return bytes;
}
function readUint(bytes, endian) {
  const ordered = endian === "little" ? Array.from(bytes).reverse() : Array.from(bytes);
  return ordered.reduce((value, digit) => value * 256n + BigInt(digit), 0n);
}
function fnv1a32(bytes) {
  let hash = 0x811c9dc5;
  for (const digit of bytes) hash = Math.imul(hash ^ digit, 0x01000193) >>> 0;
  return hash;
}
function encode8bRecord(characterId, generation) {
  if (characterId === 0n || characterId > MAX_U128 || generation < 0n || generation > MAX_U64) {
    throw new RangeError("invalid durable record");
  }
  const record = new Uint8Array(36);
  record.set([77, 89, 67, 72, 1], 0); // MYCH, version 1; zero reserved bytes 5..7
  record.set(uintBytes(characterId, 16, "little"), 8);
  record.set(uintBytes(generation, 8, "little"), 24);
  record.set(uintBytes(BigInt(fnv1a32(record.subarray(0, 32))), 4, "little"), 32);
  return record;
}
function decode8bRecord(record) {
  if (!(record instanceof Uint8Array) || record.length !== 36) throw new RangeError("invalid durable record length");
  assert.deepEqual(Array.from(record.subarray(0, 5)), [77, 89, 67, 72, 1]);
  assert.deepEqual(Array.from(record.subarray(5, 8)), [0, 0, 0]);
  if (readUint(record.subarray(32, 36), "little") !== BigInt(fnv1a32(record.subarray(0, 32)))) {
    throw new RangeError("invalid durable record checksum");
  }
  const id = readUint(record.subarray(8, 24), "little");
  if (id === 0n) throw new RangeError("invalid zero character ID");
  return { id, generation: readUint(record.subarray(24, 32), "little") };
}

test("fixture format is pinned to Core 8B MYCH v1 and Core 8C big-endian bytea", () => {
  assert.equal(fixture.schema, "core-x1-character-identity-v1");
  assert.deepEqual(fixture.record_layout, {
    magic: "MYCH", bytes: 36, version: 1, id_offset: 8, id_bytes: 16,
    id_endianness: "little", generation_offset: 24, generation_bytes: 8,
    generation_endianness: "little", checksum_offset: 32,
    checksum_algorithm: "fnv1a32", checksum_endianness: "little",
    checksum_covers_first_bytes: 32,
  });
  assert.equal(fixture.postgres_layout.id_endianness, "big");
  assert.equal(fixture.postgres_layout.id_bytes, 16);
  assert.equal(fixture.postgres_layout.kind_character, 1);
  assert.equal(fixture.postgres_layout.kind_ground_item, 2);
});

test("8B record and 8C PostgreSQL bytea represent identical 128-bit identities", () => {
  for (const vector of fixture.vectors) {
    const id = requireCharacterId(vector.character_hex);
    const generation = BigInt(vector.generation);
    const disk = encode8bRecord(id, generation);
    assert.equal(hex(disk), vector.record_hex, vector.name + " record");
    assert.equal(hex(disk.subarray(8, 24)), vector.core_record_le_id_hex);
    const sqlId = uintBytes(id, 16, "big");
    assert.equal(hex(sqlId), vector.postgres_be_hex);
    assert.equal(readUint(sqlId, "big"), id);
    assert.deepEqual(decode8bRecord(disk), { id, generation });
  }
});

test("8B little-endian bytes MUST NOT be copied verbatim into SQL bytea", () => {
  for (const vector of fixture.vectors) {
    assert.notEqual(vector.core_record_le_id_hex, vector.postgres_be_hex);
    assert.equal(
      hex(Uint8Array.from(Buffer.from(vector.core_record_le_id_hex, "hex")).reverse()),
      vector.postgres_be_hex,
    );
  }
});

test("high-half identity bits survive round-trip; legacy u64 conversion is not implicit", () => {
  const full = requireCharacterId(fixture.negative_cases.too_wide_for_legacy_u64);
  assert.ok(full > MAX_U64);
  assert.equal(readUint(uintBytes(full, 16, "big"), "big"), full);
  assert.throws(() => uintBytes(full, 8, "big"), RangeError);
  assert.throws(() => requireCharacterId(fixture.negative_cases.zero_character), RangeError);
  assert.throws(() => requireCharacterId("1"), RangeError);
  assert.throws(() => requireCharacterId("z".repeat(32)), RangeError);
});

test("damaged checksums, reserved bytes and zero identity fail closed", () => {
  const record = encode8bRecord(1n, 1n);
  const corrupt = record.slice();
  corrupt[15] ^= 0xff;
  assert.throws(() => decode8bRecord(corrupt), RangeError);
  const reserved = record.slice();
  reserved[5] = 1;
  assert.throws(() => decode8bRecord(reserved), assert.AssertionError);
  const zero = encode8bRecord(1n, 1n);
  zero.fill(0, 8, 24);
  zero.set(uintBytes(BigInt(fnv1a32(zero.subarray(0, 32))), 4, "little"), 32);
  assert.throws(() => decode8bRecord(zero), RangeError);
});

test("8C database worker, zone, epoch and revisions fit signed positive SQL bigint", () => {
  assert.equal(BigInt(fixture.postgres_layout.integer_max), MAX_SQL_BIGINT);
  const admissible = value => typeof value === "bigint" && value > 0n && value <= MAX_SQL_BIGINT;
  assert.ok(admissible(MAX_SQL_BIGINT));
  assert.ok(!admissible(BigInt(fixture.negative_cases.postgres_integer_overflow)));
  assert.ok(!admissible(BigInt(fixture.negative_cases.postgres_integer_zero)));
  assert.ok(!admissible(MAX_U64));
});
