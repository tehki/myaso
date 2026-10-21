import assert from "node:assert/strict";
import test from "node:test";
import { createMagicParticlePool } from "../src/browser/magic-particle-pool.mjs";
import {
  createMagicEffectReceiver, decodeMagicEffectPacket,
  MAGIC_FX_PACKET_BYTES, MAGIC_FX_WIRE_VERSION,
} from "../src/browser/magic-effect-receiver.mjs";

const golden = Uint8Array.from([
  0x4d, 0x45, 1, 0, 7, 0, 0, 0, 1, 0, 0, 0,
  100, 0, 0, 0, 0x44, 0x33, 0x22, 0x11,
  50, 0, 0, 0, 0xe3, 0xff, 0xff, 0xff,
  128, 45, 0, 0,
]);
const view = Object.freeze({ zoneId: 7, x: 12.5, y: -7.25, radius: 150, serverTick: 100 });

function packet({
  kind = 0, zoneId = 7, eventId = 1, serverTick = 100,
  seed = 0x11223344, x = 12.5, y = -7.25,
  intensity = 128, ttlTicks = 45,
} = {}) {
  const bytes = new Uint8Array(MAGIC_FX_PACKET_BYTES);
  const wire = new DataView(bytes.buffer);
  bytes[0] = 0x4d;
  bytes[1] = 0x45;
  bytes[2] = MAGIC_FX_WIRE_VERSION;
  bytes[3] = kind;
  wire.setUint32(4, zoneId, true);
  wire.setUint32(8, eventId, true);
  wire.setUint32(12, serverTick, true);
  wire.setUint32(16, seed, true);
  wire.setInt32(20, Math.round(x * 4), true);
  wire.setInt32(24, Math.round(y * 4), true);
  bytes[28] = intensity;
  bytes[29] = ttlTicks;
  return bytes;
}

test("P4 JS decoder matches exact 32-byte Rust golden byte vector", () => {
  assert.deepEqual([...packet()], [...golden]);
  assert.deepEqual(decodeMagicEffectPacket(golden), {
    zoneId: 7,
    eventId: 1,
    serverTick: 100,
    seed: 0x11223344,
    x: 12.5,
    y: -7.25,
    kind: "fire",
    intensity: 128 / 255,
    ttlTicks: 45,
  });
  // No assumption that the Uint8Array occupies the entire ArrayBuffer.
  const larger = new Uint8Array(40);
  larger.set(golden, 3);
  assert.deepEqual(decodeMagicEffectPacket(larger.subarray(3, 35)),
    decodeMagicEffectPacket(golden));
});

test("P4 decoder refuses malformed framing and unknown or reserved bytes", () => {
  for (const altered of [
    null,
    new Uint8Array(31),
    new Uint8Array(33),
    (() => { const b = golden.slice(); b[0] = 0; return b; })(),
    (() => { const b = golden.slice(); b[2] = 2; return b; })(),
    (() => { const b = golden.slice(); b[3] = 7; return b; })(),
    (() => { const b = golden.slice(); b[4] = 0; return b; })(), // zone 0
    (() => { const b = golden.slice(); b[8] = 0; return b; })(), // ID 0
    (() => { const b = golden.slice(); b[28] = 0; return b; })(), // intensity 0
    (() => { const b = golden.slice(); b[29] = 121; return b; })(),
    (() => { const b = golden.slice(); b[30] = 1; return b; })(),
    packet({ x: 1_000_001 }),
  ]) {
    assert.equal(decodeMagicEffectPacket(altered), null);
  }
});

test("P4 receiver rejects cross-zone, offscreen, expired and forged future visual events", () => {
  const pool = createMagicParticlePool();
  const receiver = createMagicEffectReceiver(pool);
  assert.equal(receiver.ingest(packet({ zoneId: 8 }), view), 0);
  assert.equal(receiver.ingest(packet({ x: 600 }), view), 0);
  assert.equal(receiver.ingest(packet({ serverTick: 54 }), view), 0);
  assert.equal(receiver.ingest(packet({ serverTick: 104 }), view), 0);
  assert.equal(pool.metrics().active, 0);
  assert.equal(receiver.metrics().rejected, 4);
  // A bounded reordering tolerance of +3 server ticks is presentation only.
  assert.ok(receiver.ingest(packet({ serverTick: 102 }), view) > 0);
  assert.equal(receiver.metrics().accepted, 1);
});

test("P4 receiver deduplicates replays and lets client quality drop visuals", () => {
  const pool = createMagicParticlePool({ quality: "low" });
  const receiver = createMagicEffectReceiver(pool);
  const first = receiver.ingest(golden, view);
  assert.ok(first > 0 && first <= 8);
  assert.equal(receiver.ingest(golden, view), 0);
  assert.equal(receiver.metrics().duplicates, 1);
  for (let i = 2; i <= 512; i += 1) {
    receiver.ingest(packet({ eventId: i, seed: i }), view);
  }
  assert.equal(pool.metrics().active, 64);
  assert.ok(receiver.metrics().remembered <= 256);
  assert.equal(receiver.ingest(golden, view), 0);
  assert.equal(receiver.metrics().duplicates, 2);
  pool.advance(10000);
  assert.equal(pool.metrics().active, 0);
});

test("P4 explicit zone transition and reconnect reset clear cosmetic/replay state", () => {
  const pool = createMagicParticlePool();
  const receiver = createMagicEffectReceiver(pool);
  assert.ok(receiver.ingest(golden, view) > 0);
  assert.equal(receiver.ingest(golden, { ...view, zoneId: 8 }), 0);
  assert.equal(pool.metrics().active, 0);
  assert.ok(receiver.ingest(packet({ zoneId: 8 }), { ...view, zoneId: 8 }) > 0);
  receiver.reset(8);
  assert.equal(pool.metrics().active, 0);
  assert.ok(receiver.ingest(packet({ zoneId: 8 }), { ...view, zoneId: 8 }) > 0);
  assert.throws(() => receiver.reset(-1), RangeError);
});

test("P4 rejects untrusted render-view geometry and missing particle pool", () => {
  assert.throws(() => createMagicEffectReceiver({}), TypeError);
  const pool = createMagicParticlePool();
  const receiver = createMagicEffectReceiver(pool);
  for (const bad of [
    null,
    { ...view, zoneId: 0 },
    { ...view, x: Infinity },
    { ...view, y: NaN },
    { ...view, radius: 1501 },
    { ...view, serverTick: -1 },
    { ...view, serverTick: 2 ** 32 },
  ]) {
    assert.equal(receiver.ingest(golden, bad), 0);
  }
  assert.equal(receiver.metrics().accepted, 0);
});
