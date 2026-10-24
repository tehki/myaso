import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createLeftButtonCharge } from "../src/browser/left-button-charge.mjs";

const source = readFileSync(new URL("../web/online-game.mjs", import.meta.url), "utf8");
const start = source.indexOf("function cancelActiveLeftPointer(pointerId) {");
const end = source.indexOf("\ncanvas.addEventListener(\"pointercancel\"", start);

test("4A cancel is exact-pointer scoped; stale capture-loss cannot cancel a newer physical press", () => {
  assert.ok(start >= 0 && end > start, "one shared active-left cancellation handler");
  let now = 0;
  let lights = 0;
  let heavies = 0;
  const charge = createLeftButtonCharge({
    now: () => now,
    onLight: () => { lights++; },
    onHeavy: () => { heavies++; },
  });
  const context = {
    leftButtonCharge: charge,
    leftButtonDown: true,
    leftButtonPressMovement: { moveX: 1, moveY: 0 },
    chordedLeftDown: true,
  };
  runInNewContext(source.slice(start, end), context);
  assert.equal(typeof context.cancelActiveLeftPointer, "function");
  assert.equal(charge.press(17), true);
  assert.equal(context.cancelActiveLeftPointer(16), false, "stale lostcapture id must not cancel");
  assert.equal(context.leftButtonDown, true);
  assert.equal(context.leftButtonPressMovement.moveX, 1);
  assert.equal(charge.isPressed(), true);
  assert.equal(context.cancelActiveLeftPointer(17), true);
  assert.equal(context.leftButtonDown, false);
  assert.equal(context.leftButtonPressMovement, null);
  assert.equal(context.chordedLeftDown, false);
  assert.equal(charge.isPressed(), false);
  now = 450;
  assert.equal(charge.release(17), null, "cancel is terminal; no phantom heavy on release");
  assert.equal(lights, 0);
  assert.equal(heavies, 0);
});

test("4A pointercancel honors physical pointer identity even when event.button is -1", () => {
  const startCancel = source.indexOf('canvas.addEventListener("pointercancel", (event) => {');
  const endCancel = source.indexOf('canvas.addEventListener("lostpointercapture"', startCancel);
  assert.ok(startCancel > 0 && endCancel > startCancel);
  const handler = source.slice(startCancel, endCancel);
  assert.ok(handler.includes("cancelActiveLeftPointer(event.pointerId)"));
  assert.doesNotMatch(handler, /if\s*\(event\.button\s*===\s*0\)/,
    "pointercancel commonly reports button=-1; do not discard real cancellation");
  const lost = source.slice(endCancel, source.indexOf('canvas.addEventListener("wheel"', endCancel));
  assert.ok(lost.includes("cancelActiveLeftPointer(event.pointerId)"));
  assert.doesNotMatch(lost, /leftButtonPressMovement\s*=\s*null/,
    "stale capture-loss cannot clear the next pointer's capture state");
});

test("4A keyup is observed on window after arena focus transfers within the same tab", () => {
  assert.match(source, /canvas\.addEventListener\("keydown",/);
  assert.match(source, /window\.addEventListener\("keyup", \(event\) => keys\.delete\(event\.code\)\)/);
  assert.doesNotMatch(source, /canvas\.addEventListener\("keyup"/);
  assert.match(source, /window\.addEventListener\("blur", releaseInputs\)/);
  assert.match(source, /function releaseInputs\(\)\s*\{\s*keys\.clear\(\)/);
  // No synthetic keydowns, movement packets or additional input producer:
  const changedHandler = source.slice(
    source.indexOf('window.addEventListener("keyup"'),
    source.indexOf('window.addEventListener("blur"'));
  assert.doesNotMatch(changedHandler, /sendInput|dispatchEvent|currentInput/);
});
