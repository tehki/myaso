import assert from "node:assert/strict";
import test from "node:test";
import { createMagicParticlePool, PARTICLE_KINDS } from "../src/browser/magic-particle-pool.mjs";
import { drawMagicParticles } from "../src/browser/magic-particle-renderer.mjs";
import { ARENA_VIEW_ZOOM, projectArenaPoint } from "../src/browser/arena-viewport.mjs";

function context() {
  const calls = [];
  const ctx = {
    calls,
    save() { calls.push(["save"]); },
    restore() { calls.push(["restore"]); },
    beginPath() { calls.push(["beginPath"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    closePath() { calls.push(["closePath"]); },
    fill() { calls.push(["fill"]); },
    stroke() { calls.push(["stroke"]); },
  };
  return ctx;
}

test("P2 particle projection exactly matches existing authoritative arena camera projection", () => {
  const ctx = context();
  const camera = { x: 900, y: 400 };
  const p = { x: 980, y: 425 };
  const pool = { forEachVisible(view, draw) {
    assert.equal(view.x, camera.x);
    assert.equal(view.y, camera.y);
    draw(p.x, p.y, 1, "fire");
  } };
  const result = drawMagicParticles(ctx, pool, camera, 960, 540);
  assert.equal(result, 1);
  const expected = projectArenaPoint(p.x, p.y, camera.x, camera.y, 960, 540);
  const arc = ctx.calls.find(c => c[0] === "arc");
  assert.ok(arc);
  assert.equal(arc[1], expected.x);
  assert.equal(arc[2], expected.y);
  assert.equal(ctx.calls[0][0], "save");
  assert.equal(ctx.calls.at(-1)[0], "restore");
});

test("P2 five elemental shapes are distinct and all cosmetic-only", () => {
  for (const kind of PARTICLE_KINDS) {
    const ctx = context();
    const pool = { forEachVisible(_view, draw) { draw(0, 0, 1, kind); } };
    assert.equal(drawMagicParticles(ctx, pool, { x: 0, y: 0 }, 320, 220), 1);
    const usesArc = ctx.calls.some(c => c[0] === "arc");
    const usesStroke = ctx.calls.some(c => c[0] === "stroke");
    const usesFill = ctx.calls.some(c => c[0] === "fill");
    if (kind === "fire") assert.ok(usesArc && usesFill);
    if (kind === "ice") assert.ok(!usesArc && usesFill);
    if (kind === "lightning") assert.ok(!usesArc && usesStroke);
    if (kind === "wind" || kind === "arcane") assert.ok(usesArc && usesStroke);
  }
});

test("P2 invisible, malformed and unknown particles never render", () => {
  const ctx = context();
  const pool = { forEachVisible(_view, draw) {
    draw(10000, 0, 1, "fire");
    draw(0, 0, Number.NaN, "fire");
    draw(0, 0, 0, "fire");
    draw(0, 0, 1, "unknown");
    draw(Infinity, 0, 1, "fire");
    draw(0, 0, 1, "ice");
  } };
  assert.equal(drawMagicParticles(ctx, pool, { x: 0, y: 0 }, 320, 220), 1);
  assert.equal(ctx.calls.filter(c => c[0] === "fill").length, 1);
  assert.equal(ctx.calls.filter(c => c[0] === "restore").length, 1);
});

test("P2 invalid viewport and missing draw API fail closed without touching the canvas", () => {
  const ctx = context();
  let visited = false;
  const pool = { forEachVisible() { visited = true; } };
  assert.equal(drawMagicParticles(ctx, pool, { x: NaN, y: 0 }, 640, 480), 0);
  assert.equal(drawMagicParticles(ctx, pool, { x: 0, y: 0 }, 0, 480), 0);
  assert.equal(drawMagicParticles(ctx, pool, { x: 0, y: 0 }, 640, 9000), 0);
  assert.equal(drawMagicParticles(ctx, pool, { x: 0, y: 0 }, 640, 480, 4), 0);
  assert.equal(drawMagicParticles(null, pool, { x: 0, y: 0 }, 640, 480), 0);
  assert.equal(drawMagicParticles(ctx, null, { x: 0, y: 0 }, 640, 480), 0);
  assert.equal(visited, false);
  assert.equal(ctx.calls.length, 0);
});

test("P2 renderer restores graphics context even if a malformed pool throws", () => {
  const ctx = context();
  const pool = { forEachVisible() { throw new Error("fake pool failure"); } };
  assert.throws(() => drawMagicParticles(ctx, pool, { x: 0, y: 0 }, 320, 220), /fake pool failure/);
  assert.deepEqual(ctx.calls.map(c => c[0]), ["save", "restore"]);
});

test("P2 saturated 512-effect visual storm remains bounded and does not mutate pool", () => {
  const pool = createMagicParticlePool({ quality: "low" });
  const view = { x: 200, y: 200, radius: 500 };
  for (let i = 0; i < 512; i += 1) {
    pool.emit({ kind: PARTICLE_KINDS[i % 5], x: 200, y: 200, seed: i }, view);
  }
  const before = pool.metrics();
  assert.equal(before.active, 64);
  const ctx = context();
  const count = drawMagicParticles(ctx, pool, { x: 200, y: 200 }, 800, 450, ARENA_VIEW_ZOOM);
  assert.equal(count, before.active);
  assert.deepEqual(pool.metrics(), before);
  pool.advance(9999);
  assert.equal(pool.metrics().active, 0);
});
