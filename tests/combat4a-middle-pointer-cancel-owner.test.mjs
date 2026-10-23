import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";

// Evaluate the *actual* online/practice input callbacks rather than a
// rewritten copy. These are source-state tests, not real browser/World HP.
const PLAYERS = ["../web/online-game.mjs", "../web/game.mjs"];

function realHandler(path, kind, context) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  if (kind === "onLeftPointerUp") {
    const start = source.indexOf("function onLeftPointerUp(event) {");
    const end = source.indexOf('\n}\ncanvas.addEventListener("pointerup"', start);
    assert.ok(start >= 0 && end > start, path + " native pointerup handler must exist");
    runInNewContext(source.slice(start, end + 2), context);
    return context.onLeftPointerUp;
  }
  const marker = 'canvas.addEventListener("' + kind + '", (event) => {';
  const start = source.indexOf(marker);
  const end = source.indexOf("\n});", start);
  assert.ok(start >= 0 && end > start, path + " native " + kind + " handler must exist");
  const callbacks = new Map();
  context.canvas = {
    focus() {},
    addEventListener(name, fn) { callbacks.set(name, fn); },
  };
  runInNewContext(source.slice(start, end + 4), context);
  return callbacks.get(kind);
}

function harness(path) {
  const events = [];
  const leftButtonCharge = createLeftButtonCharge({
    onLight() { events.push("LIGHT"); },
    onHeavy() { events.push("HEAVY"); },
  });
  const context = {
    middleBlockHeld: false,
    middleBlockPointerId: null,
    leftButtonCharge,
    leftButtonDown: false,
    leftButtonPressMovement: null,
    updateMouse() {},
  };
  return {
    context, events, leftButtonCharge,
    down: realHandler(path, "pointerdown", context),
    up: realHandler(path, "onLeftPointerUp", context),
    cancel: realHandler(path, "pointercancel", context),
    lost: realHandler(path, "lostpointercapture", context),
  };
}

test("real online and practice middle-block pointercancel(button=-1) ends only own hold", () => {
  for (const path of PLAYERS) {
    const h = harness(path);
    h.down({ pointerId: 7, button: 1, preventDefault() {} });
    assert.equal(h.context.middleBlockHeld, true, path);
    assert.equal(h.context.middleBlockPointerId, 7);
    h.cancel({ pointerId: 99, button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, true, "foreign pointercancel cannot end held MMB");
    h.cancel({ pointerId: 7, button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, false, "W3C button=-1 own cancel must retire held MMB");
    assert.equal(h.context.middleBlockPointerId, null);
    assert.deepEqual(h.events, [], "middle cancellation must not create light or heavy");
  }
});

test("real online and practice middle-button UP validates pointer ownership", () => {
  for (const path of PLAYERS) {
    const h = harness(path);
    h.down({ pointerId: 7, button: 1, preventDefault() {} });
    h.up({ pointerId: 99, button: 1 });
    assert.equal(h.context.middleBlockHeld, true, "other pointer cannot release held middle");
    h.up({ pointerId: 7, button: 1 });
    assert.equal(h.context.middleBlockHeld, false);
    assert.equal(h.context.middleBlockPointerId, null);
    assert.deepEqual(h.events, []);
  }
});

test("real online and practice capture migration preserves physical MMB until release", () => {
  for (const path of PLAYERS) {
    const h = harness(path);
    h.down({ pointerId: 7, button: 1, preventDefault() {} });
    h.lost({ pointerId: 7, button: -1, buttons: 4 });
    assert.equal(h.context.middleBlockHeld, true, "captured middle still physically pressed");
    h.lost({ pointerId: 99, button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, true, "foreign capture loss must not cancel middle");
    h.lost({ pointerId: 7, button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, false, "matching released capture must cancel middle");
    assert.equal(h.context.middleBlockPointerId, null);
  }
});

test("middle-button cancellation is independent of a separate active LMB", () => {
  for (const path of PLAYERS) {
    const h = harness(path);
    h.leftButtonCharge.press(19);
    h.context.leftButtonDown = true;
    h.down({ pointerId: 7, button: 1, preventDefault() {} });
    h.cancel({ pointerId: 19, button: -1, buttons: 0 });
    assert.equal(h.leftButtonCharge.isPressed(), false, "LMB cancels by its own pointerId");
    assert.equal(h.context.middleBlockHeld, true, "other pointer LMB cancel must preserve held middle");
    h.cancel({ pointerId: 7, button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, false);
    assert.deepEqual(h.events, [], "cancellation must not create phantom hits");
  }
});

test("missing middle pointer identity is rejected and blur resets pointer ownership", () => {
  for (const path of PLAYERS) {
    const h = harness(path);
    h.down({ button: 1, preventDefault() {} });
    assert.equal(h.context.middleBlockHeld, false);
    assert.equal(h.context.middleBlockPointerId, null);
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const release = source.match(/function releaseInputs\(\) \{([\s\S]*?)\n\}/);
    assert.ok(release, path + " must have blur/cancel releaseInputs");
    assert.match(release[1], /middleBlockHeld = false;\s*middleBlockPointerId = null;/,
      "blur must clear both middle state and owner identity");
    assert.match(source, /middleBlockPointerId === event\.pointerId && !\(event\.buttons & 4\)/);
  }
});
