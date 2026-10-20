import assert from "node:assert/strict";
import test from "node:test";
import {
  createMagicParticlePool,
  PARTICLE_KINDS,
  PARTICLE_QUALITY,
} from "../src/browser/magic-particle-pool.mjs";

const view = Object.freeze({ x: 100, y: 100, radius: 100 });
const fire = Object.freeze({ kind: "fire", x: 100, y: 100, seed: 724, intensity: 1 });

function sample(pool) {
  const particles = [];
  pool.forEachVisible({ x: 100, y: 100, radius: 1000 }, (x, y, alpha, kind) => {
    particles.push([x, y, alpha, kind]);
  });
  return particles;
}

test("P1 particles are reproducible from event type, position and seed", () => {
  const first = createMagicParticlePool();
  const second = createMagicParticlePool();
  assert.equal(first.emit(fire, view), PARTICLE_QUALITY.medium.perBurst);
  assert.equal(second.emit(fire, view), PARTICLE_QUALITY.medium.perBurst);
  assert.deepEqual(sample(first), sample(second));
  first.advance(20);
  second.advance(20);
  assert.deepEqual(sample(first), sample(second));
  first.clear();
  first.emit(fire, view);
  assert.deepEqual(sample(first), sample(createReference()));
});

function createReference() {
  const pool = createMagicParticlePool();
  pool.emit(fire, view);
  return pool;
}

test("P1 graphics budgets bound allocation and drop excess cosmetic particles", () => {
  const pool = createMagicParticlePool({ capacity: 20, quality: "high" });
  for (let n = 0; n < 10; n += 1) pool.emit({ ...fire, seed: n }, view);
  assert.equal(pool.metrics().active, 20);
  assert.equal(pool.metrics().capacity, 20);
  assert.ok(pool.metrics().dropped > 0);
  assert.equal(sample(pool).length, 20);
});

test("P1 low quality and view culling limit work independently of gameplay", () => {
  const pool = createMagicParticlePool({ quality: "low" });
  assert.equal(pool.emit({ ...fire, x: 10000 }, view), 0);
  assert.equal(pool.metrics().culled, 1);
  assert.equal(pool.emit(fire, view), PARTICLE_QUALITY.low.perBurst);
  assert.equal(pool.metrics().active, PARTICLE_QUALITY.low.perBurst);
  const seen = [];
  assert.equal(pool.forEachVisible({ x: 0, y: 0, radius: 1 }, () => seen.push(1)), 0);
  assert.deepEqual(seen, []);
  assert.equal(PARTICLE_KINDS.length, 5);
});

test("P1 effect presets expire and tab resume cannot leave immortal particles", () => {
  for (const kind of PARTICLE_KINDS) {
    const pool = createMagicParticlePool();
    assert.ok(pool.emit({ ...fire, kind }, view) > 0);
    pool.advance(10_000);
    assert.equal(pool.metrics().active, 0, kind);
  }
});

test("P1 rejects untrusted or invalid cosmetic event data without resource growth", () => {
  const pool = createMagicParticlePool();
  const bad = [
    null,
    { ...fire, kind: "unknown" },
    { ...fire, seed: -1 },
    { ...fire, seed: 2 ** 32 },
    { ...fire, seed: 1.5 },
    { ...fire, x: Number.NaN },
    { ...fire, y: Number.POSITIVE_INFINITY },
    { ...fire, intensity: 10 },
    { ...fire, intensity: -1 },
  ];
  for (const event of bad) assert.equal(pool.emit(event, view), 0);
  assert.equal(pool.emit(fire, null), 0);
  assert.equal(pool.emit(fire, { ...view, radius: Number.NaN }), 0);
  assert.equal(pool.metrics().active, 0);
  assert.throws(() => createMagicParticlePool({ capacity: 5000 }), RangeError);
  assert.throws(() => createMagicParticlePool({ quality: "ultra" }), RangeError);
});

test("P1 scaling down trims visuals without touching authoritative state", () => {
  const pool = createMagicParticlePool({ quality: "high" });
  for (let n = 0; n < 10; n += 1) pool.emit({ ...fire, seed: n }, view);
  assert.ok(pool.metrics().active > PARTICLE_QUALITY.low.maxActive);
  pool.setQuality("low");
  assert.equal(pool.metrics().active, PARTICLE_QUALITY.low.maxActive);
  assert.equal(pool.metrics().quality, "low");
  assert.throws(() => pool.setQuality("invalid"), RangeError);
  pool.clear();
  assert.deepEqual(pool.metrics(), {
    active: 0, capacity: 384, quality: "low", dropped: 0, culled: 0,
  });
});
