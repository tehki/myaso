import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";

const PAGES = ["../web/online-game.mjs", "../web/game.mjs"];
function createHarness(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const outcomes = [];
  const leftButtonCharge = createLeftButtonCharge({
    onLight: () => outcomes.push("LIGHT"),
    onHeavy: () => outcomes.push("HEAVY"),
  });
  const context = {
    middleBlockPointerId: null,
    middleBlockHeld: false,
    leftButtonCharge,
    leftButtonDown: false,
    leftButtonPressMovement: null,
    updateMouse() {},
    canvas: { focus() {}, addEventListener() {} },
  };
  for (const name of ["onChordedMiddleMouseDown", "onChordedMiddleMouseUp"]) {
    const marker = "function " + name + "(event) {";
    const start = source.indexOf(marker), end = source.indexOf("\n}", start);
    assert.ok(start >= 0 && end > start, path + " actual " + name + " exists");
    runInNewContext(source.slice(start, end + 2), context);
  }
  const listeners = new Map();
  context.canvas.addEventListener = (name, callback) => listeners.set(name, callback);
  for (const kind of ["pointercancel", "lostpointercapture"]) {
    const marker = 'canvas.addEventListener("' + kind + '", (event) => {';
    const start = source.indexOf(marker), end = source.indexOf("\n});", start);
    assert.ok(start >= 0 && end > start, path + " real " + kind + " exists");
    runInNewContext(source.slice(start, end + 4), context);
  }
  return {
    context, outcomes, source, leftButtonCharge,
    down: context.onChordedMiddleMouseDown,
    up: context.onChordedMiddleMouseUp,
    cancel: listeners.get("pointercancel"),
    lost: listeners.get("lostpointercapture"),
  };
}

test("physical held RMB or LMB permits middle guard using real mouse edge without second pointerDOWN", () => {
  for (const path of PAGES) {
    const h = createHarness(path);
    for (const otherButton of [2, 1]) {
      h.down({ button: 1, buttons: otherButton | 4, preventDefault() {} });
      assert.equal(h.context.middleBlockHeld, true, path);
      assert.equal(h.context.middleBlockPointerId, -2);
      h.up({ button: 1, buttons: otherButton });
      assert.equal(h.context.middleBlockHeld, false, "MMB mouseUP completes during another held button");
      assert.equal(h.context.middleBlockPointerId, null);
    }
    assert.deepEqual(h.outcomes, []);
  }
});

test("physical middle mouseUP terminates a real pointer-owned MMB even without pointerUP", () => {
  for (const path of PAGES) {
    const h = createHarness(path);
    h.context.middleBlockHeld = true;
    h.context.middleBlockPointerId = 7;
    h.down({ button: 1, buttons: 6, preventDefault() {} });
    assert.equal(h.context.middleBlockPointerId, 7, "additional mouse edge does not steal accepted pointer owner");
    h.up({ button: 0, buttons: 4 });
    assert.equal(h.context.middleBlockHeld, true, "not an MMB release");
    h.up({ button: 1, buttons: 2 });
    assert.equal(h.context.middleBlockHeld, false, "actual intermediate MMB release clears true guard");
    assert.equal(h.context.middleBlockPointerId, null);
  }
});

test("matching mouse cancellation or ended capture retires chorded middle hold without phantom LMB", () => {
  for (const path of PAGES) {
    const h = createHarness(path);
    h.down({ button: 1, buttons: 6, preventDefault() {} });
    h.cancel({ pointerId: 33, pointerType: "touch", button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, true, "foreign touch cannot cancel physical mouse");
    h.lost({ pointerId: 9, pointerType: "mouse", button: -1, buttons: 6 });
    assert.equal(h.context.middleBlockHeld, true, "capture move while middle held cannot cancel");
    h.cancel({ pointerId: 9, pointerType: "mouse", button: -1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, false, "W3C middle mouse cancellation ends chord");
    h.down({ button: 1, buttons: 5, preventDefault() {} });
    h.lost({ pointerId: 9, pointerType: "mouse", button: -1, buttons: 1 });
    assert.equal(h.context.middleBlockHeld, false, "lost middle mouse capture after release ends chord");
    assert.equal(h.context.middleBlockPointerId, null);
    assert.deepEqual(h.outcomes, []);
  }
});

test("no duplicate middle guard from native pointer plus mousedown and no premature mouseUP", () => {
  for (const path of PAGES) {
    const h = createHarness(path);
    h.context.middleBlockPointerId = 42;
    h.context.middleBlockHeld = true;
    h.down({ button: 1, buttons: 4, preventDefault() {} });
    assert.equal(h.context.middleBlockPointerId, 42);
    h.up({ button: 1, buttons: 4 });
    assert.equal(h.context.middleBlockHeld, true, "MMB still physically pressed");
    h.up({ button: 0, buttons: 4 });
    assert.equal(h.context.middleBlockHeld, true);
    h.up({ button: 1, buttons: 0 });
    assert.equal(h.context.middleBlockHeld, false);
  }
});

test("both live browser clients register both native and fallback MMB mouse hooks", () => {
  for (const path of PAGES) {
    const { source } = createHarness(path);
    assert.match(source, /canvas\.addEventListener\("mousedown", onChordedMiddleMouseDown\)/);
    assert.match(source, /canvas\.addEventListener\("mouseup", onChordedMiddleMouseUp\)/);
    assert.match(source, /window\.addEventListener\("mouseup", onChordedMiddleMouseUp\)/);
    assert.match(source, /canvas\.addEventListener\("pointerup", onLeftPointerUp\)/);
    assert.match(source, /middleBlockHeld = false;\s*middleBlockPointerId = null;/);
    assert.match(source, /if \(event\.button !== 1 \|\| \(event\.buttons & 4\) \|\| middleBlockPointerId === null\) return;/);
  }
});
