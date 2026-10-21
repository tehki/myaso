import test from "node:test";
import assert from "node:assert/strict";
import { swordPointerCanvasPoint } from "../src/browser/sword-canvas-pointer.mjs";
import { pickRenderedSword, createSwordPointerGate } from "../src/browser/world-sword-pointer.mjs";

function canvas({ left = 0, top = 0, width = 640, height = 360,
  backingWidth = 1280, backingHeight = 720 } = {}) {
  return { width: backingWidth, height: backingHeight,
    getBoundingClientRect: () => ({ left, top, width, height }) };
}
const sword = { kind: "sword", itemId: "rack_sword_1", rendered: true,
  occluded: false, paintOrder: 5,
  bounds: { x: 600, y: 300, width: 32, height: 100 } };

test("P0 maps CSS-scaled pointer to exact rendered canvas backing pixels", () => {
  const target = canvas({ left: 20, top: 90, width: 640, height: 360 });
  assert.deepEqual(swordPointerCanvasPoint({ clientX: 325, clientY: 260 }, target),
    { x: 610, y: 340 });
  assert.equal(pickRenderedSword(swordPointerCanvasPoint(
    { clientX: 325, clientY: 260 }, target), [sword]), sword.itemId);
});

test("P0 correctly scales mobile 390px and high-DPR canvas without hit shifting", () => {
  const mobile = canvas({ left: 16, top: 60, width: 358, height: 201.375,
    backingWidth: 1280, backingHeight: 720 });
  const point = swordPointerCanvasPoint({
    clientX: 16 + 610 * 358 / 1280,
    clientY: 60 + 340 * 201.375 / 720,
  }, mobile);
  assert.ok(Math.abs(point.x - 610) < 1e-7);
  assert.ok(Math.abs(point.y - 340) < 1e-7);
  assert.equal(pickRenderedSword(point, [sword]), sword.itemId);
});

test("P0 outside, boundaries, malformed pointer and invalid canvas fail closed", () => {
  const c = canvas({ left: 10, top: 20, width: 100, height: 50 });
  for (const [x, y] of [[9, 25], [110, 25], [25, 19], [25, 70]]) {
    assert.equal(swordPointerCanvasPoint({ clientX: x, clientY: y }, c), null);
  }
  assert.deepEqual(swordPointerCanvasPoint({ clientX: 10, clientY: 20 }, c),
    { x: 0, y: 0 });
  assert.equal(swordPointerCanvasPoint({ clientX: NaN, clientY: 30 }, c), null);
  assert.equal(swordPointerCanvasPoint(null, c), null);
  assert.equal(swordPointerCanvasPoint({ clientX: 30, clientY: 30 }, null), null);
  assert.equal(swordPointerCanvasPoint({ clientX: 30, clientY: 30 },
    { ...c, width: 0 }), null);
  assert.equal(swordPointerCanvasPoint({ clientX: 30, clientY: 30 },
    { ...c, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 2 }) }), null);
});

test("P0 native CSS gesture maps to pending-only sword pickup, never to an attack", () => {
  const c = canvas({ left: 20, top: 90, width: 640, height: 360 });
  const g = createSwordPointerGate();
  const source = { clientX: 325, clientY: 260 };
  const xy = swordPointerCanvasPoint(source, c);
  assert.deepEqual(g.down({ button: 0, pointerId: 17, ...xy }, [sword]),
    { handled: true, itemId: null });
  assert.deepEqual(g.up({ button: 0, pointerId: 17, ...xy }, [sword]),
    { handled: true, itemId: "rack_sword_1" });
  assert.deepEqual(g.up({ button: 0, pointerId: 17, ...xy }, [sword]),
    { handled: false, itemId: null });
  assert.deepEqual(g.down({ button: 0, pointerId: 18, ...xy }, []),
    { handled: false, itemId: null });
});

test("P0 camera-frame target changes do not convert a reserved sword into another sword", () => {
  const c = canvas({ left: 0, top: 0 });
  const g = createSwordPointerGate();
  const position = swordPointerCanvasPoint({ clientX: 305, clientY: 170 }, c);
  const other = { ...sword, itemId: "rack_sword_2" };
  assert.equal(g.down({ button: 0, pointerId: 22, ...position }, [sword]).handled, true);
  assert.deepEqual(g.up({ button: 0, pointerId: 22, ...position }, [other]),
    { handled: true, itemId: null });
});
