import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GROUND_CHUNK_SIZE, GROUND_CACHE_LIMIT, GROUND_BUILD_PER_FRAME,
  groundHash, groundColorAt, groundVisibleChunks, createGroundCache,
  createBattlefieldGround, drawGroundContactShadow,
} from "../src/browser/battlefield-ground.mjs";

test("ground is deterministic, continuous across chunk borders and camera-independent", () => {
  assert.equal(groundHash(2, -5, 13), groundHash(2, -5, 13));
  assert.notEqual(groundHash(2, -5, 13), groundHash(3, -5, 13));
  for (const [x, y] of [[0,0], [384, 78], [-384, 100], [8192,8192]]) {
    assert.deepEqual(groundColorAt(x, y), groundColorAt(x, y));
    const a = groundColorAt(x - 0.01, y);
    const b = groundColorAt(x + 0.01, y);
    assert.ok(a.every((value, i) => Math.abs(value - b[i]) <= 2));
  }
  assert.throws(() => groundColorAt(NaN, 0), /finite/);
});

test("visible chunks track world camera position and zoom without frame dependence", () => {
  const chunks = groundVisibleChunks(192, 192, 700, 400, .84);
  assert.ok(chunks.length > 0 && chunks.length < 16);
  assert.ok(chunks.some(c => c.ix === 0 && c.iy === 0));
  const shifted = groundVisibleChunks(192 + GROUND_CHUNK_SIZE, 192, 700, 400, .84);
  assert.deepEqual(chunks.map(c => [c.ix + 1, c.iy]), shifted.map(c => [c.ix, c.iy]));
  assert.ok(groundVisibleChunks(0, 0, 8192, 8192, .84).length <= 64);
  assert.throws(() => groundVisibleChunks(0, 0, 100, 200, 0), /invalid/);
});

test("terrain cache enforces bound with least-recently-used eviction", () => {
  const cache = createGroundCache(2);
  cache.put("a", 1);
  cache.put("b", 2);
  assert.equal(cache.get("a"), 1);
  cache.put("c", 3);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("b"), undefined);
  assert.equal(cache.get("a"), 1);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(GROUND_CACHE_LIMIT, 24);
});

test("ground rendering builds at most two texture chunks each frame, and reuses tiles", () => {
  let canvases = 0;
  const calls = [];
  const imageData = { data: new Uint8ClampedArray(96 * 96 * 4) };
  const textureCtx = {
    createImageData: () => imageData,
    putImageData: () => {},
    drawImage: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    ellipse: () => {},
    fill: () => {},
  };
  const createCanvas = () => {
    canvases++;
    return { width: 0, height: 0, getContext: () => textureCtx };
  };
  const ctx = {
    fillStyle: "",
    fillRect: (...args) => calls.push(["fill", ...args]),
    drawImage: (_, x, y) => calls.push(["tile", x, y]),
  };
  const ground = createBattlefieldGround({ createCanvas });
  const camera = { x: 100, y: 100 };
  ground.draw(ctx, camera, 700, 400, .84);
  assert.equal(ground.stats.generated, GROUND_BUILD_PER_FRAME);
  assert.equal(canvases, GROUND_BUILD_PER_FRAME * 2);
  assert.ok(calls.some(c => c[0] === "tile"));
  const first = ground.stats.cached;
  ground.draw(ctx, camera, 700, 400, .84);
  assert.equal(ground.stats.cached, first + GROUND_BUILD_PER_FRAME);
  for (let i = 0; i < 35; i++) ground.draw(ctx, { x: i * 550, y: 100 }, 700, 400, .84);
  assert.ok(ground.stats.cached <= GROUND_CACHE_LIMIT);
});

test("contact shadow is isolated to canvas state and jump only alters its appearance", () => {
  const events = [];
  const ctx = { save: () => events.push("save"), restore: () => events.push("restore"),
    beginPath: () => {}, ellipse: (...a) => events.push(a), fill: () => {},
    globalAlpha: 1, fillStyle: "" };
  drawGroundContactShadow(ctx, 120, 140, { airborne: true });
  assert.deepEqual(events.slice(0, 1), ["save"]);
  assert.equal(events.at(-1), "restore");
  assert.equal(events[1][0], 120);
  assert.equal(events[1][1], 148);
  assert.equal(events[1][2], 13);
});

test("ground is opt-in and placed inside world zoom before all fighters", () => {
  const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
  assert.match(source, /params\.get\("ground"\) === "1"/);
  assert.match(source, /&& !params\.has\("scenario"\)/);
  const zoom = source.indexOf("ctx.scale(ARENA_VIEW_ZOOM, ARENA_VIEW_ZOOM);");
  const draw = source.indexOf("battlefieldGround.draw(ctx, visualCameraPosition");
  const fighters = source.indexOf("for (const entity of networkClient.state.values())", draw);
  assert.ok(zoom > 0 && zoom < draw && draw < fighters);
  assert.match(source, /if \(!groundEnabled\) \{/);
});
